/**
 * Defects — the bridge between "something is wrong" and a repair ticket.
 *
 * Most are raised automatically by a failed inspection line; the rest come from
 * a crew member reporting damage from the field.
 */
import { badRequest, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import type { Actor } from "../auth/authz.ts";
import { notifyCategory } from "./notifications.ts";

export const DEFECT_SEVERITIES = ["minor", "major", "critical"] as const;

export interface DefectRow {
  id: string;
  summary: string;
  detail: string | null;
  severity: string;
  status: string;
  source: string;
  inspection_id: string | null;
  checklist_key: string | null;
  asset_id: string | null;
  home_id: string | null;
  job_id: string | null;
  repair_ticket_id: string | null;
  reported_by: string;
  created_at: string;
}

export interface DefectSummary extends DefectRow {
  reported_by_name: string;
  asset_tag: string | null;
  serial_number: string | null;
  ticket_number: string | null;
}

const DEFECT_SELECT = `
  SELECT d.*, e.display_name AS reported_by_name, a.asset_tag, h.serial_number, r.ticket_number
    FROM defects d
    JOIN employees e ON e.id = d.reported_by
    LEFT JOIN assets a ON a.id = d.asset_id
    LEFT JOIN homes h ON h.id = d.home_id
    LEFT JOIN repair_tickets r ON r.id = d.repair_ticket_id`;

export async function listDefects(
  db: Db,
  filter: { status?: string; assetId?: string; homeId?: string; openOnly?: boolean; limit?: number } = {},
): Promise<DefectSummary[]> {
  const rows = await db
    .prepare(
      `${DEFECT_SELECT}
        WHERE (?1 IS NULL OR d.status = ?1)
          AND (?2 IS NULL OR d.asset_id = ?2)
          AND (?3 IS NULL OR d.home_id = ?3)
          AND (?4 = 0 OR d.status = 'open')
        ORDER BY CASE d.severity WHEN 'critical' THEN 0 WHEN 'major' THEN 1 ELSE 2 END, d.created_at DESC
        LIMIT ?5`,
    )
    .bind(filter.status ?? null, filter.assetId ?? null, filter.homeId ?? null, filter.openOnly ? 1 : 0, filter.limit ?? 100)
    .all<DefectSummary>();
  return rows.results;
}

export async function getDefect(db: Db, defectId: string): Promise<DefectSummary | null> {
  return db.prepare(`${DEFECT_SELECT} WHERE d.id = ?`).bind(defectId).first<DefectSummary>();
}

export interface ReportDefectInput {
  summary: string;
  detail?: string | null;
  severity: (typeof DEFECT_SEVERITIES)[number];
  assetId?: string | null;
  homeId?: string | null;
  jobId?: string | null;
}

export async function reportDefect(db: Db, actor: Actor, input: ReportDefectInput): Promise<string> {
  if (!input.summary.trim()) throw badRequest("Describe what is wrong");
  if (!(DEFECT_SEVERITIES as readonly string[]).includes(input.severity)) throw badRequest("Choose a severity");
  if (!input.assetId && !input.homeId) throw badRequest("A defect has to name a home or a machine");

  const id = newId("dfc");
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO defects (id, summary, detail, severity, status, source, asset_id, home_id, job_id, reported_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', 'field_report', ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.summary.trim(),
      input.detail?.trim() || null,
      input.severity,
      input.assetId ?? null,
      input.homeId ?? null,
      input.jobId ?? null,
      actor.employeeId,
      timestamp,
      timestamp,
    )
    .run();

  await notifyCategory(db, {
    category: "defect_reported",
    severity: input.severity === "critical" ? "urgent" : "warning",
    title: `Field report: ${input.summary.trim()}`,
    body: `${actor.displayName} reported a ${input.severity} defect.`,
    relatedType: "defect",
    relatedId: id,
  });
  return id;
}

export async function resolveDefect(db: Db, actor: Actor, defectId: string, status: "resolved" | "dismissed", note?: string): Promise<void> {
  const defect = await getDefect(db, defectId);
  if (!defect) throw notFound("Defect not found");
  if (defect.status === "resolved" || defect.status === "dismissed") return;
  if (status === "dismissed" && !note?.trim()) throw badRequest("Say why the defect is being dismissed");

  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE defects SET status = ?, resolved_at = ?, detail = CASE WHEN ? IS NULL THEN detail ELSE ifnull(detail || char(10), '') || ? END, updated_at = ?
        WHERE id = ?`,
    )
    .bind(status, timestamp, note?.trim() || null, `${status === "dismissed" ? "Dismissed" : "Resolved"} by ${actor.displayName}: ${note?.trim() ?? ""}`, timestamp, defectId)
    .run();
}

/** Open critical or major defects, for the dashboard. */
export async function openDefectCounts(db: Db): Promise<{ critical: number; major: number; minor: number }> {
  const row = await db
    .prepare(
      `SELECT sum(severity = 'critical') AS critical, sum(severity = 'major') AS major, sum(severity = 'minor') AS minor
         FROM defects WHERE status = 'open'`,
    )
    .first<{ critical: number | null; major: number | null; minor: number | null }>();
  return { critical: row?.critical ?? 0, major: row?.major ?? 0, minor: row?.minor ?? 0 };
}
