/** Read-only import of the employee Homes Roster into the portal. */
import { newId, nowIso } from "../platform/ids.ts";
import type { Db, PortalEnv } from "../platform/types.ts";
import { createMondayClient, type MondayClient } from "./monday-client.ts";
import { workerSecretTokenSource } from "./monday-credentials.ts";

export const DEFAULT_HOMES_ROSTER_BOARD_ID = "18419219855";
const PAGE_SIZE = 100;
const INCLUDED_STAGES = new Set(["active", "sold", "closed", "pending"]);

export interface MondayHomeColumn {
  id: string;
  title: string;
  type?: string;
}

export interface MondayHomeItem {
  id: string;
  name: string;
  updated_at?: string | null;
  group?: { id: string; title: string } | null;
  column_values?: { id: string; text: string | null; value?: string | null; type?: string }[];
}

export interface MondayHomeBoard {
  id: string;
  name: string;
  columns: MondayHomeColumn[];
  items: MondayHomeItem[];
}

export interface MondayHomeImportSummary {
  enabled: boolean;
  boardItems: number;
  eligible: number;
  created: number;
  updated: number;
  unchanged: number;
  excluded: number;
  conflicts: number;
}

interface MondayBoardPayload {
  id: string;
  name: string;
  columns?: MondayHomeColumn[];
  items_page?: { cursor: string | null; items: MondayHomeItem[] };
}

const FIRST_PAGE_QUERY = `
  query PortalHomesRoster($boardId: ID!, $limit: Int!) {
    boards(ids: [$boardId]) {
      id
      name
      columns { id title type }
      items_page(limit: $limit) {
        cursor
        items {
          id
          name
          updated_at
          group { id title }
          column_values { id text value type }
        }
      }
    }
  }`;

const NEXT_PAGE_QUERY = `
  query PortalHomesRosterNext($cursor: String!, $limit: Int!) {
    next_items_page(cursor: $cursor, limit: $limit) {
      cursor
      items {
        id
        name
        updated_at
        group { id title }
        column_values { id text value type }
      }
    }
  }`;

/** Reads every page before returning so a partial response is never applied. */
export async function fetchMondayHomesBoard(client: MondayClient, boardId: string): Promise<MondayHomeBoard> {
  const first = await client.query<{ boards: MondayBoardPayload[] }>(FIRST_PAGE_QUERY, { boardId, limit: PAGE_SIZE });
  const board = first.boards?.[0];
  if (!board) throw new Error("Monday Homes Roster board was not found");
  const items = [...(board.items_page?.items ?? [])];
  let cursor = board.items_page?.cursor ?? null;
  while (cursor) {
    const page = await client.query<{ next_items_page: { cursor: string | null; items: MondayHomeItem[] } }>(
      NEXT_PAGE_QUERY,
      { cursor, limit: PAGE_SIZE },
    );
    items.push(...(page.next_items_page?.items ?? []));
    cursor = page.next_items_page?.cursor ?? null;
  }
  return { id: board.id, name: board.name, columns: board.columns ?? [], items };
}

export function mondayHomesImportEnabled(env: Pick<PortalEnv, "MONDAY_HOMES_IMPORT_ENABLED">): boolean {
  return env.MONDAY_HOMES_IMPORT_ENABLED === "true";
}

export async function runConfiguredMondayHomesImport(
  env: PortalEnv,
  options: { client?: MondayClient; now?: Date } = {},
): Promise<MondayHomeImportSummary> {
  if (!mondayHomesImportEnabled(env)) return emptySummary(false);
  if (!env.MONDAY_API_TOKEN) throw new Error("MONDAY_API_TOKEN Worker secret is required for the read-only Homes Roster import");
  const client = options.client ?? createMondayClient(workerSecretTokenSource(env.MONDAY_API_TOKEN));
  const board = await fetchMondayHomesBoard(client, env.MONDAY_HOMES_BOARD_ID ?? DEFAULT_HOMES_ROSTER_BOARD_ID);
  return importMondayHomes(env.PORTAL_DB, board, options.now ?? new Date());
}

/**
 * Reconciles eligible Monday rows by immutable Monday item id. Monday is the
 * source of truth for the imported snapshot and source identity/address; the
 * portal remains the source of truth for checklists, repairs, inspections,
 * documents, lots, and employee-entered operational status.
 */
