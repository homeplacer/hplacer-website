/**
 * The one route on the portal that is not behind an employee identity.
 *
 * hplacer.com's server calls it when a homeowner submits the warranty form. It
 * is deliberately narrow:
 *
 *  - one path, one method: `POST /api/public/warranty-requests`;
 *  - a shared bearer token, compared in constant time, that must be configured
 *    or the route returns 503 (fail closed, same as Access);
 *  - it only ever *writes* a warranty request — no route here reads portal data;
 *  - the response carries a reference number and nothing else, so an
 *    unauthenticated caller cannot use it to find out whether a serial number,
 *    an address, or a phone number is one of ours;
 *  - every call is written to the audit log, accepted or refused.
 *
 * In production it should *also* sit behind a Cloudflare Access service-token
 * policy, which the marketing Worker satisfies with `CF-Access-Client-Id` and
 * `CF-Access-Client-Secret`. That is a second, independent gate — see
 * portal/README.md. The token check here does not depend on it.
 */
import { recordAudit } from "../domain/audit.ts";
import { uploadPhoto } from "../domain/documents.ts";
import { notifyCategory } from "../domain/notifications.ts";
import { newId, nowIso } from "../platform/ids.ts";
import { attachWarrantyPhotosToTicket, intakeWarrantyRequest, type WarrantyIntakeInput } from "../domain/warranty.ts";
import { PortalError, badRequest, isPortalError } from "../platform/errors.ts";
import type { PortalEnv } from "../platform/types.ts";
import { json } from "../api/responses.ts";

export const PUBLIC_INTAKE_PATH = "/api/public/warranty-requests";
export const PUBLIC_JOB_APPLICATION_PATH = "/api/public/job-applications";

const MAX_PHOTOS = 6;
const MAX_TOTAL_BYTES = 48 * 1024 * 1024;

/** Length-independent comparison, so a wrong token cannot be found byte by byte. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  // Compare a fixed-size digest-shaped buffer so length alone leaks nothing.
  const size = Math.max(left.length, right.length, 32);
  let diff = left.length ^ right.length;
  for (let i = 0; i < size; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

function presentedToken(request: Request): string | null {
  const header = request.headers.get("Authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return request.headers.get("X-Portal-Intake-Token")?.trim() ?? null;
}

export function isPublicIntakeRequest(method: string, pathname: string): boolean {
  return (pathname === PUBLIC_INTAKE_PATH || pathname === PUBLIC_JOB_APPLICATION_PATH)
    && (method === "POST" || method === "GET" || method === "HEAD");
}

/**
 * Handles the intake call end to end. Called from `app.ts` before any employee
 * identity is resolved, and never reached for any other path.
 */
export async function handlePublicWarrantyIntake(request: Request, env: PortalEnv, requestId: string): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed", message: "POST a warranty request here" }, 405);
  }

  const audit = async (outcome: "allowed" | "denied", detail: string, entityId?: string | null) => {
    try {
      await recordAudit(env.PORTAL_DB, {
        actorEmail: "public:warranty-intake",
        action: `POST ${PUBLIC_INTAKE_PATH}`,
        entityType: "warranty_request",
        entityId: entityId ?? null,
        outcome,
        detail,
        requestId,
      });
    } catch {
      // Never let the audit write decide whether a homeowner's request lands.
    }
  };

  const expected = env.PORTAL_INTAKE_TOKEN?.trim();
  if (!expected) {
    await audit("denied", "intake token is not configured");
    return json({ error: "intake_unconfigured", message: "Warranty intake is not configured" }, 503);
  }

  const presented = presentedToken(request);
  if (!presented || !timingSafeEqual(presented, expected)) {
    await audit("denied", presented ? "intake token did not match" : "no intake token presented");
    return json({ error: "unauthorized", message: "Not authorized" }, 401);
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > MAX_TOTAL_BYTES) {
    await audit("denied", "payload too large");
    return json({ error: "too_large", message: "That submission is too large" }, 413);
  }

  try {
    const { input, photos } = await readSubmission(request);
    const result = await intakeWarrantyRequest(env.PORTAL_DB, input);

    let stored = 0;
    for (const photo of photos.slice(0, MAX_PHOTOS)) {
      try {
        await uploadPhoto(env.PORTAL_DB, env.PORTAL_PHOTOS, null, {
          documentType: "photo",
          fileName: photo.name || "photo.jpg",
          contentType: photo.type || "application/octet-stream",
          bytes: await photo.arrayBuffer(),
          caption: "Submitted with the warranty request",
          target: { warrantyRequestId: result.requestId },
        });
        stored += 1;
      } catch (error) {
        // A bad photo must never cost us the request itself.
        console.warn(`portal intake ${requestId}: photo rejected — ${isPortalError(error) ? error.message : "upload failed"}`);
      }
    }

    // The ticket was opened before these landed; move them onto it now.
    if (stored > 0) await attachWarrantyPhotosToTicket(env.PORTAL_DB, result.requestId);

    await audit(
      "allowed",
      `${result.reference} ${result.needsReview ? "needs review" : `matched (${result.method})`}, ${stored} photo(s)`,
      result.requestId,
    );

    // Reference only. Whether we recognised the home is not the caller's business.
    return json({ received: true, reference: result.reference, photos: stored }, 201);
  } catch (error) {
    const status = isPortalError(error) ? error.status : 500;
    const message = isPortalError(error) ? error.message : "Could not record that request";
    await audit("denied", `${status}: ${message}`);
    if (!isPortalError(error)) console.error(`portal intake ${requestId}`, error);
    return json({ error: isPortalError(error) ? error.code : "internal_error", message }, status);
  }
}

