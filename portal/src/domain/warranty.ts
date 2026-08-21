/**
 * Warranty requests from the public site.
 *
 * A homeowner fills in a form on hplacer.com. It arrives here, gets matched
 * against the homes we know about, and either becomes a repair ticket on the
 * right home or sits in the review queue for a person to finish.
 *
 * The matching is deliberately conservative (see `matching.ts`): a request is
 * attached to a home only when exactly one home is implicated and nothing
 * contradicts it. Everything else is an unlinked request. Putting a stranger's
 * repair on someone else's serial number is a worse outcome than asking a
 * person to spend thirty seconds on it.
 */
import { badRequest, conflict, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import type { Actor } from "../auth/authz.ts";
import { matchHome, normalizeAddress, normalizeName, normalizePhone, type MatchResult } from "./matching.ts";
import { notifyCategory } from "./notifications.ts";
import { createRepair } from "./repairs.ts";

/** The employee row a warranty ticket is filed under. Created by migration 0004. */
export const INTAKE_EMPLOYEE_ID = "emp_system_intake";

export const WARRANTY_STATUSES = ["needs_review", "linked", "ticketed", "duplicate", "dismissed"] as const;
export type WarrantyStatus = (typeof WARRANTY_STATUSES)[number];

export interface WarrantyIntakeInput {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  preferredContact?: "phone" | "email" | "text" | null;
  bestTime?: string | null;
  serialNumber?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  issueSummary: string;
  issueDetail?: string | null;
  source?: "public_site" | "phone" | "portal";
}

export interface WarrantyIntakeResult {
  requestId: string;
  reference: string;
  homeId: string | null;
  repairTicketId: string | null;
  ticketNumber: string | null;
  confidence: MatchResult["confidence"];
  method: MatchResult["method"];
  reason: string;
  needsReview: boolean;
}

export interface WarrantyRequestRow {
  id: string;
  reference: string;
  status: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  preferred_contact: string | null;
  best_time: string | null;
  reported_serial: string | null;
  reported_address: string | null;
  reported_city: string | null;
  reported_state: string | null;
  reported_postal_code: string | null;
  issue_summary: string;
  issue_detail: string | null;
  home_id: string | null;
  match_method: string;
  match_confidence: string;
  match_reason: string | null;
  match_candidates: string | null;
  repair_ticket_id: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  source: string;
  created_at: string;
}

export interface WarrantyRequestSummary extends WarrantyRequestRow {
  serial_number: string | null;
  ticket_number: string | null;
  reviewed_by_name: string | null;
  photo_count: number;
}

const SUMMARY_SELECT = `
  SELECT w.*, h.serial_number, r.ticket_number, e.display_name AS reviewed_by_name,
         (SELECT count(*) FROM documents d WHERE d.warranty_request_id = w.id AND d.upload_status = 'stored') AS photo_count
    FROM warranty_requests w
    LEFT JOIN homes h ON h.id = w.home_id
    LEFT JOIN repair_tickets r ON r.id = w.repair_ticket_id
    LEFT JOIN employees e ON e.id = w.reviewed_by`;

/**
 * Records a request, matches it, and — only on a confident match — opens the
 * repair ticket and drops it into the bill-back review queue.
 */
export async function intakeWarrantyRequest(
  db: Db,
  input: WarrantyIntakeInput,
  now: Date = new Date(),
): Promise<WarrantyIntakeResult> {
  const customerName = input.customerName?.trim();
  if (!customerName) throw badRequest("Tell us who you are");
  const issueSummary = input.issueSummary?.trim();
  if (!issueSummary) throw badRequest("Tell us what is wrong");
  if (issueSummary.length > 200) throw badRequest("Keep the summary under 200 characters");

  const phone = input.customerPhone?.trim() || null;
  const phoneKey = normalizePhone(phone);
  if (phone && !phoneKey) throw badRequest("Enter a 10-digit phone number");
  const email = input.customerEmail?.trim() || null;
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("That email does not look right");
  if (!phoneKey && !email) throw badRequest("Leave us a phone number or an email so we can reach you");

  const addressKey = normalizeAddress({
    address: input.address,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
  });

  const match = await matchHome(db, {
    serialNumber: input.serialNumber,
    address: input.address,
    city: input.city,
    state: input.state,
    postalCode: input.postalCode,
    customerName,
    phone,
  });

  const id = newId("wrq");
  const timestamp = nowIso(now);
  const reference = await allocateReference(db, now);
  const linked = match.confidence === "confident" && match.homeId !== null;

  await db
    .prepare(
      `INSERT INTO warranty_requests (
         id, reference, status, customer_name, customer_name_key, customer_phone, customer_phone_key,
         customer_email, preferred_contact, best_time, reported_serial, reported_address, reported_city,
         reported_state, reported_postal_code, reported_address_key, issue_summary, issue_detail,
         home_id, match_method, match_confidence, match_reason, match_candidates, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      reference,
      linked ? "linked" : "needs_review",
      customerName,
      normalizeName(customerName),
      phone,
      phoneKey,
      email,
      input.preferredContact ?? null,
      input.bestTime?.trim() || null,
      input.serialNumber?.trim() || null,
      input.address?.trim() || null,
      input.city?.trim() || null,
      input.state?.trim().toUpperCase().slice(0, 2) || null,
      input.postalCode?.trim() || null,
      addressKey?.key ?? null,
      issueSummary,
      input.issueDetail?.trim() || null,
      linked ? match.homeId : null,
      linked ? match.method : "none",
      match.confidence,
      match.reason,
      JSON.stringify(match.candidates),
      input.source ?? "public_site",
      timestamp,
      timestamp,
    )
    .run();

  let repairTicketId: string | null = null;
  let ticketNumber: string | null = null;
  if (linked) {
    const created = await openTicketFor(db, id, match.homeId as string, {
      reference,
      customerName,
      phone,
      email,
      issueSummary,
      issueDetail: input.issueDetail ?? null,
      matchReason: match.reason,
    }, now);
    repairTicketId = created.id;
    ticketNumber = created.ticketNumber;
  }

  await notifyCategory(db, {
    category: "warranty_request",
    severity: linked ? "warning" : "urgent",
    title: linked
      ? `Warranty request ${reference} — ticket ${ticketNumber} opened`
      : `Warranty request ${reference} needs review`,
    body: linked
      ? `${customerName}: ${issueSummary}. Matched by ${match.method.replace(/_/g, " ")} and sent to the bill-back queue.`
      : `${customerName}: ${issueSummary}. ${match.reason}`,
    relatedType: "warranty_request",
    relatedId: id,
  });

  return {
    requestId: id,
    reference,
    homeId: linked ? match.homeId : null,
    repairTicketId,
    ticketNumber,
    confidence: match.confidence,
    method: linked ? match.method : "none",
    reason: match.reason,
    needsReview: !linked,
  };
}

interface TicketFacts {
  reference: string;
  customerName: string;
  phone: string | null;
  email: string | null;
  issueSummary: string;
  issueDetail: string | null;
  matchReason: string;
}

/**
 * Opens the repair ticket behind a warranty request and moves the homeowner's
 * photos onto it, then flags it for bill-back review — a warranty repair is
 * exactly the kind of work that gets charged back to the manufacturer.
 */
async function openTicketFor(
  db: Db,
  requestId: string,
  homeId: string,
  facts: TicketFacts,
  now: Date,
): Promise<{ id: string; ticketNumber: string }> {
  const intakeActor: Actor = {
    employeeId: INTAKE_EMPLOYEE_ID,
    email: "warranty-intake@system.invalid",
    displayName: "Warranty intake",
    roles: ["employee"],
    primaryRole: "employee",
    identity: { subject: "system:warranty-intake", email: "warranty-intake@system.invalid", method: "local_development" },
  };

  const contact = [facts.phone, facts.email].filter(Boolean).join(" · ");
  const ticketId = await createRepair(
    db,
    intakeActor,
    {
      title: facts.issueSummary,
      description: [
        `Warranty request ${facts.reference} from the website.`,
        `Homeowner: ${facts.customerName}${contact ? ` (${contact})` : ""}`,
        facts.issueDetail ? `\n${facts.issueDetail}` : "",
        `\nMatched to this home: ${facts.matchReason}`,
      ]
        .filter(Boolean)
        .join("\n"),
      homeId,
      responsiblePartyType: "manufacturer",
      billBack: true,
    },
    now,
  );

  const timestamp = nowIso(now);
  await db
    .prepare("UPDATE warranty_requests SET repair_ticket_id = ?, status = 'ticketed', updated_at = ? WHERE id = ?")
    .bind(ticketId, timestamp, requestId)
    .run();
  // The homeowner's photos belong on the ticket the crew will actually open.
  await db
    .prepare("UPDATE documents SET repair_ticket_id = ?, home_id = ? WHERE warranty_request_id = ?")
    .bind(ticketId, homeId, requestId)
    .run();

  const ticket = await db.prepare("SELECT ticket_number FROM repair_tickets WHERE id = ?").bind(ticketId).first<{ ticket_number: string }>();
  return { id: ticketId, ticketNumber: ticket?.ticket_number ?? "" };
}

/** `WR-2026-0007` — what the office quotes back to a homeowner on the phone. */
async function allocateReference(db: Db, now: Date): Promise<string> {
  const year = now.getUTCFullYear();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const row = await db
      .prepare("SELECT count(*) AS n FROM warranty_requests WHERE reference LIKE ?")
      .bind(`WR-${year}-%`)
      .first<{ n: number }>();
    const candidate = `WR-${year}-${String((row?.n ?? 0) + 1 + attempt).padStart(4, "0")}`;
    const clash = await db.prepare("SELECT id FROM warranty_requests WHERE reference = ?").bind(candidate).first<{ id: string }>();
    if (!clash) return candidate;
  }
  throw conflict("Could not allocate a warranty reference — try again");
}

// ---------------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------------

export async function listWarrantyRequests(
  db: Db,
  filter: { status?: string; homeId?: string; needsReviewOnly?: boolean; limit?: number } = {},
): Promise<WarrantyRequestSummary[]> {
  const rows = await db
    .prepare(
      `${SUMMARY_SELECT}
        WHERE (?1 IS NULL OR w.status = ?1)
          AND (?2 IS NULL OR w.home_id = ?2)
          AND (?3 = 0 OR w.status = 'needs_review')
        ORDER BY w.status = 'needs_review' DESC, w.created_at DESC, w.rowid DESC
        LIMIT ?4`,
    )
    .bind(filter.status ?? null, filter.homeId ?? null, filter.needsReviewOnly ? 1 : 0, filter.limit ?? 100)
    .all<WarrantyRequestSummary>();
  return rows.results;
}

export async function getWarrantyRequest(db: Db, idOrReference: string): Promise<WarrantyRequestSummary | null> {
  return db.prepare(`${SUMMARY_SELECT} WHERE w.id = ?1 OR w.reference = ?1`).bind(idOrReference).first<WarrantyRequestSummary>();
}

export async function requireWarrantyRequest(db: Db, idOrReference: string): Promise<WarrantyRequestSummary> {
  const request = await getWarrantyRequest(db, idOrReference);
  if (!request) throw notFound("Warranty request not found");
  return request;
}

export function parseCandidates(request: Pick<WarrantyRequestSummary, "match_candidates">): MatchResult["candidates"] {
  if (!request.match_candidates) return [];
  try {
    const parsed = JSON.parse(request.match_candidates);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * A person deciding what intake could not. Linking opens the ticket that intake
 * withheld, and records that the link was made by hand.
 */
export async function linkWarrantyRequest(
  db: Db,
  actor: Actor,
  requestId: string,
  homeId: string,
  note?: string | null,
  now: Date = new Date(),
): Promise<{ repairTicketId: string; ticketNumber: string }> {
  const request = await requireWarrantyRequest(db, requestId);
  if (request.repair_ticket_id) throw conflict(`${request.reference} already has ticket ${request.ticket_number}`);
  if (request.status === "dismissed" || request.status === "duplicate") {
    throw badRequest(`${request.reference} was closed as ${request.status}`);
  }

  const home = await db.prepare("SELECT id FROM homes WHERE id = ?").bind(homeId).first<{ id: string }>();
  if (!home) throw notFound("Home not found");

  const timestamp = nowIso(now);
  await db
    .prepare(
      `UPDATE warranty_requests
          SET home_id = ?, match_method = 'manual', match_confidence = 'confident',
              match_reason = ?, status = 'linked', reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ?
        WHERE id = ?`,
    )
    .bind(
      homeId,
      `Linked by ${actor.displayName}${note?.trim() ? `: ${note.trim()}` : ""}`,
      actor.employeeId,
      timestamp,
      note?.trim() || null,
      timestamp,
      request.id,
    )
    .run();

  const created = await openTicketFor(
    db,
    request.id,
    homeId,
    {
      reference: request.reference,
      customerName: request.customer_name,
      phone: request.customer_phone,
      email: request.customer_email,
      issueSummary: request.issue_summary,
      issueDetail: request.issue_detail,
      matchReason: `Linked by ${actor.displayName}${note?.trim() ? `: ${note.trim()}` : ""}`,
    },
    now,
  );
  return { repairTicketId: created.id, ticketNumber: created.ticketNumber };
}

export async function closeWarrantyRequest(
  db: Db,
  actor: Actor,
  requestId: string,
  status: "dismissed" | "duplicate",
  note: string,
  now: Date = new Date(),
): Promise<void> {
  if (!note?.trim()) throw badRequest("Say why this request is being closed");
  const request = await requireWarrantyRequest(db, requestId);
  if (request.repair_ticket_id) throw badRequest("This request already has a ticket — close the ticket instead");

  const timestamp = nowIso(now);
  await db
    .prepare(
      `UPDATE warranty_requests SET status = ?, reviewed_by = ?, reviewed_at = ?, review_notes = ?, updated_at = ?
        WHERE id = ?`,
    )
    .bind(status, actor.employeeId, timestamp, note.trim(), timestamp, request.id)
    .run();
}

/**
 * Re-points a request's photos at its ticket.
 *
 * Intake opens the ticket before the photos finish uploading — the homeowner's
 * files arrive on the same request but are written afterwards — so this runs
 * again once they have landed. Idempotent.
 */
export async function attachWarrantyPhotosToTicket(db: Db, requestId: string): Promise<number> {
  const request = await getWarrantyRequest(db, requestId);
  if (!request?.repair_ticket_id || !request.home_id) return 0;
  const result = await db
    .prepare(
      `UPDATE documents SET repair_ticket_id = ?, home_id = ?
        WHERE warranty_request_id = ? AND repair_ticket_id IS NULL`,
    )
    .bind(request.repair_ticket_id, request.home_id, request.id)
    .run();
  return result.meta.changes ?? 0;
}

export async function warrantyReviewCount(db: Db): Promise<number> {
  const row = await db
    .prepare("SELECT count(*) AS n FROM warranty_requests WHERE status = 'needs_review'")
    .first<{ n: number }>();
  return row?.n ?? 0;
}
