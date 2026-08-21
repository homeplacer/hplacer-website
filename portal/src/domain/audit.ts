/** Append-only record of who did what, including refused attempts. */
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";

export interface AuditEntry {
  actorEmployeeId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  outcome: "allowed" | "denied";
  detail?: string | null;
  requestId?: string | null;
}

export async function recordAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db
    .prepare(
      `INSERT INTO audit_log (id, actor_employee_id, actor_email, action, entity_type, entity_id, outcome, detail, request_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      newId("aud"),
      entry.actorEmployeeId ?? null,
      entry.actorEmail ?? null,
      entry.action,
      entry.entityType,
      entry.entityId ?? null,
      entry.outcome,
      entry.detail ?? null,
      entry.requestId ?? null,
      nowIso(),
    )
    .run();
}

export interface AuditRow {
  id: string;
  actor_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  outcome: string;
  detail: string | null;
  created_at: string;
}

export async function recentAudit(db: Db, limit = 100): Promise<AuditRow[]> {
  const rows = await db
    .prepare(
      `SELECT id, actor_email, action, entity_type, entity_id, outcome, detail, created_at
         FROM audit_log ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .bind(limit)
    .all<AuditRow>();
  return rows.results;
}
