/** Guarded queue processor for outbound Monday updates. */
import { recordAudit } from "../domain/audit.ts";
import { nowIso } from "../platform/ids.ts";
import type { Db, PortalEnv } from "../platform/types.ts";
import { redact, workerSecretTokenSource } from "./monday-credentials.ts";
import { createMondayWriteTransport, MondayTransportError, type MondayWriteTransport } from "./monday-write-transport.ts";
import type { MondayBoardKey } from "./monday.ts";

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 15 * 60 * 1000;

/** Logical payload keys are code-reviewed. Environment configuration may map
 * these keys to Monday column ids, but cannot add new writable data fields. */
export const MONDAY_WRITABLE_FIELDS: Record<MondayBoardKey, readonly string[]> = {
  homes: ["status", "address", "subdivision", "lot_number", "delivery_status"],
  equipment: ["status", "hour_meter", "odometer", "service_due_on", "assigned_to"],
  jobs: ["status", "subdivision", "lot_number", "address"],
  tasks: ["status", "assignee", "due_date", "title"],
  repairs: ["status", "bill_back_status", "responsible_party", "parts_needed", "labor_minutes"],
};

export interface BoardWriteMapping {
  boardId: string;
  columns: Record<string, string>;
}

export type MondayWriteMappings = Partial<Record<MondayBoardKey, BoardWriteMapping>>;

export interface SyncActor {
  employeeId?: string | null;
  email: string;
}

export interface MondaySyncSummary {
  enabled: boolean;
  examined: number;
  sent: number;
  alreadyApplied: number;
  retried: number;
  conflicts: number;
  failed: number;
  skipped: number;
}

interface QueueRow {
  id: string;
  link_id: string | null;
  entity_type: string;
  entity_id: string;
  operation: string;
  payload: string;
  attempts: number;
}

interface LinkedTarget {
  link_id: string;
  board_key: MondayBoardKey;
  monday_board_id: string;
  monday_item_id: string;
  sync_state: string;
}

export function mondayWriteEnabled(env: Pick<PortalEnv, "MONDAY_WRITE_SYNC_ENABLED">): boolean {
  return env.MONDAY_WRITE_SYNC_ENABLED === "true";
}

export function parseMondayWriteMappings(raw: string | undefined): MondayWriteMappings {
  if (!raw) throw new Error("MONDAY_SYNC_MAPPINGS is required when Monday write sync is enabled");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("MONDAY_SYNC_MAPPINGS must be valid JSON");
  }
  if (!isObject(parsed)) throw new Error("MONDAY_SYNC_MAPPINGS must be an object");

  const output: MondayWriteMappings = {};
  for (const [boardKey, rawMapping] of Object.entries(parsed)) {
    if (!(boardKey in MONDAY_WRITABLE_FIELDS)) throw new Error(`Monday write mapping contains unknown board ${boardKey}`);
    if (!isObject(rawMapping) || !/^\d+$/.test(String(rawMapping.boardId ?? "")) || !isObject(rawMapping.columns)) {
      throw new Error(`Monday write mapping for ${boardKey} is invalid`);
    }
    const allowed = new Set(MONDAY_WRITABLE_FIELDS[boardKey as MondayBoardKey]);
    const columns: Record<string, string> = {};
    const targets = new Set<string>();
    for (const [logical, columnIdValue] of Object.entries(rawMapping.columns)) {
      const columnId = String(columnIdValue);
      if (!allowed.has(logical)) throw new Error(`${logical} is not an allowlisted ${boardKey} write field`);
      if (!/^[A-Za-z0-9_]+$/.test(columnId)) throw new Error(`Invalid Monday column id for ${boardKey}.${logical}`);
      if (targets.has(columnId)) throw new Error(`Monday column ${columnId} is mapped more than once on ${boardKey}`);
      targets.add(columnId);
      columns[logical] = columnId;
    }
    output[boardKey as MondayBoardKey] = { boardId: String(rawMapping.boardId), columns };
  }
  return output;
}

export async function runConfiguredMondaySync(
  env: PortalEnv,
  options: { actor?: SyncActor; limit?: number; transport?: MondayWriteTransport; now?: Date } = {},
): Promise<MondaySyncSummary> {
  if (!mondayWriteEnabled(env)) return emptySummary(false);
  if (!env.MONDAY_API_TOKEN) throw new Error("MONDAY_API_TOKEN Worker secret is required when Monday write sync is enabled");
  const mappings = parseMondayWriteMappings(env.MONDAY_SYNC_MAPPINGS);
  const transport = options.transport ?? createMondayWriteTransport(workerSecretTokenSource(env.MONDAY_API_TOKEN));
  return drainMondaySyncQueue(env.PORTAL_DB, transport, mappings, { ...options, enabled: true });
}