export async function importMondayHomes(db: Db, board: MondayHomeBoard, now = new Date()): Promise<MondayHomeImportSummary> {
  if (!board.items.every((item) => /^\d+$/.test(item.id))) throw new Error("Monday returned an item without a numeric item id; import not applied");
  if (board.items.length === 0) throw new Error("Monday returned an empty Homes Roster; import not applied");
  const columnsById = new Map(board.columns.map((column) => [column.id, column]));
  const timestamp = now.toISOString();
  const summary = emptySummary(true);
  summary.boardItems = board.items.length;
  const seenIds = new Set<string>();

  for (const item of board.items) {
    seenIds.add(item.id);
    const values = (item.column_values ?? []).map((column) => ({
      id: column.id,
      title: columnsById.get(column.id)?.title ?? column.id,
      type: column.type ?? columnsById.get(column.id)?.type ?? null,
      text: column.text,
      value: parseColumnValue(column.value),
    }));
    const snapshot = JSON.stringify({
      itemId: item.id,
      name: item.name,
      updatedAt: item.updated_at ?? null,
      group: item.group ?? null,
      columns: values,
    });
    const columnsByTitle = new Map(values.map((column) => [normalizeLabel(column.title), column.text?.trim() ?? ""]));
    const serial = valueFor(columnsByTitle, ["serial #", "serial number", "serial no", "serial"]);
    const address = valueFor(columnsByTitle, ["address", "site address", "property address"]) || item.name.trim();
    const statusText = valueFor(columnsByTitle, ["stage", "status"]);
    const groupTitle = item.group?.title?.trim() ?? "";
    const stage = normalizeStage(statusText || groupTitle);

    // Rows with an explicit source stage are eligible only for the categories
    // Brandon selected. Unknown or inconsistent status labels stay out of the
    // import and are counted for the next review.
    const storedSerial = serial || `PENDING-MON-${item.id}`;
    const existingByMonday = await db
      .prepare("SELECT id, serial_number, monday_item_id, monday_source_json, manufacturer, model, model_year, section_count, hud_label_numbers FROM homes WHERE monday_item_id = ?")
      .bind(item.id)
      .first<ExistingHome>();
    const existingBySerial = serial
      ? await db.prepare("SELECT id, serial_number, monday_item_id, monday_source_json, manufacturer, model, model_year, section_count, hud_label_numbers FROM homes WHERE serial_number = ?").bind(serial).first<ExistingHome>()
      : null;

    if (!INCLUDED_STAGES.has(stage)) {
      summary.excluded += 1;
      // Keep tracking an already-imported home if its stage moves to another
      // category (for example, delivered). Only the initial import is filtered.
      if (!existingByMonday) continue;
    } else {
      summary.eligible += 1;
    }

    if (existingByMonday && existingBySerial && existingByMonday.id !== existingBySerial.id) {
      summary.conflicts += 1;
      continue;
    }
    const existing = existingByMonday ?? existingBySerial;
    if (existing && existing.monday_item_id && existing.monday_item_id !== item.id) {
      summary.conflicts += 1;
      continue;
    }
    if (existing?.monday_source_json === snapshot && existing.serial_number === storedSerial) {
      await db.prepare("UPDATE homes SET monday_source_synced_at = ?, monday_source_missing = 0 WHERE id = ?")
        .bind(timestamp, existing.id).run();
      summary.unchanged += 1;
      continue;
    }

    if (existing) {
      try {
        await db.prepare(
          `UPDATE homes SET serial_number = ?, site_address = ?, monday_item_id = ?, monday_item_name = ?,
             monday_stage = ?, monday_source_group = ?, monday_source_json = ?, monday_source_updated_at = ?,
             monday_source_synced_at = ?, monday_source_missing = 0, identity_incomplete = ?, updated_at = ?
           WHERE id = ?`,
        ).bind(
          storedSerial, address || null, item.id, item.name.trim() || null, stage, groupTitle || null, snapshot,
          item.updated_at ?? null, timestamp, identityIncomplete(existing, serial), timestamp, existing.id,
        ).run();
      } catch (error) {
        if (isUniqueConflict(error)) { summary.conflicts += 1; continue; }
        throw error;
      }
      summary.updated += 1;
      continue;
    }

    const id = newId("hom");
    try {
      await db.prepare(
        `INSERT INTO homes (id, serial_number, site_address, monday_item_id, monday_item_name, monday_stage,
           monday_source_group, monday_source_json, monday_source_updated_at, monday_source_synced_at,
           monday_source_missing, status, identity_incomplete, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'delivery_pending', ?, ?, ?)`,
      ).bind(
        id, storedSerial, address || null, item.id, item.name.trim() || null, stage, groupTitle || null,
        snapshot, item.updated_at ?? null, timestamp, identityIncomplete(null, serial), timestamp, timestamp,
      ).run();
      summary.created += 1;
    } catch (error) {
      if (isUniqueConflict(error)) { summary.conflicts += 1; continue; }
      throw error;
    }
  }

  // Only mark unseen rows when the complete, successfully paginated source
  // board was fetched. Keep those records for repairs and history; never delete.
  const linked = await db.prepare("SELECT id, monday_item_id FROM homes WHERE monday_item_id IS NOT NULL").all<{ id: string; monday_item_id: string }>();
  for (const row of linked.results) {
    if (!seenIds.has(row.monday_item_id)) {
      await db.prepare("UPDATE homes SET monday_source_missing = 1 WHERE id = ?").bind(row.id).run();
    }
  }
  return summary;
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeStage(value: string): string {
  return value.trim().replace(/^\d+\s*[-–:]\s*/, "").toLowerCase();
}

function valueFor(columns: Map<string, string>, names: string[]): string {
  for (const name of names) {
    const value = columns.get(normalizeLabel(name));
    if (value) return value;
  }
  return "";
}

function parseColumnValue(value?: string | null): unknown {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return value; }
}

function isUniqueConflict(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|constraint.*unique/i.test(message);
}

function emptySummary(enabled: boolean): MondayHomeImportSummary {
  return { enabled, boardItems: 0, eligible: 0, created: 0, updated: 0, unchanged: 0, excluded: 0, conflicts: 0 };
}

interface ExistingHome {
  id: string;
  serial_number: string;
  monday_item_id: string | null;
  monday_source_json: string | null;
  manufacturer: string | null;
  model: string | null;
  model_year: number | null;
  section_count: number | null;
  hud_label_numbers: string | null;
}

function identityIncomplete(home: ExistingHome | null, serial: string): number {
  return serial && home?.manufacturer && home.model && home.model_year && home.section_count && home.hud_label_numbers ? 0 : 1;
}
