/**
 * A once-a-day, in-portal operational snapshot.
 *
 * This deliberately uses the same notification routing as every other
 * operational alert.  There is no external delivery transport here: the
 * digest is an inbox item, deduplicated per recipient and UTC calendar day.
 */
import { todayIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { fleetServiceDue } from "./assets.ts";
import { notifyCategory } from "./notifications.ts";

export interface DailyDigestSummary {
  openRepairs: number;
  readyToBill: number;
  openMaterialRequests: number;
  lowStockParts: number;
  openDefects: number;
  unreviewedWarrantyRequests: number;
  serviceDue: number;
}

async function count(db: Db, sql: string): Promise<number> {
  const row = await db.prepare(sql).first<{ n: number }>();
  return row?.n ?? 0;
}

/** Returns a point-in-time view of items that need operations attention. */
export async function dailyDigestSummary(db: Db, now: Date = new Date()): Promise<DailyDigestSummary> {
  const [openRepairs, readyToBill, openMaterialRequests, lowStockParts, openDefects, unreviewedWarrantyRequests, serviceDue] = await Promise.all([
    count(db, "SELECT count(*) AS n FROM repair_tickets WHERE status NOT IN ('closed', 'billed')"),
    count(db, "SELECT count(*) AS n FROM repair_tickets WHERE bill_back_status = 'ready_to_bill'"),
    count(db, "SELECT count(*) AS n FROM material_requests WHERE status IN ('requested', 'approved', 'ordered')"),
    count(db, "SELECT count(*) AS n FROM parts WHERE active = 1 AND quantity_on_hand <= reorder_point"),
    count(db, "SELECT count(*) AS n FROM defects WHERE status IN ('open', 'ticketed')"),
    count(db, "SELECT count(*) AS n FROM warranty_requests WHERE status = 'needs_review'"),
    fleetServiceDue(db, now).then((items) => items.length),
  ]);
  return { openRepairs, readyToBill, openMaterialRequests, lowStockParts, openDefects, unreviewedWarrantyRequests, serviceDue };
}

export function formatDailyDigest(summary: DailyDigestSummary): string {
  const items: string[] = [];
  if (summary.openRepairs) items.push(`${summary.openRepairs} open repair${summary.openRepairs === 1 ? "" : "s"}`);
  if (summary.readyToBill) items.push(`${summary.readyToBill} ready to bill`);
  if (summary.openMaterialRequests) items.push(`${summary.openMaterialRequests} material request${summary.openMaterialRequests === 1 ? "" : "s"} awaiting action`);
  if (summary.lowStockParts) items.push(`${summary.lowStockParts} low-stock part${summary.lowStockParts === 1 ? "" : "s"}`);
  if (summary.openDefects) items.push(`${summary.openDefects} open defect${summary.openDefects === 1 ? "" : "s"}`);
  if (summary.unreviewedWarrantyRequests) items.push(`${summary.unreviewedWarrantyRequests} warranty request${summary.unreviewedWarrantyRequests === 1 ? "" : "s"} to review`);
  if (summary.serviceDue) items.push(`${summary.serviceDue} service item${summary.serviceDue === 1 ? "" : "s"} due`);
  return items.length ? `Today: ${items.join(" · ")}.` : "Today: no open repair, inventory, service, defect, billing, or warranty items need attention.";
}

/**
 * Sends the daily digest to the configured recipients exactly once per UTC
 * day.  The return count is the number of inbox records newly created.
 */
export async function sendDailyDigest(db: Db, now: Date = new Date()): Promise<number> {
  const date = todayIso(now);
  const summary = await dailyDigestSummary(db, now);
  return notifyCategory(db, {
    category: "daily_digest",
    severity: summary.openDefects || summary.readyToBill || summary.unreviewedWarrantyRequests ? "warning" : "info",
    title: `Daily operations digest — ${date}`,
    body: formatDailyDigest(summary),
    relatedType: "daily_digest",
    relatedId: date,
    dedupeKey: `daily_digest:${date}`,
  });
}