export async function drainMondaySyncQueue(
  db: Db,
  transport: MondayWriteTransport,
  mappings: MondayWriteMappings,
  options: { enabled?: boolean; actor?: SyncActor; limit?: number; now?: Date } = {},
): Promise<MondaySyncSummary> {
  if (options.enabled !== true) return emptySummary(false);
  const now = options.now ?? new Date();
  const nowText = now.toISOString();
  const stale = new Date(now.getTime() - STALE_LOCK_MS).toISOString();
  await db
    .prepare(
      `UPDATE monday_sync_queue SET status = 'retry', locked_at = NULL, next_attempt_at = ?,
          last_error = 'Recovered stale processing lock'
        WHERE status = 'processing' AND locked_at < ?`,
    )
    .bind(nowText, stale)
    .run();

  const rows = await db
    .prepare(
      `SELECT id, link_id, entity_type, entity_id, operation, payload, attempts
         FROM monday_sync_queue
        WHERE status = 'queued' OR (status = 'retry' AND (next_attempt_at IS NULL OR next_attempt_at <= ?))
        ORDER BY created_at, rowid LIMIT ?`,
    )
    .bind(nowText, Math.min(Math.max(options.limit ?? 25, 1), 100))
    .all<QueueRow>();

  const summary = emptySummary(true);
  for (const candidate of rows.results) {
    const claim = await db
      .prepare(
        `UPDATE monday_sync_queue SET status = 'processing', attempts = attempts + 1, locked_at = ?
          WHERE id = ? AND (status = 'queued' OR (status = 'retry' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)))`,
      )
      .bind(nowText, candidate.id, nowText)
      .run();
    if ((claim.meta.changes ?? 0) !== 1) continue;
    summary.examined += 1;
    const row = { ...candidate, attempts: candidate.attempts + 1 };
    await processOne(db, transport, mappings, row, summary, options.actor, now);
  }
  return summary;
}

async function processOne(
  db: Db,
  transport: MondayWriteTransport,
  mappings: MondayWriteMappings,
  row: QueueRow,
  summary: MondaySyncSummary,
  actor: SyncActor | undefined,
  now: Date,
): Promise<void> {
  try {
    // Link/detach only maintain the portal correspondence. Deleting or creating
    // Monday items is deliberately outside this processor's authority.
    if (row.operation !== "push") {
      await finish(db, row.id, "skipped", "Portal link operation; no remote write", nowIso());
      summary.skipped += 1;
      await auditResult(db, row, actor, "allowed", "skipped local link operation");
      return;
    }

    const target = await linkedTarget(db, row);
    if (!target || target.sync_state === "detached") return await markConflict(db, row, summary, actor, "linked target is missing or detached");
    const mapping = mappings[target.board_key];
    if (!mapping) return await markFailure(db, row, summary, actor, `no allowlist mapping for ${target.board_key}`);
    if (mapping.boardId !== target.monday_board_id) {
      return await markConflict(db, row, summary, actor, `configured board id does not match the portal registry for ${target.board_key}`);
    }

    const envelope = parsePayload(row.payload);
    const desired: Record<string, unknown> = {};
    const expected: Record<string, unknown> = {};
    for (const [logicalKey, value] of Object.entries(envelope.values)) {
      const columnId = mapping.columns[logicalKey];
      if (!columnId) return await markFailure(db, row, summary, actor, `${logicalKey} is not mapped and allowlisted for ${target.board_key}`);
      desired[columnId] = value;
      if (envelope.expectedRemote && Object.hasOwn(envelope.expectedRemote, logicalKey)) expected[columnId] = envelope.expectedRemote[logicalKey];
    }
    const columnIds = Object.keys(desired);
    if (columnIds.length === 0) return await markFailure(db, row, summary, actor, "queued update has no writable fields");

    const remote = await transport.readItem(mapping.boardId, target.monday_item_id, columnIds);
    if (!remote || remote.boardId !== mapping.boardId || remote.id !== target.monday_item_id) {
      return await markConflict(db, row, summary, actor, "remote item is missing or belongs to a different board");
    }
    if (matches(remote.values, desired)) {
      await markSent(db, row, target, summary, actor, true);
      return;
    }
    if (columnIds.some((columnId) => !Object.hasOwn(expected, columnId))) {
      return await markConflict(db, row, summary, actor, "expected remote values were not supplied for every changed field");
    }
    if (!matches(remote.values, expected)) {
      return await markConflict(db, row, summary, actor, "remote values changed after this update was queued");
    }

    await transport.writeColumns(mapping.boardId, target.monday_item_id, desired);
    const verified = await transport.readItem(mapping.boardId, target.monday_item_id, columnIds);
    if (!verified || verified.boardId !== mapping.boardId || !matches(verified.values, desired)) {
      throw new MondayTransportError("Monday write could not be verified", true);
    }
    await markSent(db, row, target, summary, actor, false);
  } catch (error) {
    const safe = operationalError(error);
    if (error instanceof MondayTransportError && error.retryable && row.attempts < MAX_ATTEMPTS) {
      const next = new Date(now.getTime() + retryDelayMs(row.attempts)).toISOString();
      await db
        .prepare("UPDATE monday_sync_queue SET status = 'retry', locked_at = NULL, next_attempt_at = ?, last_error = ? WHERE id = ?")
        .bind(next, safe, row.id)
        .run();
      summary.retried += 1;
      await auditResult(db, row, actor, "denied", `retry scheduled after attempt ${row.attempts}`);
      return;
    }
    await markFailure(db, row, summary, actor, safe);
  }
}

