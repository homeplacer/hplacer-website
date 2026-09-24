/** Staff review and matching of staged vendor email. Email content never enters D1. */
import { assertCan, type Actor } from "../auth/authz.ts";
import { conflict, notFound } from "../platform/errors.ts";
import { newId, nowIso } from "../platform/ids.ts";
import type { Db, ObjectStore } from "../platform/types.ts";
import { notify } from "./notifications.ts";
import { canonicalTrackingUrl, type CarrierName } from "../integrations/gmail-parsing.ts";

export interface VendorEmailEventRow {
  id: string;
  sender: string;
  subject: string;
  message_date: string | null;
  event_kind: string;
  vendor_order_number: string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  candidate_material_request_id: string | null;
  match_reason: string | null;
  attachment_count: number;
}

interface ReviewEvent {
  id: string;
  event_kind: string;
  subject: string;
  vendor_order_number: string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
}

interface RequestTarget { id: string; status: string; description: string; requested_by: string; ticket_assignee: string | null }
interface AttachmentRow { id: string; storage_key: string; file_name: string; content_type: string; byte_size: number; checksum_sha256: string; document_id: string | null }

export async function listVendorEmailEvents(db: Db, limit = 100): Promise<VendorEmailEventRow[]> {
  const rows = await db.prepare(
    `SELECT e.id, e.sender, e.subject, e.message_date, e.event_kind, e.vendor_order_number,
            e.carrier_name, e.tracking_number, e.tracking_url, e.candidate_material_request_id,
            e.match_reason,
            (SELECT count(*) FROM vendor_email_attachments a WHERE a.event_id = e.id) AS attachment_count
       FROM vendor_email_events e
      WHERE e.status = 'needs_review'
      ORDER BY e.message_date DESC, e.created_at DESC
      LIMIT ?`,
  ).bind(limit).all<VendorEmailEventRow>();
  return rows.results;
}

