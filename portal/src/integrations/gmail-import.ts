/** Read-only Gmail poller. It stores no message body and never sends or deletes mail. */
import { newId, nowIso } from "../platform/ids.ts";
import type { Db, ObjectStore, PortalEnv } from "../platform/types.ts";
import { parseVendorMail, safeAttachmentType } from "./gmail-parsing.ts";

const ALLOWED_MAILBOX = "brandon@hplacer.com";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;
const MAX_ATTACHMENT_BYTES_PER_MESSAGE = 20 * 1024 * 1024;
const MAX_PAGES_PER_RUN = 10;
const SEARCH_TERMS = "{receipt invoice order shipped shipping tracking}";
const REQUIRED_GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

interface GmailHeader { name?: string; value?: string }
interface GmailPart {
  filename?: string;
  mimeType?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
}
interface GmailJsonResponse { messages?: { id: string; threadId?: string }[]; nextPageToken?: string; emailAddress?: string }

export interface GmailImportResult {
  enabled: boolean;
  found: number;
  staged: number;
  failed: number;
  skipped: number;
}

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function runConfiguredGmailImport(
  env: PortalEnv,
  options: { fetcher?: FetchLike; now?: Date } = {},
): Promise<GmailImportResult> {
  const disabled: GmailImportResult = { enabled: false, found: 0, staged: 0, failed: 0, skipped: 0 };
  if (
    env.GMAIL_INGEST_ENABLED !== "true" || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET ||
    !env.GMAIL_REFRESH_TOKEN || env.GMAIL_ALLOWED_MAILBOX?.toLowerCase() !== ALLOWED_MAILBOX ||
    !env.PORTAL_PHOTOS || !env.PORTAL_DB
  ) return disabled;

  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const accessToken = await refreshAccessToken(env, fetcher);
  const profile = await gmailJson<GmailJsonResponse>(fetcher, accessToken, "users/me/profile");
  if (profile.emailAddress?.toLowerCase() !== ALLOWED_MAILBOX) {
    throw new GmailIntegrationError("mailbox_mismatch");
  }

  const retryable = await env.PORTAL_DB.prepare(
    "SELECT id, gmail_message_id FROM vendor_email_events WHERE status = 'failed' OR (status = 'processing' AND updated_at < ?) ORDER BY updated_at LIMIT 20",
  ).bind(nowIso(new Date(now.getTime() - 15 * 60 * 1000))).all<{ id: string; gmail_message_id: string }>();
  let found = 0;
  let staged = 0;
  let failed = 0;
  let skipped = 0;
  for (const message of retryable.results) {
    found += 1;
    try {
      await stageGmailMessage(env.PORTAL_DB, env.PORTAL_PHOTOS, fetcher, accessToken, message.gmail_message_id);
      staged += 1;
    } catch (error) {
      failed += 1;
      await dbMarkFailed(env.PORTAL_DB, message.id, safeErrorCode(error), nowIso(now));
    }
  }

  const [lastPoll, savedPage] = await Promise.all([
    env.PORTAL_DB.prepare("SELECT state_value FROM portal_integration_state WHERE state_key = 'gmail_last_poll_at'").first<{ state_value: string }>(),
    env.PORTAL_DB.prepare("SELECT state_value FROM portal_integration_state WHERE state_key = 'gmail_page_token'").first<{ state_value: string }>(),
  ]);
  const since = lastPoll?.state_value ? new Date(lastPoll.state_value) : new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(since.getTime())) throw new GmailIntegrationError("cursor_invalid");
  // Overlap by five minutes to tolerate clock drift, indexing delay, and a
  // retry after partial paging. gmail_message_id uniqueness provides dedupe.
  const after = Math.max(0, Math.floor(since.getTime() / 1000) - 300);
  const query = `after:${after} ${SEARCH_TERMS}`;

  let pageToken: string | undefined = savedPage?.state_value || undefined;
  let complete = true;
  for (let page = 0; page < MAX_PAGES_PER_RUN; page += 1) {
    const params = new URLSearchParams({ q: query, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const listing = await gmailJson<GmailJsonResponse>(fetcher, accessToken, `users/me/messages?${params}`);
    const messages = listing.messages ?? [];
    found += messages.length;
    for (const listed of messages) {
      try {
        const result = await stageGmailMessage(env.PORTAL_DB, env.PORTAL_PHOTOS, fetcher, accessToken, listed.id);
        if (result === "staged") staged += 1;
        else skipped += 1;
      } catch (error) {
        failed += 1;
        await markMessageFailed(env.PORTAL_DB, listed, safeErrorCode(error), nowIso(now));
      }
    }
    pageToken = listing.nextPageToken;
    if (!pageToken) break;
    if (page === MAX_PAGES_PER_RUN - 1) complete = false;
  }

  // Do not advance beyond unseen pages. Existing message IDs are idempotent,
  // so a subsequent run can safely rescan the same bounded interval.
  if (complete) {
    await env.PORTAL_DB.batch([
      env.PORTAL_DB.prepare(
        `INSERT INTO portal_integration_state (state_key, state_value, updated_at)
         VALUES ('gmail_last_poll_at', ?, ?)
         ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at`,
      ).bind(now.toISOString(), nowIso(now)),
      env.PORTAL_DB.prepare("DELETE FROM portal_integration_state WHERE state_key = 'gmail_page_token'"),
    ]);
  } else if (pageToken) {
    await env.PORTAL_DB.prepare(
      `INSERT INTO portal_integration_state (state_key, state_value, updated_at)
       VALUES ('gmail_page_token', ?, ?)
       ON CONFLICT(state_key) DO UPDATE SET state_value = excluded.state_value, updated_at = excluded.updated_at`,
    ).bind(pageToken, nowIso(now)).run();
  }
  return { enabled: true, found, staged, failed, skipped };
}

class GmailIntegrationError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

async function refreshAccessToken(env: PortalEnv, fetcher: FetchLike): Promise<string> {
  const body = new URLSearchParams({
    client_id: env.GMAIL_CLIENT_ID!,
    client_secret: env.GMAIL_CLIENT_SECRET!,
    refresh_token: env.GMAIL_REFRESH_TOKEN!,
    grant_type: "refresh_token",
  });
  let response: Response;
  try {
    response = await fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    throw new GmailIntegrationError("token_endpoint_unavailable");
  }
  if (!response.ok) throw new GmailIntegrationError(response.status === 400 || response.status === 401 ? "token_refresh_rejected" : "token_endpoint_error");
  const token = await response.json() as { access_token?: string; token_type?: string; scope?: string };
  const scopes = token.scope?.split(/\s+/).filter(Boolean) ?? [];
  if (
    !token.access_token || token.token_type?.toLowerCase() !== "bearer" ||
    (token.scope !== undefined && (scopes.length !== 1 || scopes[0] !== REQUIRED_GMAIL_SCOPE))
  ) throw new GmailIntegrationError("token_scope_invalid");
  return token.access_token;
}

async function gmailJson<T extends GmailJsonResponse>(fetcher: FetchLike, token: string, path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetcher(`https://gmail.googleapis.com/gmail/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
  } catch {
    throw new GmailIntegrationError("gmail_unavailable");
  }
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? "gmail_access_rejected" : response.status === 404 ? "gmail_resource_gone" : "gmail_api_error";
    throw new GmailIntegrationError(code);
  }
  return response.json() as Promise<T>;
}

async function stageGmailMessage(
  db: Db,
  store: ObjectStore,
  fetcher: FetchLike,
  token: string,
  messageId: string,
): Promise<"staged" | "skipped"> {
  const existing = await db.prepare("SELECT id, status FROM vendor_email_events WHERE gmail_message_id = ?").bind(messageId).first<{ id: string; status: string }>();
  if (existing && existing.status !== "failed" && existing.status !== "processing") return "skipped";

  const message = await gmailJson<GmailMessageResponse>(fetcher, token, `users/me/messages/${encodeURIComponent(messageId)}?format=full`);
  const headers = message.payload?.headers ?? [];
  const header = (name: string) => headers.find((item) => item.name?.toLowerCase() === name.toLowerCase())?.value?.trim() ?? "";
  const subject = safeHeader(header("subject"), 400) || "(no subject)";
  const sender = safeHeader(header("from"), 320) || "(unknown sender)";
  const bodyText = extractPlainText(message.payload).slice(0, 100_000);
  const parsed = parseVendorMail(subject, `${message.snippet ?? ""}\n${bodyText}`);
  const date = message.internalDate ? new Date(Number(message.internalDate)).toISOString() : null;
  const eventId = existing?.id ?? newId("vem");
  const timestamp = nowIso();
  await db.prepare(
    `INSERT INTO vendor_email_events
       (id, gmail_message_id, gmail_thread_id, sender, subject, message_date, event_kind,
        vendor_order_number, carrier_name, tracking_number, tracking_url, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'processing', ?)
     ON CONFLICT(gmail_message_id) DO UPDATE SET
       gmail_thread_id = excluded.gmail_thread_id, sender = excluded.sender, subject = excluded.subject,
       message_date = excluded.message_date, event_kind = excluded.event_kind,
       vendor_order_number = excluded.vendor_order_number, carrier_name = excluded.carrier_name,
       tracking_number = excluded.tracking_number, tracking_url = excluded.tracking_url,
       status = 'processing', error_code = NULL, updated_at = excluded.updated_at`,
  ).bind(eventId, messageId, message.threadId ?? null, sender, subject, date, parsed.kind,
    parsed.orderNumber, parsed.carrier, parsed.trackingNumber, parsed.trackingUrl, timestamp).run();

  const candidate = parsed.orderNumber
    ? await db.prepare("SELECT id FROM material_requests WHERE vendor_order_number = ? AND status IN ('approved', 'ordered') LIMIT 2")
      .bind(parsed.orderNumber).all<{ id: string }>()
    : null;
  if (candidate?.results.length === 1) {
    await db.prepare("UPDATE vendor_email_events SET candidate_material_request_id = ?, match_reason = 'exact order number', updated_at = ? WHERE id = ?")
      .bind(candidate.results[0]!.id, timestamp, eventId).run();
  } else if (candidate && candidate.results.length > 1) {
    await db.prepare("UPDATE vendor_email_events SET match_reason = 'order number matches multiple requests', updated_at = ? WHERE id = ?")
      .bind(timestamp, eventId).run();
  }

  let totalBytes = 0;
  const parts = listFileParts(message.payload).slice(0, MAX_ATTACHMENTS_PER_MESSAGE);
  for (const part of parts) {
    const type = safeAttachmentType(part.mimeType ?? "", part.filename ?? "");
    const declaredSize = part.body?.size ?? 0;
    if (!type || declaredSize <= 0 || declaredSize > MAX_ATTACHMENT_BYTES || totalBytes + declaredSize > MAX_ATTACHMENT_BYTES_PER_MESSAGE) continue;
    const attachmentId = part.body?.attachmentId;
    const data = part.body?.data ?? (attachmentId
      ? (await gmailJson<AttachmentResponse>(fetcher, token, `users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`)).data
      : undefined);
    if (!data) continue;
    const bytes = decodeBase64Url(data);
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_ATTACHMENT_BYTES || totalBytes + bytes.byteLength > MAX_ATTACHMENT_BYTES_PER_MESSAGE) continue;
    totalBytes += bytes.byteLength;
    const checksum = await sha256(bytes);
    const safeId = attachmentId ?? checksum.slice(0, 32);
    const attachmentRow = await db.prepare("SELECT id, storage_key FROM vendor_email_attachments WHERE event_id = ? AND gmail_attachment_id = ?")
      .bind(eventId, safeId).first<{ id: string; storage_key: string }>();
    if (attachmentRow) continue;
    const attachmentRowId = newId("vea");
    const storageKey = `vendor-email/${eventId}/${await sha256(new TextEncoder().encode(safeId))}.${type.extension}`;
    await store.put(storageKey, bytes, { httpMetadata: { contentType: type.contentType }, sha256: checksum });
    await db.prepare(
      `INSERT OR IGNORE INTO vendor_email_attachments
         (id, event_id, gmail_attachment_id, storage_key, file_name, content_type, byte_size, checksum_sha256)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(attachmentRowId, eventId, safeId, storageKey, `Vendor attachment.${type.extension}`, type.contentType, bytes.byteLength, checksum).run();
  }

  await db.prepare("UPDATE vendor_email_events SET status = 'needs_review', updated_at = ? WHERE id = ?")
    .bind(timestamp, eventId).run();
  return "staged";
}

interface GmailMessageResponse extends GmailJsonResponse { payload?: GmailPart; snippet?: string; internalDate?: string; threadId?: string }
interface AttachmentResponse extends GmailJsonResponse { data?: string; size?: number }

function safeHeader(value: string, max: number): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}

