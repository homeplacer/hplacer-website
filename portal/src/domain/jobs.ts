/** Jobs, their lots, and the Drive/Maps references crews need in the field. */
import { badRequest, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db } from "../platform/types.ts";
import { normalizeAddress } from "./matching.ts";

export interface JobRow {
  id: string;
  job_number: string;
  title: string;
  status: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  google_maps_url: string | null;
  drive_folder_url: string | null;
  supervisor_id: string | null;
  customer_reference: string | null;
  notes: string | null;
  address_key: string | null;
  monday_item_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LotRow {
  id: string;
  job_id: string;
  lot_number: string;
  parcel_id: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  plat_drive_url: string | null;
  permit_drive_url: string | null;
  access_notes: string | null;
  utility_notes: string | null;
  status: string;
  address_key: string | null;
}

export interface JobSummary extends JobRow {
  supervisor_name: string | null;
  lot_count: number;
  home_count: number;
  open_task_count: number;
}

const JOB_STATUSES = ["planning", "active", "on_hold", "complete", "archived"];
const LOT_STATUSES = ["pending", "permitted", "prepped", "set", "complete"];

export async function listJobs(db: Db, options: { status?: string; search?: string } = {}): Promise<JobSummary[]> {
  const rows = await db
    .prepare(
      `SELECT j.*, e.display_name AS supervisor_name,
              (SELECT count(*) FROM lots WHERE lots.job_id = j.id) AS lot_count,
              (SELECT count(*) FROM homes WHERE homes.job_id = j.id) AS home_count,
              (SELECT count(*) FROM work_tasks WHERE work_tasks.job_id = j.id
                 AND work_tasks.status IN ('open', 'in_progress', 'blocked')) AS open_task_count
         FROM jobs j
         LEFT JOIN employees e ON e.id = j.supervisor_id
        WHERE (?1 IS NULL OR j.status = ?1)
          AND (?2 IS NULL OR j.job_number LIKE ?2 OR j.title LIKE ?2 OR ifnull(j.city, '') LIKE ?2)
        ORDER BY CASE j.status WHEN 'active' THEN 0 WHEN 'planning' THEN 1 ELSE 2 END, j.job_number`,
    )
    .bind(options.status ?? null, options.search ? `%${options.search}%` : null)
    .all<JobSummary>();
  return rows.results;
}

export async function getJob(db: Db, idOrNumber: string): Promise<JobRow | null> {
  return db
    .prepare("SELECT * FROM jobs WHERE id = ?1 OR job_number = ?1")
    .bind(idOrNumber)
    .first<JobRow>();
}

export async function requireJob(db: Db, idOrNumber: string): Promise<JobRow> {
  const job = await getJob(db, idOrNumber);
  if (!job) throw notFound("Job not found");
  return job;
}

export async function listLots(db: Db, jobId: string): Promise<LotRow[]> {
  const rows = await db
    .prepare("SELECT * FROM lots WHERE job_id = ? ORDER BY lot_number")
    .bind(jobId)
    .all<LotRow>();
  return rows.results;
}

export async function getLot(db: Db, lotId: string): Promise<LotRow | null> {
  return db.prepare("SELECT * FROM lots WHERE id = ?").bind(lotId).first<LotRow>();
}

export interface CreateJobInput {
  jobNumber: string;
  title: string;
  status?: string;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  googleMapsUrl?: string | null;
  driveFolderUrl?: string | null;
  supervisorId?: string | null;
  customerReference?: string | null;
  notes?: string | null;
}

export async function createJob(db: Db, input: CreateJobInput): Promise<string> {
  if (!input.jobNumber.trim()) throw badRequest("Job number is required");
  if (!input.title.trim()) throw badRequest("Job title is required");
  const status = input.status ?? "active";
  if (!JOB_STATUSES.includes(status)) throw badRequest(`Unknown job status "${status}"`);

  const id = newId("job");
  const timestamp = nowIso();
  await db
    .prepare(
      `INSERT INTO jobs (id, job_number, title, status, street_address, city, state, postal_code,
                         google_maps_url, drive_folder_url, supervisor_id, customer_reference, notes,
                         address_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.jobNumber.trim(),
      input.title.trim(),
      status,
      input.streetAddress ?? null,
      input.city ?? null,
      input.state ?? null,
      input.postalCode ?? null,
      normalizeUrl(input.googleMapsUrl),
      normalizeUrl(input.driveFolderUrl),
      input.supervisorId ?? null,
      input.customerReference ?? null,
      input.notes ?? null,
      normalizeAddress({
        address: input.streetAddress,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
      })?.key ?? null,
      timestamp,
      timestamp,
    )
    .run();
  return id;
}

export interface CreateLotInput {
  jobId: string;
  lotNumber: string;
  parcelId?: string | null;
  streetAddress?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googleMapsUrl?: string | null;
  platDriveUrl?: string | null;
  permitDriveUrl?: string | null;
  accessNotes?: string | null;
  utilityNotes?: string | null;
  status?: string;
}

export async function createLot(db: Db, input: CreateLotInput): Promise<string> {
  if (!input.lotNumber.trim()) throw badRequest("Lot number is required");
  const status = input.status ?? "pending";
  if (!LOT_STATUSES.includes(status)) throw badRequest(`Unknown lot status "${status}"`);
  await requireJob(db, input.jobId);

  const id = newId("lot");
  const timestamp = nowIso();
  // A dropped pin beats a typed address when the lot has no mailbox yet.
  const mapsUrl =
    normalizeUrl(input.googleMapsUrl) ??
    (input.latitude != null && input.longitude != null
      ? `https://www.google.com/maps/search/?api=1&query=${input.latitude},${input.longitude}`
      : null);

  await db
    .prepare(
      `INSERT INTO lots (id, job_id, lot_number, parcel_id, street_address, city, state, postal_code,
                         latitude, longitude, google_maps_url, plat_drive_url, permit_drive_url,
                         access_notes, utility_notes, status, address_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      id,
      input.jobId,
      input.lotNumber.trim(),
      input.parcelId ?? null,
      input.streetAddress ?? null,
      input.city ?? null,
      input.state ?? null,
      input.postalCode ?? null,
      input.latitude ?? null,
      input.longitude ?? null,
      mapsUrl,
      normalizeUrl(input.platDriveUrl),
      normalizeUrl(input.permitDriveUrl),
      input.accessNotes ?? null,
      input.utilityNotes ?? null,
      status,
      normalizeAddress({
        address: input.streetAddress,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
      })?.key ?? null,
      timestamp,
      timestamp,
    )
    .run();
  return id;
}

export async function updateLotStatus(db: Db, lotId: string, status: string): Promise<void> {
  if (!LOT_STATUSES.includes(status)) throw badRequest(`Unknown lot status "${status}"`);
  const result = await db
    .prepare("UPDATE lots SET status = ?, updated_at = ? WHERE id = ?")
    .bind(status, nowIso(), lotId)
    .run();
  if ((result.meta.changes ?? 0) === 0) throw notFound("Lot not found");
}

/**
 * Only http(s) links are stored. Field records link out to Google Drive and
 * Maps, and a `javascript:` or `data:` URL pasted into that field would
 * otherwise be rendered as an anchor for the next person who opens the job.
 */
export function normalizeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw badRequest(`"${trimmed}" is not a valid link`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw badRequest("Links must start with http:// or https://");
  }
  return parsed.toString();
}