const MAX_RESUME_BYTES = 10 * 1024 * 1024;
const RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

interface JobApplicationInput {
  position: string;
  applicantName: string;
  email: string;
  phone: string;
  cityState: string | null;
  availableDate: string | null;
  experience: string | null;
  credentials: string | null;
  references: string | null;
}

/**
 * Private, write-only job intake. It deliberately returns no applicant data,
 * does not list applications, and keeps an optional resume in the private R2
 * bucket instead of exposing a public object URL.
 */
export async function handlePublicJobApplicationIntake(request: Request, env: PortalEnv, requestId: string): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed", message: "POST a job application here" }, 405);
  }

  const audit = async (outcome: "allowed" | "denied", detail: string, entityId?: string | null) => {
    try {
      await recordAudit(env.PORTAL_DB, {
        actorEmail: "public:job-application-intake",
        action: `POST ${PUBLIC_JOB_APPLICATION_PATH}`,
        entityType: "job_application",
        entityId: entityId ?? null,
        outcome,
        detail,
        requestId,
      });
    } catch {
      // An audit outage must not lose an otherwise valid applicant.
    }
  };

  const expected = env.PORTAL_JOB_APPLICATION_TOKEN?.trim();
  if (!expected) {
    await audit("denied", "job application token is not configured");
    return json({ error: "intake_unconfigured", message: "Job application intake is not configured" }, 503);
  }
  const presented = presentedToken(request);
  if (!presented || !timingSafeEqual(presented, expected)) {
    await audit("denied", presented ? "job application token did not match" : "no job application token presented");
    return json({ error: "unauthorized", message: "Not authorized" }, 401);
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (contentLength > MAX_RESUME_BYTES + 256 * 1024) {
    await audit("denied", "payload too large");
    return json({ error: "too_large", message: "That application is too large" }, 413);
  }

  try {
    const { input, resume } = await readJobApplication(request);
    const id = newId("app");
    const reference = await nextApplicationReference(env.PORTAL_DB);
    let resumeKey: string | null = null;
    let resumeName: string | null = null;
    let resumeType: string | null = null;
    let resumeBytes: number | null = null;

    if (resume) {
      if (!env.PORTAL_PHOTOS) throw badRequest("Resume storage is not configured");
      if (!RESUME_TYPES.has(resume.type)) throw badRequest("Resume must be a PDF, DOC, or DOCX file");
      if (resume.size === 0) throw badRequest("The resume file is empty");
      if (resume.size > MAX_RESUME_BYTES) throw badRequest("Resumes must be 10 MB or smaller");
      resumeName = safeFileName(resume.name || "resume");
      resumeType = resume.type;
      resumeBytes = resume.size;
      resumeKey = `job-applications/${new Date().getUTCFullYear()}/${id}/${resumeName}`;
    }

    await env.PORTAL_DB.prepare(
      `INSERT INTO job_applications (
        id, reference, position, applicant_name, email, phone, city_state,
        available_date, experience, credentials, references_text, resume_key, resume_file_name,
        resume_content_type, resume_byte_size, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'received', ?, ?)`,
    ).bind(
      id, reference, input.position, input.applicantName, input.email, input.phone,
      input.cityState, input.availableDate, input.experience, input.credentials, input.references,
      resumeKey, resumeName, resumeType, resumeBytes, nowIso(), nowIso(),
    ).run();

    if (resume && resumeKey) {
      try {
        await env.PORTAL_PHOTOS!.put(resumeKey, await resume.arrayBuffer(), {
          httpMetadata: { contentType: resumeType ?? "application/octet-stream" },
          customMetadata: { applicationId: id, kind: "resume" },
        });
      } catch (error) {
        await env.PORTAL_DB.prepare("UPDATE job_applications SET resume_key = NULL, resume_file_name = NULL, resume_content_type = NULL, resume_byte_size = NULL, updated_at = ? WHERE id = ?")
          .bind(nowIso(), id).run();
        throw error;
      }
    }

    try {
      await notifyCategory(env.PORTAL_DB, {
        category: "job_application",
        severity: "info",
        title: "New job application",
        body: `${input.applicantName} applied for ${input.position}.`,
        relatedType: "job_application",
        relatedId: id,
        dedupeKey: null,
      });
    } catch (error) {
      console.warn(`portal job application ${requestId}: notification failed`, error);
    }

    await audit("allowed", `${reference} received${resumeKey ? " with resume" : ""}`, id);
    return json({ received: true, reference }, 201);
  } catch (error) {
    const status = isPortalError(error) ? error.status : 500;
    const message = isPortalError(error) ? error.message : "Could not record that application";
    await audit("denied", `${status}: ${message}`);
    if (!isPortalError(error)) console.error(`portal job application ${requestId}`, error);
    return json({ error: isPortalError(error) ? error.code : "internal_error", message }, status);
  }
}