export async function reviewVendorEmailEvent(
  db: Db,
  store: ObjectStore | undefined,
  actor: Actor,
  input: { eventId: string; materialRequestId?: string | null; action: "approve" | "ignore" },
): Promise<void> {
  assertCan(actor, "vendor_mail.review");
  const event = await db.prepare(
    `SELECT id, event_kind, subject, vendor_order_number, carrier_name, tracking_number, tracking_url
       FROM vendor_email_events WHERE id = ? AND status = 'needs_review'`,
  ).bind(input.eventId).first<ReviewEvent>();
  if (!event) throw notFound("Vendor email review item not found");

  const timestamp = nowIso();
  if (input.action === "ignore") {
    const result = await db.prepare(
      `UPDATE vendor_email_events SET status = 'ignored', reviewed_by = ?, reviewed_at = ?, updated_at = ?
        WHERE id = ? AND status = 'needs_review'`,
    ).bind(actor.employeeId, timestamp, timestamp, event.id).run();
    if (result.meta.changes !== 1) throw conflict("Another employee already handled this vendor email");
    return;
  }

  if (!input.materialRequestId) throw notFound("Choose the material request this email belongs to");
  const request = await db.prepare(
    `SELECT m.id, m.status, m.description, m.requested_by, r.assigned_to AS ticket_assignee
       FROM material_requests m LEFT JOIN repair_tickets r ON r.id = m.repair_ticket_id WHERE m.id = ?`,
  ).bind(input.materialRequestId).first<RequestTarget>();
  if (!request) throw notFound("Material request not found");
  if (["received", "cancelled"].includes(request.status)) throw conflict("That material request is already closed");
  if (!store) throw conflict("Private file storage is not available; attachments were not linked");

  const attachments = await db.prepare(
    "SELECT id, storage_key, file_name, content_type, byte_size, checksum_sha256, document_id FROM vendor_email_attachments WHERE event_id = ?",
  ).bind(event.id).all<AttachmentRow>();

  const claim = crypto.randomUUID();
  const nextStatus = event.event_kind === "unknown" ? request.status : (request.status === "requested" || request.status === "approved" ? "ordered" : request.status);
  const carrier = asCarrier(event.carrier_name);
  const trackingUrl = carrier && event.tracking_number ? canonicalTrackingUrl(carrier, event.tracking_number) : null;
  const statements = [
    db.prepare(
      `UPDATE vendor_email_events SET status = 'processing', match_reason = ?, updated_at = ?
        WHERE id = ? AND status = 'needs_review'`,
    ).bind(`review-claim:${claim}`, timestamp, event.id),
    db.prepare(
      `UPDATE material_requests
          SET status = ?,
              vendor_order_number = coalesce(?, vendor_order_number),
              carrier_name = coalesce(?, carrier_name),
              tracking_number = coalesce(?, tracking_number),
              tracking_url = coalesce(?, tracking_url),
              shipping_updated_at = CASE WHEN ? IS NOT NULL THEN ? ELSE shipping_updated_at END,
              ordered_by = CASE WHEN ? = 'ordered' AND status IN ('requested', 'approved') THEN ? ELSE ordered_by END,
              ordered_at = CASE WHEN ? = 'ordered' AND status IN ('requested', 'approved') THEN ? ELSE ordered_at END,
              updated_at = ?
        WHERE id = ? AND EXISTS (SELECT 1 FROM vendor_email_events WHERE id = ? AND status = 'processing' AND match_reason = ?)`,
    ).bind(nextStatus, event.vendor_order_number, carrier, event.tracking_number, trackingUrl,
      event.tracking_number, timestamp, nextStatus, actor.employeeId, nextStatus, timestamp, timestamp,
      request.id, event.id, `review-claim:${claim}`),
  ];

  const documentIds: { attachment: AttachmentRow; documentId: string }[] = [];
  for (const attachment of attachments.results) {
    if (attachment.document_id) continue;
    if (!(await store.head(attachment.storage_key))) throw conflict("A staged vendor attachment is missing from private storage");
    const documentId = newId("doc");
    documentIds.push({ attachment, documentId });
    statements.push(db.prepare(
      `INSERT INTO documents
         (id, document_type, storage_provider, storage_key, file_name, content_type, byte_size,
          checksum_sha256, upload_status, caption, material_request_id, uploaded_by, created_at)
       SELECT ?, ?, 'r2', ?, ?, ?, ?, ?, 'stored', ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM vendor_email_events WHERE id = ? AND status = 'processing' AND match_reason = ?)
          AND EXISTS (SELECT 1 FROM vendor_email_attachments WHERE id = ? AND document_id IS NULL)`,
    ).bind(documentId, documentType(event), attachment.storage_key, attachment.file_name, attachment.content_type,
      attachment.byte_size, attachment.checksum_sha256, safeCaption(event.subject), request.id, actor.employeeId,
      timestamp, event.id, `review-claim:${claim}`, attachment.id));
    statements.push(db.prepare(
      `UPDATE vendor_email_attachments SET document_id = ?
        WHERE id = ? AND document_id IS NULL
          AND EXISTS (SELECT 1 FROM vendor_email_events WHERE id = ? AND status = 'processing' AND match_reason = ?)`,
    ).bind(documentId, attachment.id, event.id, `review-claim:${claim}`));
  }
  statements.push(db.prepare(
    `UPDATE vendor_email_events
        SET status = 'linked', candidate_material_request_id = ?, reviewed_by = ?, reviewed_at = ?,
            match_reason = 'staff confirmed', updated_at = ?
      WHERE id = ? AND status = 'processing' AND match_reason = ?`,
  ).bind(request.id, actor.employeeId, timestamp, timestamp, event.id, `review-claim:${claim}`));

  const result = await db.batch(statements);
  if (result[0]?.meta.changes !== 1) throw conflict("Another employee already handled this vendor email");

  const recipients = [...new Set([request.requested_by, request.ticket_assignee].filter((id): id is string => Boolean(id)))];
  for (const employeeId of recipients) {
    await notify(db, {
      employeeId,
      category: "parts_tracking",
      title: trackingUrl ? "Tracking added to a material request" : "Vendor email linked to a material request",
      body: trackingUrl ? `${request.description} now has a ${carrier} tracking link.` : `${request.description} was updated from a vendor email.`,
      relatedType: "material_request",
      relatedId: request.id,
      dedupeKey: `parts_tracking:${event.id}:${employeeId}`,
    });
  }
}

function asCarrier(value: string | null): CarrierName | null {
  return value === "UPS" || value === "FedEx" || value === "USPS" || value === "DHL" ? value : null;
}

function documentType(event: ReviewEvent): "receipt" | "invoice" | "other" {
  if (/invoice/i.test(event.subject)) return "invoice";
  if (event.event_kind === "receipt") return "receipt";
  return "other";
}

function safeCaption(subject: string): string {
  const clean = subject.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, 180);
  return `Vendor email attachment${clean ? ` — ${clean}` : ""}`;
}