async function linkedTarget(db: Db, row: QueueRow): Promise<LinkedTarget | null> {
  return db
    .prepare(
      `SELECT l.id AS link_id, l.board_key, b.monday_board_id, l.monday_item_id, l.sync_state
         FROM monday_links l JOIN monday_boards b ON b.board_key = l.board_key AND b.active = 1
        WHERE l.id = ? AND l.entity_type = ? AND l.entity_id = ?`,
    )
    .bind(row.link_id, row.entity_type, row.entity_id)
    .first<LinkedTarget>();
}

function parsePayload(raw: string): { values: Record<string, unknown>; expectedRemote: Record<string, unknown> | null } {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("queued payload is not valid JSON");
  }
  if (!isObject(value)) throw new Error("queued payload must be an object");
  if (isObject(value.values)) {
    return { values: value.values, expectedRemote: isObject(value.expected_remote) ? value.expected_remote : null };
  }
  // Legacy queue rows are readable, but without an expected snapshot they will
  // fail closed unless Monday already contains the desired value.
  return { values: value, expectedRemote: null };
}

function matches(actual: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) => comparable(actual[key]) === comparable(value));
}

function comparable(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  return JSON.stringify(value);
}

async function markSent(
  db: Db,
  row: QueueRow,
  target: LinkedTarget,
  summary: MondaySyncSummary,
  actor: SyncActor | undefined,
  alreadyApplied: boolean,
): Promise<void> {
  const timestamp = nowIso();
  await db.batch([
    db.prepare("UPDATE monday_sync_queue SET status = 'sent', locked_at = NULL, next_attempt_at = NULL, last_error = NULL, processed_at = ? WHERE id = ?").bind(timestamp, row.id),
    db.prepare("UPDATE monday_links SET sync_state = 'linked', last_synced_at = ?, last_error = NULL, updated_at = ? WHERE id = ?").bind(timestamp, timestamp, target.link_id),
  ]);
  if (alreadyApplied) summary.alreadyApplied += 1;
  else summary.sent += 1;
  await auditResult(db, row, actor, "allowed", alreadyApplied ? "idempotent: values already applied" : "remote update sent and verified");
}

async function markConflict(
  db: Db,
  row: QueueRow,
  summary: MondaySyncSummary,
  actor: SyncActor | undefined,
  detail: string,
): Promise<void> {
  const safe = operationalError(detail);
  const timestamp = nowIso();
  await db.batch([
    db.prepare("UPDATE monday_sync_queue SET status = 'conflict', locked_at = NULL, last_error = ?, processed_at = ? WHERE id = ?").bind(safe, timestamp, row.id),
    db.prepare("UPDATE monday_links SET sync_state = 'conflict', last_error = ?, updated_at = ? WHERE id = ?").bind(safe, timestamp, row.link_id),
  ]);
  summary.conflicts += 1;
  await auditResult(db, row, actor, "denied", `conflict: ${safe}`);
}

async function markFailure(
  db: Db,
  row: QueueRow,
  summary: MondaySyncSummary,
  actor: SyncActor | undefined,
  detail: string,
): Promise<void> {
  const safe = operationalError(detail);
  await finish(db, row.id, "failed", safe, nowIso());
  if (row.link_id) {
    await db.prepare("UPDATE monday_links SET last_error = ?, updated_at = ? WHERE id = ?").bind(safe, nowIso(), row.link_id).run();
  }
  summary.failed += 1;
  await auditResult(db, row, actor, "denied", `failed: ${safe}`);
}

async function finish(db: Db, id: string, status: "failed" | "skipped", detail: string, timestamp: string): Promise<void> {
  await db
    .prepare("UPDATE monday_sync_queue SET status = ?, locked_at = NULL, next_attempt_at = NULL, last_error = ?, processed_at = ? WHERE id = ?")
    .bind(status, detail, timestamp, id)
    .run();
}

async function auditResult(
  db: Db,
  row: QueueRow,
  actor: SyncActor | undefined,
  outcome: "allowed" | "denied",
  detail: string,
): Promise<void> {
  try {
    await recordAudit(db, {
      actorEmployeeId: actor?.employeeId,
      actorEmail: actor?.email ?? "system:monday-sync",
      action: "monday.sync.process",
      entityType: row.entity_type,
      entityId: row.entity_id,
      outcome,
      detail: `queue ${row.id}: ${operationalError(detail)}`,
      requestId: row.id,
    });
  } catch (error) {
    console.error("Monday sync audit write failed", operationalError(error));
  }
}

function operationalError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return redact(raw)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]")
    .slice(0, 300);
}

function retryDelayMs(attempt: number): number {
  return [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000][Math.min(Math.max(attempt - 1, 0), 3)];
}

function emptySummary(enabled: boolean): MondaySyncSummary {
  return { enabled, examined: 0, sent: 0, alreadyApplied: 0, retried: 0, conflicts: 0, failed: 0, skipped: 0 };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