interface Submission {
  input: WarrantyIntakeInput;
  photos: File[];
}

async function readSubmission(request: Request): Promise<Submission> {
  const contentType = request.headers.get("Content-Type") ?? "";

  if (contentType.includes("application/json")) {
    let parsed: Record<string, unknown>;
    try {
      parsed = (await request.json()) as Record<string, unknown>;
    } catch {
      throw badRequest("Body is not valid JSON");
    }
    return { input: toInput((key) => stringOrNull(parsed[key])), photos: [] };
  }

  if (contentType.includes("multipart/form-data") || contentType.includes("form-urlencoded")) {
    const form = await request.formData();
    const photos: File[] = [];
    for (const [key, value] of form.entries()) {
      if (key === "photo" || key === "photos") {
        if (typeof value !== "string") photos.push(value);
      }
    }
    return { input: toInput((key) => (typeof form.get(key) === "string" ? (form.get(key) as string) : null)), photos };
  }

  throw new PortalError(415, "unsupported_media_type", "Send JSON or a multipart form");
}

function stringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  return String(value);
}

async function readJobApplication(request: Request): Promise<{ input: JobApplicationInput; resume: File | null }> {
  const contentType = request.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    let parsed: Record<string, unknown>;
    try { parsed = (await request.json()) as Record<string, unknown>; } catch { throw badRequest("Body is not valid JSON"); }
    return { input: toJobApplicationInput((key) => stringOrNull(parsed[key])), resume: null };
  }
  if (contentType.includes("multipart/form-data") || contentType.includes("form-urlencoded")) {
    const form = await request.formData();
    const candidate = form.get("resume");
    return {
      input: toJobApplicationInput((key) => (typeof form.get(key) === "string" ? form.get(key) as string : null)),
      resume: typeof candidate === "string" || !candidate ? null : candidate,
    };
  }
  throw new PortalError(415, "unsupported_media_type", "Send JSON or a multipart form");
}

function toJobApplicationInput(read: (key: string) => string | null): JobApplicationInput {
  // A hidden website field gives the public form a low-friction bot trap.
  if ((read("website") ?? "").trim()) throw badRequest("Could not accept that application");
  const required = (key: string, label: string, max: number): string => {
    const value = (read(key) ?? "").trim();
    if (!value) throw badRequest(`${label} is required`);
    if (value.length > max) throw badRequest(`${label} is too long`);
    return value;
  };
  const optional = (key: string, max: number): string | null => {
    const value = (read(key) ?? "").trim();
    if (!value) return null;
    if (value.length > max) throw badRequest(`${key.replace(/_/g, " ")} is too long`);
    return value;
  };
  const email = required("email", "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest("Enter a valid email address");
  return {
    position: required("position", "Position", 120),
    applicantName: required("name", "Name", 160),
    email,
    phone: required("phone", "Phone", 50),
    cityState: optional("city_state", 160),
    availableDate: optional("available_date", 32),
    experience: optional("experience", 10000),
    credentials: optional("credentials", 2000),
    references: optional("references", 6000),
  };
}

function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "resume";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "-").replace(/-{2,}/g, "-").slice(0, 120);
  return cleaned.replace(/^[.-]+/, "") || "resume";
}

async function nextApplicationReference(db: PortalEnv["PORTAL_DB"]): Promise<string> {
  const year = new Date().getUTCFullYear();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const row = await db.prepare("SELECT count(*) AS n FROM job_applications WHERE reference LIKE ?").bind(`JA-${year}-%`).first<{ n: number }>();
    const candidate = `JA-${year}-${String((row?.n ?? 0) + 1).padStart(4, "0")}`;
    const exists = await db.prepare("SELECT id FROM job_applications WHERE reference = ?").bind(candidate).first<{ id: string }>();
    if (!exists) return candidate;
  }
  throw new PortalError(409, "reference_conflict", "Could not allocate an application reference — try again");
}

function toInput(read: (key: string) => string | null): WarrantyIntakeInput {
  const preferred = read("preferred_contact");
  return {
    customerName: read("customer_name") ?? read("name") ?? "",
    customerPhone: read("customer_phone") ?? read("phone"),
    customerEmail: read("customer_email") ?? read("email"),
    preferredContact: preferred === "phone" || preferred === "email" || preferred === "text" ? preferred : null,
    bestTime: read("best_time"),
    serialNumber: read("serial_number") ?? read("serial"),
    address: read("address"),
    city: read("city"),
    state: read("state"),
    postalCode: read("postal_code") ?? read("zip"),
    issueSummary: read("issue_summary") ?? read("summary") ?? "",
    issueDetail: read("issue_detail") ?? read("message") ?? read("details"),
    source: "public_site",
  };
}
