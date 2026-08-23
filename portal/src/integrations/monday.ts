/**
 * Monday.com synchronization — abstraction only.
 *
 * There is no live Monday integration in this portal and nothing here makes a
 * network call. What it does is hold the one thing a future sync worker cannot
 * reconstruct on its own: which Home Placer record corresponds to which Monday
 * item.
 *
 * The correspondence is keyed on a canonical business key — the home's serial
 * number, the machine's VIN or serial number, the job number, the ticket number
 * — never on a portal row id and never on an item's name. A `MondaySyncPort`
 * receives the changes a real integration would push. The only implementation
 * shipped here writes them to `monday_sync_queue` and stops.
 *
 * Wiring a real integration later means implementing `MondaySyncPort` against
 * the Monday GraphQL API and draining that queue. Nothing above this file has
 * to change.
 */
import { badRequest, conflict, notFound } from "../platform/errors.ts";
import { canonicalKey, newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";

export const MONDAY_ENTITY_TYPES = ["home", "asset", "job", "work_task", "repair_ticket"] as const;
export type MondayEntityType = (typeof MONDAY_ENTITY_TYPES)[number];

export const MONDAY_BOARD_KEYS = ["homes", "equipment", "jobs", "tasks", "repairs"] as const;
export type MondayBoardKey = (typeof MONDAY_BOARD_KEYS)[number];

export type CanonicalKeyKind = "serial_number" | "vin" | "asset_tag" | "job_number" | "ticket_number";
/** How a board finds candidates. Individual links always retain their actual canonical key kind. */
export type MondayBoardMatchMode = "canonical" | "vin_or_serial";
export type DiscoveryKeyKind = CanonicalKeyKind | "vin_or_serial";

export interface MondayBoardRow {
  board_key: string;
  monday_board_id: string;
  name: string;
  canonical_key_kind: string;
  active: number;
  match_mode?: MondayBoardMatchMode;
}

export interface MondayLinkRow {
  id: string;
  entity_type: string;
  entity_id: string;
  canonical_key: string;
  board_key: string;
  monday_item_id: string;
  sync_state: string;
  last_synced_at: string | null;
  last_error: string | null;
  updated_at: string;
}

export interface MondaySyncChange {
  entityType: MondayEntityType;
  entityId: string;
  canonicalKey: string;
  boardKey: MondayBoardKey;
  operation: "link" | "push" | "detach";
  /** Column values a real integration would send. Serialized as JSON. */
  payload: Record<string, unknown>;
}

/** What a real Monday client would have to implement. */
export interface MondaySyncPort {
  enqueue(change: MondaySyncChange): Promise<string>;
}

/**
 * The only port that ships. It records intent and never leaves the database, so
 * the portal is safe to run with no Monday credentials of any kind.
 */
export class QueuedMondaySyncPort implements MondaySyncPort {
  readonly #db: Db;
  constructor(db: Db) {
    this.#db = db;
  }

  async enqueue(change: MondaySyncChange): Promise<string> {
    const link = await getLink(this.#db, change.entityType, change.entityId);
    const id = newId("msq");
    await this.#db
      .prepare(
        `INSERT INTO monday_sync_queue (id, link_id, entity_type, entity_id, canonical_key, operation, payload, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
      )
      .bind(
        id,
        link?.id ?? null,
        change.entityType,
        change.entityId,
        change.canonicalKey,
        change.operation,
        JSON.stringify(change.payload),
        nowIso(),
      )
      .run();
    return id;
  }
}

const KEY_KIND_BY_BOARD: Record<MondayBoardKey, CanonicalKeyKind[]> = {
  homes: ["serial_number"],
  equipment: ["vin", "serial_number", "asset_tag"],
  jobs: ["job_number"],
  tasks: ["job_number", "ticket_number"],
  repairs: ["ticket_number"],
};

export async function listBoards(db: Db): Promise<MondayBoardRow[]> {
  const rows = await db
    .prepare(
      `SELECT b.*, coalesce(m.match_mode, 'canonical') AS match_mode
         FROM monday_boards b
         LEFT JOIN monday_board_match_modes m ON m.board_key = b.board_key
        ORDER BY b.board_key`,
    )
    .all<MondayBoardRow>();
  return rows.results;
}

export async function upsertBoard(
  db: Db,
  input: {
    boardKey: MondayBoardKey;
    mondayBoardId: string;
    name: string;
    canonicalKeyKind: CanonicalKeyKind;
    matchMode?: MondayBoardMatchMode;
  },
): Promise<void> {
  if (!(MONDAY_BOARD_KEYS as readonly string[]).includes(input.boardKey)) throw badRequest("Unknown board");
  if (!/^\d+$/.test(input.mondayBoardId.trim())) throw badRequest("A Monday board id is numeric");
  if (!KEY_KIND_BY_BOARD[input.boardKey].includes(input.canonicalKeyKind)) {
    const kinds = KEY_KIND_BY_BOARD[input.boardKey].map((kind) => kind.replace(/_/g, " ")).join(" or ");
    throw badRequest(`The ${input.boardKey} board must key on ${kinds}`);
  }
  const matchMode = input.matchMode ?? "canonical";
  if (matchMode === "vin_or_serial" && input.boardKey !== "equipment") {
    throw badRequest("Only the equipment board can match on VIN or serial number");
  }
  if (matchMode === "vin_or_serial" && !["vin", "serial_number"].includes(input.canonicalKeyKind)) {
    throw badRequest("A VIN-or-serial equipment board must use VIN or serial number as its primary key");
  }
  await db
    .prepare(
      `INSERT INTO monday_boards (board_key, monday_board_id, name, canonical_key_kind, active, created_at)
       VALUES (?, ?, ?, ?, 1, ?)
       ON CONFLICT (board_key) DO UPDATE SET monday_board_id = excluded.monday_board_id,
                                             name = excluded.name,
                                             canonical_key_kind = excluded.canonical_key_kind`,
    )
    .bind(input.boardKey, input.mondayBoardId.trim(), input.name.trim(), input.canonicalKeyKind, nowIso())
    .run();
  await db
    .prepare(
      `INSERT INTO monday_board_match_modes (board_key, match_mode, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (board_key) DO UPDATE SET match_mode = excluded.match_mode, updated_at = excluded.updated_at`,
    )
    .bind(input.boardKey, matchMode, nowIso(), nowIso())
    .run();
}

/**
 * Reads the canonical key straight off the record. If the record has no durable
 * key there is nothing to sync on, and the caller gets an error rather than a
 * link built on a mutable field.
 */
export async function canonicalKeyFor(db: Db, entityType: MondayEntityType, entityId: string): Promise<{ key: string; kind: CanonicalKeyKind }> {
  if (entityType === "home") {
    const row = await db.prepare("SELECT serial_number FROM homes WHERE id = ?").bind(entityId).first<{ serial_number: string }>();
    if (!row) throw notFound("Home not found");
    return { key: canonicalKey(row.serial_number), kind: "serial_number" };
  }
  if (entityType === "asset") {
    const row = await db
      .prepare("SELECT vin, serial_number, asset_tag FROM assets WHERE id = ?")
      .bind(entityId)
      .first<{ vin: string | null; serial_number: string | null; asset_tag: string }>();
    if (!row) throw notFound("Equipment not found");
    if (row.vin) return { key: canonicalKey(row.vin), kind: "vin" };
    if (row.serial_number) return { key: canonicalKey(row.serial_number), kind: "serial_number" };
    return { key: canonicalKey(row.asset_tag), kind: "asset_tag" };
  }
  if (entityType === "job") {
    const row = await db.prepare("SELECT job_number FROM jobs WHERE id = ?").bind(entityId).first<{ job_number: string }>();
    if (!row) throw notFound("Job not found");
    return { key: canonicalKey(row.job_number), kind: "job_number" };
  }
  if (entityType === "repair_ticket") {
    const row = await db.prepare("SELECT ticket_number FROM repair_tickets WHERE id = ?").bind(entityId).first<{ ticket_number: string }>();
    if (!row) throw notFound("Repair ticket not found");
    return { key: canonicalKey(row.ticket_number), kind: "ticket_number" };
  }
  const row = await db
    .prepare("SELECT t.id, j.job_number FROM work_tasks t LEFT JOIN jobs j ON j.id = t.job_id WHERE t.id = ?")
    .bind(entityId)
    .first<{ id: string; job_number: string | null }>();
  if (!row) throw notFound("Task not found");
  if (!row.job_number) throw badRequest("Attach the task to a job before linking it to Monday");
  return { key: canonicalKey(row.job_number), kind: "job_number" };
}

export async function getLink(db: Db, entityType: MondayEntityType, entityId: string): Promise<MondayLinkRow | null> {
  return db
    .prepare("SELECT * FROM monday_links WHERE entity_type = ? AND entity_id = ?")
    .bind(entityType, entityId)
    .first<MondayLinkRow>();
}

export async function findByCanonicalKey(db: Db, key: string): Promise<MondayLinkRow[]> {
  const rows = await db
    .prepare("SELECT * FROM monday_links WHERE canonical_key = ? ORDER BY entity_type")
    .bind(canonicalKey(key))
    .all<MondayLinkRow>();
  return rows.results;
}

export interface LinkInput {
  entityType: MondayEntityType;
  entityId: string;
  boardKey: MondayBoardKey;
  mondayItemId: string;
}

/**
 * Records the correspondence between one portal record and one Monday item.
 * Both directions are unique: a record links to at most one item, and an item
 * is claimed by at most one record.
 */
export async function linkEntity(db: Db, port: MondaySyncPort, input: LinkInput): Promise<string> {
  if (!(MONDAY_ENTITY_TYPES as readonly string[]).includes(input.entityType)) throw badRequest("Unknown record type");
  const itemId = input.mondayItemId.trim();
  if (!/^\d+$/.test(itemId)) throw badRequest("A Monday item id is numeric");

  const board = await db
    .prepare(
      `SELECT b.*, coalesce(m.match_mode, 'canonical') AS match_mode
         FROM monday_boards b LEFT JOIN monday_board_match_modes m ON m.board_key = b.board_key
        WHERE b.board_key = ? AND b.active = 1`,
    )
    .bind(input.boardKey)
    .first<MondayBoardRow>();
  if (!board) throw badRequest(`The ${input.boardKey} board has not been configured yet`);

  const { key, kind } = await canonicalKeyFor(db, input.entityType, input.entityId);
  const acceptsKind = board.match_mode === "vin_or_serial"
    ? kind === "vin" || kind === "serial_number"
    : board.canonical_key_kind === kind;
  if (!acceptsKind) {
    throw conflict(`That board keys on ${board.canonical_key_kind.replace("_", " ")}, but this record's key is a ${kind.replace("_", " ")}`);
  }

  const claimed = await db
    .prepare("SELECT entity_type, entity_id FROM monday_links WHERE board_key = ? AND monday_item_id = ?")
    .bind(input.boardKey, itemId)
    .first<{ entity_type: string; entity_id: string }>();
  if (claimed && claimed.entity_id !== input.entityId) {
    throw conflict(`Monday item ${itemId} is already linked to another ${claimed.entity_type.replace("_", " ")}`);
  }

  const timestamp = nowIso();
  const existing = await getLink(db, input.entityType, input.entityId);
  const id = existing?.id ?? newId("mlk");

  if (existing) {
    await db
      .prepare(
        `UPDATE monday_links SET canonical_key = ?, board_key = ?, monday_item_id = ?, sync_state = 'linked',
                                 last_error = NULL, updated_at = ? WHERE id = ?`,
      )
      .bind(key, input.boardKey, itemId, timestamp, id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO monday_links (id, entity_type, entity_id, canonical_key, board_key, monday_item_id, sync_state, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'linked', ?, ?)`,
      )
      .bind(id, input.entityType, input.entityId, key, input.boardKey, itemId, timestamp, timestamp)
      .run();
  }

  // 0001 keeps a monday_item_id column on each table; mirror it so the two
  // never disagree.
  await mirrorItemId(db, input.entityType, input.entityId, itemId);

  await port.enqueue({
    entityType: input.entityType,
    entityId: input.entityId,
    canonicalKey: key,
    boardKey: input.boardKey,
    operation: "link",
    payload: { monday_item_id: itemId, canonical_key: key, canonical_key_kind: kind },
  });
  return id;
}

export async function detachEntity(db: Db, port: MondaySyncPort, entityType: MondayEntityType, entityId: string): Promise<void> {
  const link = await getLink(db, entityType, entityId);
  if (!link) throw notFound("That record is not linked to Monday");
  await db
    .prepare("UPDATE monday_links SET sync_state = 'detached', updated_at = ? WHERE id = ?")
    .bind(nowIso(), link.id)
    .run();
  await mirrorItemId(db, entityType, entityId, null);
  await port.enqueue({
    entityType,
    entityId,
    canonicalKey: link.canonical_key,
    boardKey: link.board_key as MondayBoardKey,
    operation: "detach",
    payload: { monday_item_id: link.monday_item_id },
  });
}

/** Queues a field update for a linked record. Unlinked records are ignored. */
export async function queuePush(
  db: Db,
  port: MondaySyncPort,
  entityType: MondayEntityType,
  entityId: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const link = await getLink(db, entityType, entityId);
  if (!link || link.sync_state === "detached") return null;
  return port.enqueue({
    entityType,
    entityId,
    canonicalKey: link.canonical_key,
    boardKey: link.board_key as MondayBoardKey,
    operation: "push",
    payload,
  });
}

async function mirrorItemId(db: Db, entityType: MondayEntityType, entityId: string, itemId: string | null): Promise<void> {
  const table = {
    home: "homes",
    asset: "assets",
    job: "jobs",
    work_task: "work_tasks",
    repair_ticket: "repair_tickets",
  }[entityType];
  await db.prepare(`UPDATE ${table} SET monday_item_id = ? WHERE id = ?`).bind(itemId, entityId).run();
}

export interface SyncQueueRow {
  id: string;
  entity_type: string;
  entity_id: string;
  canonical_key: string;
  operation: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

export async function pendingSyncQueue(db: Db, limit = 100): Promise<SyncQueueRow[]> {
  const rows = await db
    .prepare("SELECT * FROM monday_sync_queue ORDER BY status <> 'queued', created_at DESC LIMIT ?")
    .bind(limit)
    .all<SyncQueueRow>();
  return rows.results;
}

export interface LinkOverview extends MondayLinkRow {
  label: string;
}

export async function linkOverview(db: Db): Promise<LinkOverview[]> {
  const rows = await db
    .prepare(
      `SELECT l.*, coalesce(h.serial_number, a.asset_tag, j.job_number, r.ticket_number, t.title, l.entity_id) AS label
         FROM monday_links l
         LEFT JOIN homes h ON l.entity_type = 'home' AND h.id = l.entity_id
         LEFT JOIN assets a ON l.entity_type = 'asset' AND a.id = l.entity_id
         LEFT JOIN jobs j ON l.entity_type = 'job' AND j.id = l.entity_id
         LEFT JOIN repair_tickets r ON l.entity_type = 'repair_ticket' AND r.id = l.entity_id
         LEFT JOIN work_tasks t ON l.entity_type = 'work_task' AND t.id = l.entity_id
        ORDER BY l.entity_type, label`,
    )
    .all<LinkOverview>();
  return rows.results;
}

export interface DiscoveryRunRow {
  id: string;
  board_key: string;
  mode: string;
  started_at: string;
  finished_at: string | null;
  items_seen: number;
  matched: number;
  ambiguous: number;
  unmatched: number;
  conflicts: number;
  links_written: number;
  error: string | null;
}

/** Recent read-only discovery runs, for the admin page. */
export async function pendingMondayRuns(db: Db, limit = 20): Promise<DiscoveryRunRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, board_key, mode, started_at, finished_at, items_seen, matched, ambiguous,
              unmatched, conflicts, links_written, error
         FROM monday_discovery_runs ORDER BY started_at DESC, rowid DESC LIMIT ?`,
    )
    .bind(limit)
    .all<DiscoveryRunRow>();
  return rows.results;
}
