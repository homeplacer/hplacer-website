/**
 * Document metadata.
 *
 * Two providers, deliberately modelled differently:
 *
 * - **Google Drive** — plats, permits, and manufacturer paperwork already live
 *   in the company Drive. The portal stores the file id and `webViewLink` only.
 *   Nothing is copied, and Drive keeps enforcing its own sharing rules.
 * - **R2** — field photos, receipts, and inspection evidence go into a private
 *   bucket with no public access. Objects are never given a stored URL; they
 *   are streamed back through an authorized portal route, so a leaked row is
 *   not a leaked photo.
 */
import { badRequest, forbidden, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db, ObjectStore } from "../platform/types.ts";
import { can, type Actor } from "../auth/authz.ts";
import { normalizeUrl } from "./jobs.ts";

export const DOCUMENT_TYPES = ["plat", "permit", "photo", "report", "receipt", "invoice", "other"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

/** Everything a document can hang off. At least one is required. */
export interface DocumentTarget {
  jobId?: string | null;
  lotId?: string | null;
  homeId?: string | null;
  assetId?: string | null;
  inspectionId?: string | null;
  repairTicketId?: string | null;
  workTaskId?: string | null;
  materialRequestId?: string | null;
  defectId?: string | null;
  warrantyRequestId?: string | null;
}

export interface DocumentRow extends DocumentTarget {
  id: string;
  document_type: string;
  storage_provider: string;
  storage_key: string;
  external_url: string | null;
  file_name: string;
  content_type: string | null;
  byte_size: number | null;
  upload_status: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DocumentListRow {
  id: string;
  document_type: string;
  storage_provider: string;
  external_url: string | null;
  file_name: string;
  content_type: string | null;
  byte_size: number | null;
  upload_status: string;
  caption: string | null;
  uploaded_by_name: string | null;
  created_at: string;
}

const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

function targetColumns(target: DocumentTarget): Record<string, string | null> {
  return {
    job_id: target.jobId ?? null,
    lot_id: target.lotId ?? null,
    home_id: target.homeId ?? null,
    asset_id: target.assetId ?? null,
    inspection_id: target.inspectionId ?? null,
    repair_ticket_id: target.repairTicketId ?? null,
    work_task_id: target.workTaskId ?? null,
    material_request_id: target.materialRequestId ?? null,
    defect_id: target.defectId ?? null,
    warranty_request_id: target.warrantyRequestId ?? null,
  };
}

function assertHasTarget(target: DocumentTarget): void {
  if (Object.values(targetColumns(target)).every((value) => value == null)) {
    throw badRequest("Attach the document to a job, lot, home, machine, inspection, ticket, task, or warranty request");
  }
}

async function insertDocument(
  db: Db,
  values: {
    id: string;
    documentType: DocumentType;
    provider: "r2" | "google_drive";
    storageKey: string;
    externalUrl: string | null;
    fileName: string;
    contentType: string | null;
    byteSize: number | null;
    checksum: string | null;
    uploadStatus: "pending" | "stored" | "failed";
    caption: string | null;
    /** Null for a homeowner's upload through the public warranty form. */
    uploadedBy: string | null;
    target: DocumentTarget;
  },
): Promise<void> {
  const columns = targetColumns(values.target);
  await db
    .prepare(
      `INSERT INTO documents (id, document_type, storage_provider, storage_key, external_url, file_name, content_type,
                              byte_size, checksum_sha256, upload_status, caption, job_id, lot_id, home_id, asset_id,
                              inspection_id, repair_ticket_id, work_task_id, material_request_id, defect_id,
                              warranty_request_id, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      values.id,
      values.documentType,
      values.provider,
      values.storageKey,
      values.externalUrl,
      values.fileName,
      values.contentType,
      values.byteSize,
      values.checksum,
      values.uploadStatus,
      values.caption,
      columns.job_id,
      columns.lot_id,
      columns.home_id,
      columns.asset_id,
      columns.inspection_id,
      columns.repair_ticket_id,
      columns.work_task_id,
      columns.material_request_id,
      columns.defect_id,
      columns.warranty_request_id,
      values.uploadedBy,
      nowIso(),
    )
    .run();
}

export interface DriveDocumentInput {
  documentType: DocumentType;
  driveFileId?: string | null;
  webViewUrl: string;
  fileName: string;
  caption?: string | null;
  target: DocumentTarget;
}

/**
 * Registers an existing Drive file. The Drive id is derived from the share link
 * when it is not supplied, which is what people actually paste in.
 */
export async function attachDriveDocument(db: Db, actor: Actor, input: DriveDocumentInput): Promise<string> {
  assertHasTarget(input.target);
  if (!input.fileName.trim()) throw badRequest("Name the document");
  const url = normalizeUrl(input.webViewUrl);
  if (!url) throw badRequest("Paste the Google Drive link");
  const host = new URL(url).hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") {
    throw badRequest("That is not a Google Drive link");
  }

  const fileId = input.driveFileId?.trim() || driveFileIdFromUrl(url);
  if (!fileId) throw badRequest("Could not read a Drive file id from that link");

  const id = newId("doc");
  await insertDocument(db, {
    id,
    documentType: input.documentType,
    provider: "google_drive",
    storageKey: fileId,
    externalUrl: url,
    fileName: input.fileName.trim(),
    contentType: null,
    byteSize: null,
    checksum: null,
    uploadStatus: "stored",
    caption: input.caption?.trim() || null,
    uploadedBy: actor.employeeId,
    target: input.target,
  });
  return id;
}

export function driveFileIdFromUrl(url: string): string | null {
  const byPath = /\/(?:file\/d|folders|(?:document|spreadsheets|presentation|drawings|forms)\/d)\/([A-Za-z0-9_-]{10,})/.exec(url);
  if (byPath) return byPath[1];
  const byQuery = new URL(url).searchParams.get("id");
  return byQuery && /^[A-Za-z0-9_-]{10,}$/.test(byQuery) ? byQuery : null;
}

export interface PhotoUploadInput {
  documentType: DocumentType;
  fileName: string;
  contentType: string;
  bytes: ArrayBuffer;
  caption?: string | null;
  target: DocumentTarget;
}

/**
 * The authenticated upload path. The caller has already been through Access
 * verification and the `document.upload` permission check; this validates the
 * payload, writes the object, and only then marks the row stored — a failed
 * write leaves a `failed` row rather than metadata pointing at nothing.
 */
export async function uploadPhoto(
  db: Db,
  store: ObjectStore | undefined,
  uploadedBy: string | null,
  input: PhotoUploadInput,
): Promise<string> {
  assertHasTarget(input.target);
  if (!uploadedBy && !input.target.warrantyRequestId) {
    // Mirrors the CHECK in migration 0004: the only uploads with no employee
    // behind them are homeowner photos on a warranty request.
    throw badRequest("An upload with no employee behind it must belong to a warranty request");
  }
  if (!store) throw badRequest("Photo storage is not configured for this environment");
  if (!ALLOWED_PHOTO_TYPES.includes(input.contentType)) {
    throw badRequest(`${input.contentType} is not an accepted file type — use JPEG, PNG, WEBP, HEIC, or PDF`);
  }
  if (input.bytes.byteLength === 0) throw badRequest("The file is empty");
  if (input.bytes.byteLength > MAX_PHOTO_BYTES) throw badRequest("Photos must be 15 MB or smaller");

  const id = newId("doc");
  const safeName = sanitizeFileName(input.fileName);
  const now = new Date();
  const key = `photos/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${id}/${safeName}`;
  const digest = await crypto.subtle.digest("SHA-256", input.bytes);
  const checksum = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");

  await insertDocument(db, {
    id,
    documentType: input.documentType,
    provider: "r2",
    storageKey: key,
    externalUrl: null,
    fileName: safeName,
    contentType: input.contentType,
    byteSize: input.bytes.byteLength,
    checksum,
    uploadStatus: "pending",
    caption: input.caption?.trim() || null,
    uploadedBy,
    target: input.target,
  });

  try {
    await store.put(key, input.bytes, {
      httpMetadata: { contentType: input.contentType },
      customMetadata: { uploadedBy: uploadedBy ?? "public-warranty-form", documentId: id },
    });
  } catch (error) {
    await db.prepare("UPDATE documents SET upload_status = 'failed' WHERE id = ?").bind(id).run();
    throw error;
  }

  await db.prepare("UPDATE documents SET upload_status = 'stored' WHERE id = ?").bind(id).run();
  return id;
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "upload";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-{2,}/g, "-").slice(0, 120);
  return cleaned.replace(/^[.-]+/, "") || "upload";
}

export async function listDocuments(db: Db, target: DocumentTarget, limit = 100): Promise<DocumentListRow[]> {
  const columns = targetColumns(target);
  const rows = await db
    .prepare(
      `SELECT d.id, d.document_type, d.storage_provider, d.external_url, d.file_name, d.content_type, d.byte_size,
              d.upload_status, d.caption, e.display_name AS uploaded_by_name, d.created_at
         FROM documents d LEFT JOIN employees e ON e.id = d.uploaded_by
        WHERE d.upload_status <> 'deleted'
          AND (?1 IS NULL OR d.job_id = ?1) AND (?2 IS NULL OR d.lot_id = ?2)
          AND (?3 IS NULL OR d.home_id = ?3) AND (?4 IS NULL OR d.asset_id = ?4)
          AND (?5 IS NULL OR d.inspection_id = ?5) AND (?6 IS NULL OR d.repair_ticket_id = ?6)
          AND (?7 IS NULL OR d.work_task_id = ?7) AND (?8 IS NULL OR d.material_request_id = ?8)
          AND (?9 IS NULL OR d.defect_id = ?9) AND (?10 IS NULL OR d.warranty_request_id = ?10)
        ORDER BY d.created_at DESC LIMIT ?11`,
    )
    .bind(
      columns.job_id,
      columns.lot_id,
      columns.home_id,
      columns.asset_id,
      columns.inspection_id,
      columns.repair_ticket_id,
      columns.work_task_id,
      columns.material_request_id,
      columns.defect_id,
      columns.warranty_request_id,
      limit,
    )
    .all<DocumentListRow>();
  return rows.results;
}

export async function getDocument(db: Db, documentId: string): Promise<DocumentRow | null> {
  const row = await db
    .prepare(
      `SELECT id, document_type, storage_provider, storage_key, external_url, file_name, content_type, byte_size,
              upload_status, caption, uploaded_by, created_at, job_id, lot_id, home_id, asset_id, inspection_id,
              repair_ticket_id, work_task_id, material_request_id, defect_id, warranty_request_id
         FROM documents WHERE id = ?`,
    )
    .bind(documentId)
    .first<Record<string, unknown>>();
  if (!row) return null;
  return {
    ...(row as unknown as DocumentRow),
    jobId: (row.job_id as string | null) ?? null,
    lotId: (row.lot_id as string | null) ?? null,
    homeId: (row.home_id as string | null) ?? null,
    assetId: (row.asset_id as string | null) ?? null,
    inspectionId: (row.inspection_id as string | null) ?? null,
    repairTicketId: (row.repair_ticket_id as string | null) ?? null,
    workTaskId: (row.work_task_id as string | null) ?? null,
    materialRequestId: (row.material_request_id as string | null) ?? null,
    defectId: (row.defect_id as string | null) ?? null,
    warrantyRequestId: (row.warranty_request_id as string | null) ?? null,
  };
}

/**
 * Streams a private R2 object back to an authorized employee.
 *
 * A ticket-scoped document inherits the ticket's visibility, so an employee who
 * cannot read someone else's repair ticket cannot read its photos either by
 * guessing a document id.
 */
export async function readDocumentContent(
  db: Db,
  store: ObjectStore | undefined,
  actor: Actor,
  documentId: string,
): Promise<{ document: DocumentRow; bytes: ArrayBuffer }> {
  const document = await getDocument(db, documentId);
  if (!document || document.upload_status === "deleted") throw notFound("Document not found");
  if (document.storage_provider !== "r2") throw badRequest("That document lives in Google Drive — open it there");
  if (document.upload_status !== "stored") throw notFound("That upload never completed");
  await assertCanReadDocument(db, actor, document);

  if (!store) throw badRequest("Photo storage is not configured for this environment");
  const object = await store.get(document.storage_key);
  if (!object || typeof object.arrayBuffer !== "function") throw notFound("The stored file is missing");
  return { document, bytes: await object.arrayBuffer() };
}

export async function assertCanReadDocument(db: Db, actor: Actor, document: DocumentRow): Promise<void> {
  if (document.uploaded_by && document.uploaded_by === actor.employeeId) return;

  if (document.warrantyRequestId && !document.repairTicketId) {
    // An unlinked warranty photo is only useful to whoever works the queue.
    if (can(actor, "warranty.review")) return;
    throw forbidden("Only staff who work the warranty queue can open that photo");
  }

  if (document.repairTicketId) {
    const ticket = await db
      .prepare("SELECT reported_by, assigned_to FROM repair_tickets WHERE id = ?")
      .bind(document.repairTicketId)
      .first<{ reported_by: string; assigned_to: string | null }>();
    if (!ticket) throw notFound("Document not found");
    if (can(actor, "repair.read.all")) return;
    if (ticket.reported_by === actor.employeeId || ticket.assigned_to === actor.employeeId) return;
    throw forbidden();
  }

  if (document.workTaskId) {
    const task = await db
      .prepare("SELECT assigned_to, created_by FROM work_tasks WHERE id = ?")
      .bind(document.workTaskId)
      .first<{ assigned_to: string | null; created_by: string }>();
    if (!task) throw notFound("Document not found");
    if (can(actor, "task.read.all")) return;
    if (task.assigned_to === actor.employeeId || task.created_by === actor.employeeId) return;
    throw forbidden();
  }

  // Job, lot, home, asset, and inspection documents are shared shop records:
  // any active employee can read them.
}

export async function softDeleteDocument(db: Db, actor: Actor, documentId: string): Promise<void> {
  const document = await getDocument(db, documentId);
  if (!document) throw notFound("Document not found");
  if (document.uploaded_by !== actor.employeeId && !can(actor, "job.write")) {
    throw forbidden("Only the person who uploaded it, or a supervisor, can remove a document");
  }
  await db.prepare("UPDATE documents SET upload_status = 'deleted' WHERE id = ?").bind(documentId).run();
}