function extractPlainText(root?: GmailPart): string {
  const parts: string[] = [];
  const visit = (part: GmailPart) => {
    if (part.mimeType?.toLowerCase() === "text/plain" && part.body?.data && !part.filename) {
      try { parts.push(new TextDecoder().decode(decodeBase64Url(part.body.data))); } catch { /* Ignore malformed body part. */ }
    }
    for (const child of part.parts ?? []) visit(child);
  };
  if (root) visit(root);
  return parts.join("\n");
}

function listFileParts(root?: GmailPart): GmailPart[] {
  const found: GmailPart[] = [];
  const visit = (part: GmailPart) => {
    if (part.filename && (part.body?.attachmentId || part.body?.data)) found.push(part);
    for (const child of part.parts ?? []) visit(child);
  };
  if (root) visit(root);
  return found;
}

function decodeBase64Url(encoded: string): Uint8Array {
  const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(encoded.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256(bytes: Uint8Array | string): Promise<string> {
  const input = typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes;
  const digest = await crypto.subtle.digest("SHA-256", input as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function markMessageFailed(db: Db, listed: { id: string; threadId?: string }, code: string, timestamp: string): Promise<void> {
  const existing = await db.prepare("SELECT id FROM vendor_email_events WHERE gmail_message_id = ?").bind(listed.id).first<{ id: string }>();
  if (existing) {
    await db.prepare("UPDATE vendor_email_events SET status = 'failed', error_code = ?, updated_at = ? WHERE id = ?")
      .bind(code, timestamp, existing.id).run();
    return;
  }
  await db.prepare(
    `INSERT OR IGNORE INTO vendor_email_events (id, gmail_message_id, gmail_thread_id, sender, subject,
      event_kind, status, error_code, created_at, updated_at)
     VALUES (?, ?, ?, '(unavailable)', '(message could not be fetched)', 'unknown', 'failed', ?, ?, ?)`,
  ).bind(newId("vem"), listed.id, listed.threadId ?? null, code, timestamp, timestamp).run();
}

async function dbMarkFailed(db: Db, id: string, code: string, timestamp: string): Promise<void> {
  await db.prepare("UPDATE vendor_email_events SET status = 'failed', error_code = ?, updated_at = ? WHERE id = ?")
    .bind(code, timestamp, id).run();
}

function safeErrorCode(error: unknown): string {
  return error instanceof GmailIntegrationError ? error.code : "message_processing_failed";
}
