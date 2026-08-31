/**
 * The outbound-only Monday transport. Discovery never imports this module and
 * continues to use the mutation-refusing client in `monday-client.ts`.
 */
import { MONDAY_API_URL, MONDAY_API_VERSION } from "./monday-client.ts";
import { redact, type MondayToken, type TokenSource } from "./monday-credentials.ts";

export interface RemoteMondayItem {
  id: string;
  boardId: string;
  values: Record<string, unknown>;
}

export interface MondayWriteTransport {
  readItem(boardId: string, itemId: string, columnIds: string[]): Promise<RemoteMondayItem | null>;
  writeColumns(boardId: string, itemId: string, values: Record<string, unknown>): Promise<void>;
}

export class MondayTransportError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "MondayTransportError";
    this.retryable = retryable;
  }
}

interface TransportOptions {
  fetcher?: typeof fetch;
  apiUrl?: string;
  apiVersion?: string;
}

const READ_ITEM = `
  query PortalSyncItem($itemId: ID!, $columns: [String!]) {
    items(ids: [$itemId]) {
      id
      board { id }
      column_values(ids: $columns) { id text }
    }
  }`;

const WRITE_COLUMNS = `
  mutation PortalSyncColumns($boardId: ID!, $itemId: ID!, $values: JSON!) {
    change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $values) { id }
  }`;

export function createMondayWriteTransport(tokenSource: TokenSource, options: TransportOptions = {}): MondayWriteTransport {
  const fetcher = options.fetcher ?? fetch;
  const apiUrl = options.apiUrl ?? MONDAY_API_URL;
  const apiVersion = options.apiVersion ?? MONDAY_API_VERSION;
  let cachedToken: MondayToken | null = null;

  async function request<T>(document: string, variables: Record<string, unknown>): Promise<T> {
    cachedToken ??= await tokenSource.read();
    const token = cachedToken;
    let response: Response;
    try {
      response = await fetcher(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token.authorizationHeader(),
          "API-Version": apiVersion,
        },
        body: JSON.stringify({ query: document, variables }),
      });
    } catch (error) {
      throw new MondayTransportError(safeMessage(token, `Monday network error: ${messageOf(error)}`), true);
    }

    if (!response.ok) {
      // Do not copy response bodies into exceptions: they can echo submitted
      // names, addresses, phone numbers, or column values.
      throw new MondayTransportError(`Monday API returned HTTP ${response.status}`, response.status === 429 || response.status >= 500);
    }

    let parsed: { data?: T; errors?: Array<{ message?: string; extensions?: { code?: string } }> };
    try {
      parsed = (await response.json()) as typeof parsed;
    } catch {
      throw new MondayTransportError("Monday API returned invalid JSON", true);
    }
    if (parsed.errors?.length) {
      const codes = parsed.errors.map((entry) => entry.extensions?.code ?? "unknown").join(",");
      const retryable = parsed.errors.some((entry) => /rate|timeout|internal|temporar/i.test(`${entry.extensions?.code ?? ""} ${entry.message ?? ""}`));
      throw new MondayTransportError(`Monday GraphQL error (${redact(codes).slice(0, 120)})`, retryable);
    }
    if (!parsed.data) throw new MondayTransportError("Monday API returned no data", true);
    return parsed.data;
  }

  return {
    async readItem(boardId, itemId, columnIds) {
      const data = await request<{
        items: Array<{ id: string; board: { id: string }; column_values: Array<{ id: string; text: string | null }> }>;
      }>(READ_ITEM, { itemId, columns: columnIds });
      const item = data.items?.[0];
      if (!item) return null;
      const values = Object.fromEntries(item.column_values.map((column) => [column.id, column.text]));
      return { id: item.id, boardId: item.board.id, values };
    },

    async writeColumns(boardId, itemId, values) {
      await request<{ change_multiple_column_values: { id: string } }>(WRITE_COLUMNS, {
        boardId,
        itemId,
        values: JSON.stringify(values),
      });
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeMessage(token: MondayToken, message: string): string {
  return redact(token.redact(message)).slice(0, 300);
}
