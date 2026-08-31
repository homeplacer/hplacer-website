/** Internal review of private applications submitted through the Careers page. */
import { badRequest, notFound } from "../platform/errors.ts";
import { nowIso } from "../platform/ids.ts";
import type { Db, ObjectStore } from "../platform/types.ts";

export const JOB_APPLICATION_STATUSES = [
  "received",
  "reviewing",
  "contacted",
  "not_selected",
  "hired",
  "withdrawn",
] as const;

export type JobApplicationStatus = (typeof JOB_APPLICATION_STATUSES)[number];

export interface JobApplicationRow {
  id: string;
  reference: string;
  position: string;
  applicant_name: string;
  email: string;
  phone: string;
  city_state: string | null;
  available_date: string | null;
  experience: string | null;
  credentials: string | null;
  references_text: string | null;
  resume_key: string | null;
  resume_file_name: string | null;
  resume_content_type: string | null;
  resume_byte_size: number | null;
  status: JobApplicationStatus;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

const SELECT_APPLICATION = `
  SELECT a.*, e.display_name AS reviewed_by_name
    FROM job_applications a
    LEFT JOIN employees e ON e.id = a.reviewed_by`;

export async function listJobApplications(
  db: Db,
  options: { status?: string | null; limit?: number } = {},
): Promise<JobApplicationRow[]> {
  const status = options.status?.trim() || null;
  if (status && !JOB_APPLICATION_STATUSES.includes(status as JobApplicationStatus)) {
    throw badRequest("Unknown application status");
  }
  const result = await db
    .prepare(`${SELECT_APPLICATION}
      WHERE (?1 IS NULL OR a.status = ?1)
      ORDER BY a.created_at DESC LIMIT ?2`)
    .bind(status, Math.min(Math.max(options.limit ?? 100, 1), 250))
    .all<JobApplicationRow>();
  return result.results;
}

export async function requireJobApplication(db: Db, id: string): Promise<JobApplicationRow> {
  const row = await db
    .prepare(`${SELECT_APPLICATION} WHERE a.id = ?1 OR a.reference = ?1`)
    .bind(id)
    .first<JobApplicationRow>();
  if (!row) throw notFound("Application not found");
  return row;
}

export async function updateJobApplicationReview(
  db: Db,
  id: string,
  status: string,
  notes: string | null,
  reviewerId: string,
): Promise<void> {
  if (!JOB_APPLICATION_STATUSES.includes(status as JobApplicationStatus)) {
    throw badRequest("Choose a valid application status");
  }
  const application = await requireJobApplication(db, id);
  const timestamp = nowIso();
  await db
    .prepare(
      `UPDATE job_applications
          SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ?`,
    )
    .bind(status, notes?.trim() || null, reviewerId, timestamp, timestamp, application.id)
    .run();
}

export async function readJobApplicationResume(
  db: Db,
  store: ObjectStore | undefined,
  id: string,
): Promise<{ application: JobApplicationRow; bytes: ArrayBuffer }> {
  const application = await requireJobApplication(db, id);
  if (!application.resume_key || !application.resume_file_name) throw notFound("This application has no resume");
  if (!store) throw badRequest("Resume storage is not configured for this environment");
  const object = await store.get(application.resume_key);
  if (!object || typeof object.arrayBuffer !== "function") throw notFound("The stored resume is missing");
  return { application, bytes: await object.arrayBuffer() };
}
