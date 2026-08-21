/**
 * A deliberately read-only Monday.com GraphQL client.
 *
 * The token in the Keychain is full-access, which means the safety has to live
 * on this side: `MondayClient` parses every document it is handed and refuses
 * anything that is not a query. Constructing a client that permits mutations
 * takes an explicit `allowMutations: true`, and **nothing in this repository
 * passes it**. Adding an outbound write is therefore a visible, reviewable
 * change to a call site, not something that can happen by accident.
 *
 * See `portal/README.md` → "Monday.com" for the procedure a real write would
 * have to follow.
 */
import { redact, type MondayToken, type TokenSource } from "./monday-credentials.ts";

export const MONDAY_API_URL = "https://api.monday.com/v2";
export const MONDAY_API_VERSION = "2024-10";

export interface MondayClient {
  /** Runs a GraphQL *query*. Throws if the document contains a mutation. */
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
  describe(): string;
}

export class MondayWriteRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MondayWriteRefused";
  }
}

/**
 * Rejects mutations, subscriptions, and the batching trick of hiding a mutation
 * behind an alias. Comments and strings are stripped first so a `# mutation`
 * note does not trip it and a `"mutation"` literal cannot smuggle one through.
 */
export function assertReadOnlyDocument(document: string): void {
  const stripped = document
    .replace(/#[^\n]*/g, " ")
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""');

  if (/\bmutation\b/i.test(stripped)) {
    throw new MondayWriteRefused(
      "This client is read-only. Outbound Monday writes are not implemented; see portal/README.md → Monday.com.",
    );
  }
  if (/\bsubscription\b/i.test(stripped)) {
    throw new MondayWriteRefused("Subscriptions are not supported by this client.");
  }
}

export interface MondayClientOptions {
  fetcher?: typeof fetch;
  apiUrl?: string;
  apiVersion?: string;
  /**
   * Escape hatch that no caller in this repository uses. Present so that a
   * future, reviewed change has one obvious place to turn writes on.
   */
  allowMutations?: boolean;
}

export function createMondayClient(tokenSource: TokenSource, options: MondayClientOptions = {}): MondayClient {
  const fetcher = options.fetcher ?? fetch;
  const apiUrl = options.apiUrl ?? MONDAY_API_URL;
  let cached: MondayToken | null = null;

  return {
    describe() {
      return `${apiUrl} using ${tokenSource.describe()}${options.allowMutations ? " (MUTATIONS ENABLED)" : " (read-only)"}`;
    },

    async query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
      if (!options.allowMutations) assertReadOnlyDocument(document);

      cached ??= await tokenSource.read();
      const token = cached;

      let response: Response;
      try {
        response = await fetcher(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token.authorizationHeader(),
            "API-Version": options.apiVersion ?? MONDAY_API_VERSION,
          },
          body: JSON.stringify({ query: document, variables }),
        });
      } catch (error) {
        throw new Error(scrub(token, `Could not reach the Monday API: ${error instanceof Error ? error.message : String(error)}`));
      }

      const text = await response.text();
      if (!response.ok) {
        throw new Error(scrub(token, `Monday API returned ${response.status}: ${text.slice(0, 500)}`));
      }

      let parsed: { data?: T; errors?: { message?: string }[]; error_message?: string };
      try {
        parsed = JSON.parse(text) as typeof parsed;
      } catch {
        throw new Error(scrub(token, `Monday API returned something that is not JSON: ${text.slice(0, 200)}`));
      }
      if (parsed.errors?.length) {
        throw new Error(scrub(token, `Monday API error: ${parsed.errors.map((item) => item.message ?? "unknown").join("; ")}`));
      }
      if (parsed.error_message) {
        throw new Error(scrub(token, `Monday API error: ${parsed.error_message}`));
      }
      if (!parsed.data) throw new Error("Monday API returned no data");
      return parsed.data;
    },
  };
}

function scrub(token: MondayToken, message: string): string {
  return redact(token.redact(message));
}

// ---------------------------------------------------------------------------
// The queries discovery uses. All read-only.
// ---------------------------------------------------------------------------

export const BOARDS_QUERY = `
  query PortalBoards($limit: Int!) {
    boards(limit: $limit, state: active) {
      id
      name
      columns { id title type }
    }
  }`;

export const BOARD_ITEMS_QUERY = `
  query PortalBoardItems($boardId: ID!, $limit: Int!, $cursor: String) {
    boards(ids: [$boardId]) {
      id
      name
      items_page(limit: $limit, cursor: $cursor) {
        cursor
        items {
          id
          name
          column_values { id text type }
        }
      }
    }
  }`;

export interface MondayColumn {
  id: string;
  title: string;
  type?: string;
}

export interface MondayColumnValue {
  id: string;
  text: string | null;
  type?: string;
}

export interface MondayItem {
  id: string;
  name: string;
  column_values: MondayColumnValue[];
}

export interface MondayBoardPayload {
  id: string;
  name: string;
  columns?: MondayColumn[];
  items_page?: { cursor: string | null; items: MondayItem[] };
}

/** Walks `items_page` to the end. Read-only; stops at `maxItems`. */
export async function fetchBoardItems(
  client: MondayClient,
  boardId: string,
  options: { pageSize?: number; maxItems?: number } = {},
): Promise<{ board: { id: string; name: string }; items: MondayItem[] }> {
  const pageSize = options.pageSize ?? 100;
  const maxItems = options.maxItems ?? 5000;
  const items: MondayItem[] = [];
  let cursor: string | null = null;
  let board = { id: boardId, name: boardId };

  do {
    const data: { boards: MondayBoardPayload[] } = await client.query<{ boards: MondayBoardPayload[] }>(BOARD_ITEMS_QUERY, {
      boardId,
      limit: pageSize,
      cursor,
    });
    const payload = data.boards?.[0];
    if (!payload) break;
    board = { id: payload.id, name: payload.name };
    items.push(...(payload.items_page?.items ?? []));
    cursor = payload.items_page?.cursor ?? null;
  } while (cursor && items.length < maxItems);

  return { board, items: items.slice(0, maxItems) };
}
