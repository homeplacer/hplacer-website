/**
 * Document routes: register a Google Drive link, upload a photo to private R2,
 * and stream a stored object back to an authorized employee.
 */
import { assertCan, can, type Actor } from "../auth/authz.ts";
import {
  DOCUMENT_TYPES,
  attachDriveDocument,
  getDocument,
  readDocumentContent,
  softDeleteDocument,
  uploadPhoto,
  type DocumentListRow,
  type DocumentTarget,
  type DocumentType,
} from "../domain/documents.ts";
import { badRequest } from "../platform/errors.ts";
import { optionalField, readFields, readForm, requiredField, type Fields, type RequestContext } from "../api/context.ts";
import { json, redirect } from "../api/responses.ts";
import type { Router } from "../api/router.ts";
import { securityHeaders } from "../ui/layout.ts";
import { html, raw, type SafeHtml } from "../ui/html.ts";
import { badge, empty, externalLink, formatDate } from "../ui/layout.ts";

export function registerDocuments(router: Router): void {
  router.post("/api/documents/drive", attachDriveRoute);
  router.post("/api/documents/upload", uploadRoute);
  router.get("/api/documents/:id/content", contentRoute);
  router.post("/api/documents/:id/delete", deleteRoute);
  router.delete("/api/documents/:id", deleteRoute);
}

function targetFromFields(fields: Fields): DocumentTarget {
  return {
    jobId: fields.job_id || null,
    lotId: fields.lot_id || null,
    homeId: fields.home_id || null,
    assetId: fields.asset_id || null,
    inspectionId: fields.inspection_id || null,
    repairTicketId: fields.repair_ticket_id || null,
    workTaskId: fields.work_task_id || null,
    materialRequestId: fields.material_request_id || null,
    defectId: fields.defect_id || null,
  };
}

export const HOME_COMPLIANCE_DOCUMENTS = {
  manufactured_home_permit: { label: "Manufactured-home permit", type: "permit" as DocumentType },
  county_inspection: { label: "County inspection", type: "report" as DocumentType },
  foundation_inspection: { label: "Foundation inspection", type: "report" as DocumentType },
  septic_or_sewer: { label: "Septic or sewer paperwork", type: "report" as DocumentType },
  site_plan: { label: "Site plan", type: "plat" as DocumentType },
  property_paperwork: { label: "Property paperwork", type: "other" as DocumentType },
  site_map: { label: "Site map", type: "plat" as DocumentType },
  plat: { label: "Plat", type: "plat" as DocumentType },
  building_permit: { label: "Building permit", type: "permit" as DocumentType },
  final_inspection_report: { label: "Final inspection report", type: "report" as DocumentType },
  septic_permit: { label: "Septic permit", type: "permit" as DocumentType },
  sewer_receipt: { label: "Sewer receipt", type: "receipt" as DocumentType },
  foundation_certificate: { label: "Foundation certificate", type: "report" as DocumentType },
  home_inspection: { label: "Home inspection", type: "report" as DocumentType },
  equipment_photo: { label: "Equipment photo", type: "photo" as DocumentType },
} as const;

function documentTypeFromFields(fields: Fields): DocumentType {
  const category = fields.home_document_category as keyof typeof HOME_COMPLIANCE_DOCUMENTS | undefined;
  if (category && HOME_COMPLIANCE_DOCUMENTS[category]) return HOME_COMPLIANCE_DOCUMENTS[category].type;
  return (requiredField(fields, "document_type", "Document type") as DocumentType);
}

function documentCaptionFromFields(fields: Fields): string | null {
  const category = fields.home_document_category as keyof typeof HOME_COMPLIANCE_DOCUMENTS | undefined;
  if (category && HOME_COMPLIANCE_DOCUMENTS[category]) return HOME_COMPLIANCE_DOCUMENTS[category].label;
  return optionalField(fields, "caption");
}

function safeRedirect(value: string | null | undefined, fallback: string): string {
  // Only same-origin paths, so a crafted form cannot bounce a signed-in
  // employee off to another site.
  return value && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

async function attachDriveRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "document.upload");
  const fields = await readFields(ctx.request);
  const id = await attachDriveDocument(ctx.db, ctx.actor, {
    documentType: documentTypeFromFields(fields),
    webViewUrl: requiredField(fields, "web_view_url", "Drive link"),
    driveFileId: optionalField(fields, "drive_file_id"),
    fileName: requiredField(fields, "file_name", "File name"),
    caption: documentCaptionFromFields(fields),
    target: targetFromFields(fields),
  });
  if (isJson(ctx)) return json({ id }, 201);
  return redirect(`${safeRedirect(fields.redirect_to, "/")}?ok=uploaded`);
}

