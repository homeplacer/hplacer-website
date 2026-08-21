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
import { attachWarrantyPhotosToTicket, intakeWarrantyRequest, type WarrantyIntakeInput } from "../domain/warranty.ts";
import { PortalError, badRequest, isPortalError } from "../platform/errors.ts";
import type { PortalEnv } from "../platform/types.ts";
import { json } from "../api/responses.ts";

export const PUBLIC_INTAKE_PATH = "/api/public/warranty-requests";

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
  return pathname === PUBLIC_INTAKE_PATH && (method === "POST" || method === "GET" || method === "HEAD");
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
