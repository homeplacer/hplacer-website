import { assertCan, can, type Actor } from "../auth/authz.ts";
import { badRequest, forbidden, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { notifyCategory } from "./notifications.ts";

export const PORTABLE_JOHN_STATUSES = ["requested", "scheduled", "complete", "cancelled"] as const;
export type PortableJohnStatus = (typeof PORTABLE_JOHN_STATUSES)[number];

export interface PortableJohnRequest {
  id: string;
  request_number: string;
  request_type: string;
  status: string;
  requested_date: string | null;
  quantity: number;
  job_id: string | null;
  home_id: string | null;
  asset_id: string | null;
  location_details: string;
  notes: string | null;
  requested_by: string;
  operations_notes: string | null;
  completed_at: string | null;
  completed_by: string | null;
  created_at: string;
  requester_name: string;
  job_number: string | null;
  job_title: string | null;
  serial_number: string | null;
  site_address: string | null;
  asset_tag: string | null;
  asset_manufacturer: string | null;
  asset_model: string | null;
  asset_home_base: string | null;
}

const SELECT = `SELECT r.*, e.display_name AS requester_name, j.job_number, j.title AS job_title,
  h.serial_number, h.site_address, a.asset_tag, a.manufacturer AS asset_manufacturer,
  a.model AS asset_model, a.home_base AS asset_home_base
  FROM portable_john_requests r
  JOIN employees e ON e.id = r.requested_by
  LEFT JOIN jobs j ON j.id = r.job_id
  LEFT JOIN homes h ON h.id = r.home_id
  LEFT JOIN assets a ON a.id = r.asset_id`;

export async function listPortableJohnRequests(db: Db, actor: Actor, status?: string): Promise<PortableJohnRequest[]> {
  assertCan(actor, "material_request.create");
  const requester = can(actor, "task.read.all") ? null : actor.employeeId;
  const rows = await db.prepare(`${SELECT}
    WHERE (?1 IS NULL OR r.requested_by = ?1) AND (?2 IS NULL OR r.status = ?2)
    ORDER BY r.status IN ('complete', 'cancelled'), r.requested_date IS NULL, r.requested_date, r.created_at DESC`)
    .bind(requester, status ?? null).all<PortableJohnRequest>();
  return rows.results;
}

export async function requirePortableJohnRequest(db: Db, actor: Actor, id: string): Promise<PortableJohnRequest> {
  assertCan(actor, "material_request.create");
  const row = await db.prepare(`${SELECT} WHERE r.id = ?`).bind(id).first<PortableJohnRequest>();
  if (!row) throw notFound("Portable John request not found");
  if (!can(actor, "task.read.all") && row.requested_by !== actor.employeeId) throw forbidden("That request belongs to another employee");
  return row;
}

export interface CreatePortableJohnInput {
  requestType: string;
  requestedDate?: string | null;
  quantity?: number;
  jobId?: string | null;
  homeId?: string | null;
  assetId?: string | null;
  locationDetails: string;
  notes?: string | null;
}

export async function createPortableJohnRequest(db: Db, actor: Actor, input: CreatePortableJohnInput): Promise<string> {
  assertCan(actor, "material_request.create");
  if (!['delivery', 'pickup'].includes(input.requestType)) throw badRequest("Choose delivery or pickup");
  const targets = [input.jobId, input.homeId, input.assetId].filter(Boolean);
  if (targets.length !== 1) throw badRequest("Choose exactly one subdivision, home, or equipment location");
  if (!input.locationDetails.trim()) throw badRequest("Describe exactly where the Portable John should go or be picked up");
  const quantity = input.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 25) throw badRequest("Quantity must be between 1 and 25");
  if (input.requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.requestedDate)) throw badRequest("Requested date must look like 2026-08-30");

  const id = newId("pjr");
  const timestamp = nowIso();
  const requestNumber = `PJ-${timestamp.slice(0, 10).replace(/-/g, "")}-${id.slice(-6).toUpperCase()}`;
  await db.prepare(`INSERT INTO portable_john_requests
    (id, request_number, request_type, requested_date, quantity, job_id, home_id, asset_id, location_details, notes, requested_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, requestNumber, input.requestType, input.requestedDate ?? null, quantity, input.jobId ?? null,
      input.homeId ?? null, input.assetId ?? null, input.locationDetails.trim(), input.notes?.trim() || null,
      actor.employeeId, timestamp, timestamp).run();

  await notifyCategory(db, {
    category: "portable_john_request",
    severity: input.requestType === "pickup" ? "info" : "warning",
    title: `Portable John ${input.requestType}: ${requestNumber}`,
    body: `${actor.displayName} requested ${input.quantity ?? 1} unit(s) for ${input.requestedDate ?? "the next available date"}.`,
    relatedType: "portable_john_request",
    relatedId: id,
  });
  return id;
}

export async function updatePortableJohnStatus(db: Db, actor: Actor, id: string, status: PortableJohnStatus, notes?: string | null): Promise<void> {
  if (!can(actor, "task.assign")) throw forbidden("Only operations can update this request");
  if (!(PORTABLE_JOHN_STATUSES as readonly string[]).includes(status)) throw badRequest("Unknown request status");
  await requirePortableJohnRequest(db, actor, id);
  const timestamp = nowIso();
  await db.prepare(`UPDATE portable_john_requests SET status = ?, operations_notes = ?,
    completed_at = CASE WHEN ? = 'complete' THEN ? ELSE NULL END,
    completed_by = CASE WHEN ? = 'complete' THEN ? ELSE NULL END, updated_at = ? WHERE id = ?`)
    .bind(status, notes?.trim() || null, status, timestamp, status, actor.employeeId, timestamp, id).run();
}