async function uploadRoute(ctx: RequestContext): Promise<Response> {
  assertCan(ctx.actor, "document.upload");
  const form = await readForm(ctx.request);
  const file = form.get("file");
  if (!file || typeof file === "string") throw badRequest("Choose a photo to upload");

  const fields: Fields = {};
  for (const [key, value] of form.entries()) if (typeof value === "string") fields[key] = value;

  const id = await uploadPhoto(ctx.db, ctx.store, ctx.actor.employeeId, {
    documentType: fields.home_document_category ? documentTypeFromFields(fields) : ((fields.document_type as DocumentType) || "photo"),
    fileName: file.name || "photo.jpg",
    contentType: file.type || "application/octet-stream",
    bytes: await file.arrayBuffer(),
    caption: documentCaptionFromFields(fields),
    target: targetFromFields(fields),
  });

  if (isJson(ctx)) return json({ id }, 201);
  return redirect(`${safeRedirect(fields.redirect_to, "/")}?ok=uploaded`);
}

/**
 * Serves a private R2 object. Authorization is re-checked here, not inherited
 * from whatever page linked to it.
 */
async function contentRoute(ctx: RequestContext): Promise<Response> {
  const { document, bytes } = await readDocumentContent(ctx.db, ctx.store, ctx.actor, ctx.params.id);
  return new Response(bytes, {
    headers: securityHeaders({
      "Content-Type": document.content_type ?? "application/octet-stream",
      // `attachment` for anything that is not an image: a stored HTML or SVG
      // file must never render in the portal's origin.
      "Content-Disposition": `${document.content_type?.startsWith("image/") ? "inline" : "attachment"}; filename="${document.file_name.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    }),
  });
}

async function deleteRoute(ctx: RequestContext): Promise<Response> {
  const fields = ctx.request.method === "POST" ? await readFields(ctx.request) : {};
  const document = await getDocument(ctx.db, ctx.params.id);
  if (document && (document.caption === "Site map" || document.caption === "Plat") && fields.confirm_delete !== "yes") {
    throw badRequest(`Confirm deletion of ${document.caption}`);
  }
  await softDeleteDocument(ctx.db, ctx.actor, ctx.params.id);
  if (isJson(ctx) || ctx.request.method === "DELETE") return json({ ok: true });
  return redirect(`${safeRedirect(fields.redirect_to, "/")}?ok=saved`);
}

function isJson(ctx: RequestContext): boolean {
  const accept = ctx.request.headers.get("Accept") ?? "";
  const contentType = ctx.request.headers.get("Content-Type") ?? "";
  return contentType.includes("application/json") || (accept.includes("application/json") && !accept.includes("text/html"));
}

// ---------------------------------------------------------------------------
// Shared UI fragments
// ---------------------------------------------------------------------------

export function documentList(documents: DocumentListRow[]): SafeHtml {
  if (documents.length === 0) return empty("Nothing attached yet.");
  return html`${documents.map(
    (document) => html`<div class="card">
      <div class="row">
        <h3>${document.file_name}</h3>
        ${badge(document.document_type, document.upload_status === "stored" ? "" : "warn")}
      </div>
      <div class="meta">${formatDate(document.created_at)} · ${document.uploaded_by_name} ·
        ${document.storage_provider === "r2" ? "private storage" : "Google Drive"}</div>
      ${document.caption ? html`<p>${document.caption}</p>` : ""}
      ${document.storage_provider === "google_drive"
        ? externalLink(document.external_url, "Open in Drive")
        : html`<a href="/api/documents/${document.id}/content">Open file</a>`}
    </div>`,
  )}`;
}

export function documentTargetInputs(target: DocumentTarget): SafeHtml {
  const entries: [string, string | null | undefined][] = [
    ["job_id", target.jobId],
    ["lot_id", target.lotId],
    ["home_id", target.homeId],
    ["asset_id", target.assetId],
    ["inspection_id", target.inspectionId],
    ["repair_ticket_id", target.repairTicketId],
    ["work_task_id", target.workTaskId],
    ["material_request_id", target.materialRequestId],
    ["defect_id", target.defectId],
  ];
  return html`${entries
    .filter(([, value]) => value)
    .map(([name, value]) => html`<input type="hidden" name="${name}" value="${value as string}">`)}`;
}

/** The photo/document attach control, reused on every detail page. */
export function uploadForm(actor: Actor, target: DocumentTarget, redirectTo: string): SafeHtml {
  if (!can(actor, "document.upload")) return raw("");
  return html`
    <details class="card">
      <summary><strong>Attach a photo or a Drive link</strong></summary>

      <form method="post" action="/api/documents/upload" enctype="multipart/form-data">
        ${documentTargetInputs(target)}
        <input type="hidden" name="redirect_to" value="${redirectTo}">
        <label for="file-${redirectTo}">Photo or PDF</label>
        <input id="file-${redirectTo}" type="file" name="file" accept="image/*,application/pdf" capture="environment" required>
        <label for="caption-${redirectTo}">Caption</label>
        <input id="caption-${redirectTo}" name="caption">
        <label for="doctype-${redirectTo}">Type</label>
        <select id="doctype-${redirectTo}" name="document_type">
          ${DOCUMENT_TYPES.map((value) => html`<option value="${value}" ${raw(value === "photo" ? "selected" : "")}>${value}</option>`)}
        </select>
        <div class="btn-row"><button type="submit">Upload</button></div>
      </form>

      <form method="post" action="/api/documents/drive">
        ${documentTargetInputs(target)}
        <input type="hidden" name="redirect_to" value="${redirectTo}">
        <label for="drive-${redirectTo}">Google Drive link</label>
        <input id="drive-${redirectTo}" name="web_view_url" inputmode="url" placeholder="https://drive.google.com/file/d/…">
        <label for="drivename-${redirectTo}">File name</label>
        <input id="drivename-${redirectTo}" name="file_name">
        <label for="drivetype-${redirectTo}">Type</label>
        <select id="drivetype-${redirectTo}" name="document_type">
          ${DOCUMENT_TYPES.map((value) => html`<option value="${value}">${value}</option>`)}
        </select>
        <div class="btn-row"><button class="secondary" type="submit">Link Drive file</button></div>
      </form>
    </details>`;
}

/** A focused, serial-numbered filing cabinet for required home paperwork. */
export function homeComplianceUploadForm(actor: Actor, target: DocumentTarget, redirectTo: string): SafeHtml {
  if (!can(actor, "document.upload")) return raw("");
  return html`
    <details class="card" open>
      <summary><strong>Add home permit or inspection paperwork</strong></summary>
      <p class="meta">Files are private to authorized portal staff and stay with this home's serial-number record.</p>
      <form method="post" action="/api/documents/upload" enctype="multipart/form-data">
        ${documentTargetInputs(target)}
        <input type="hidden" name="redirect_to" value="${redirectTo}">
        <label for="home-category-${redirectTo}">Paperwork</label>
        <select id="home-category-${redirectTo}" name="home_document_category" required>
          ${Object.entries(HOME_COMPLIANCE_DOCUMENTS).map(([value, item]) => html`<option value="${value}">${item.label}</option>`)}
        </select>
        <label for="home-file-${redirectTo}">File or PDF</label>
        <input id="home-file-${redirectTo}" type="file" name="file" accept="image/*,application/pdf" capture="environment" required>
        <div class="btn-row"><button type="submit">Upload paperwork</button></div>
      </form>
      <form method="post" action="/api/documents/drive">
        ${documentTargetInputs(target)}
        <input type="hidden" name="redirect_to" value="${redirectTo}">
        <label for="home-drive-category-${redirectTo}">Paperwork</label>
        <select id="home-drive-category-${redirectTo}" name="home_document_category" required>
          ${Object.entries(HOME_COMPLIANCE_DOCUMENTS).map(([value, item]) => html`<option value="${value}">${item.label}</option>`)}
        </select>
        <label for="home-drive-${redirectTo}">Google Drive link</label>
        <input id="home-drive-${redirectTo}" name="web_view_url" inputmode="url" placeholder="https://drive.google.com/file/d/…" required>
        <label for="home-drive-name-${redirectTo}">File name</label>
        <input id="home-drive-name-${redirectTo}" name="file_name" required>
        <div class="btn-row"><button class="secondary" type="submit">Link Drive file</button></div>
      </form>
    </details>`;
}

/** Focused workflow paperwork slot with an empty state and secure upload. */
export function workflowDocumentArea(
  actor: Actor,
  target: DocumentTarget,
  redirectTo: string,
  documents: DocumentListRow[],
  category: keyof typeof HOME_COMPLIANCE_DOCUMENTS,
  options: { confirmDelete?: boolean } = {},
): SafeHtml {
  const definition = HOME_COMPLIANCE_DOCUMENTS[category];
  const attached = documents.filter((document) => document.caption === definition.label);
  return html`<div class="card">
    <h3>${definition.label}</h3>
    ${attached.length === 0 ? html`<p class="meta">Nothing uploaded yet.</p>` : attached.map((document) => html`
      <div class="row"><span>${document.file_name}</span>
        ${document.storage_provider === "google_drive"
          ? externalLink(document.external_url, "Open")
          : html`<a href="/api/documents/${document.id}/content">Open</a>`}
      </div>
      <p class="meta">${formatDate(document.created_at)} · ${document.uploaded_by_name}</p>
      <form method="post" action="/api/documents/${document.id}/delete">
        <input type="hidden" name="redirect_to" value="${redirectTo}">
        ${options.confirmDelete ? html`<label><input type="checkbox" name="confirm_delete" value="yes" required> Confirm delete ${definition.label}</label>` : ""}
        <div class="btn-row"><button class="secondary" type="submit">Delete</button></div>
      </form>`)}
    ${can(actor, "document.upload") ? html`<form method="post" action="/api/documents/upload" enctype="multipart/form-data">
      ${documentTargetInputs(target)}
      <input type="hidden" name="redirect_to" value="${redirectTo}">
      <input type="hidden" name="home_document_category" value="${category}">
      <label for="workflow-file-${category}">Upload ${definition.label}</label>
      <input id="workflow-file-${category}" type="file" name="file" accept="image/*,application/pdf" required>
      <div class="btn-row"><button type="submit">Upload</button></div>
    </form>` : ""}
  </div>`;
}
