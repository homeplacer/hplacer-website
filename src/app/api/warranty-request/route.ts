import { POST as deliverLead } from "../lead/route";

// Homeowner warranty requests from /warranty-request.
//
// This is the ONE place the public site talks to the employee portal. It runs
// server-side only: the browser posts here, and this handler forwards to
// portal.hplacer.com over a shared bearer token (plus a Cloudflare Access
// service token when one is configured). The portal is never called from the
// browser and its hostname is never exposed to it.
//
// Configuration (Cloudflare Worker secrets — see .env.example):
//   PORTAL_INTAKE_URL             https://portal.hplacer.com/api/public/warranty-requests
//   PORTAL_INTAKE_TOKEN           shared bearer token, matches the portal's binding
//   PORTAL_ACCESS_CLIENT_ID       optional Access service-token id
//   PORTAL_ACCESS_CLIENT_SECRET   optional Access service-token secret
//
// RESILIENCE: a homeowner with a broken furnace must never be dropped because a
// deploy is half-finished. If the portal is unconfigured or unreachable, the
// request falls back to the existing lead pipeline (/api/lead, type "service"),
// which is the same path the older service-request form uses. If BOTH fail we
// emit a single greppable "CRITICAL WARRANTY_NOT_DELIVERED" marker with the
// full payload and tell the customer to call. Photos cannot ride the fallback;
// the marker says so, and the customer is told we may ask for them again.

const MAX_PHOTOS = 6;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 40 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"];

interface WarrantyFields {
  name: string;
  phone: string;
  email: string;
  serial: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  summary: string;
  details: string;
  preferredContact: string;
  bestTime: string;
}

function readFields(form: FormData): WarrantyFields {
  const get = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim().slice(0, 2000) : "";
  };
  return {
    name: get("name"),
    phone: get("phone"),
    email: get("email"),
    serial: get("serial"),
    address: get("address"),
    city: get("city"),
    state: get("state"),
    zip: get("zip"),
    summary: get("summary"),
    details: get("details"),
    preferredContact: get("preferred_contact"),
    bestTime: get("best_time"),
  };
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Send the form as multipart/form-data." }, { status: 400 });
  }

  // Same honeypot the other forms use: a bot fills it, a person never sees it.
  if (typeof form.get("company") === "string" && (form.get("company") as string).trim() !== "") {
    return Response.json({ ok: true, reference: null });
  }

  const fields = readFields(form);
  if (!fields.name) return Response.json({ ok: false, error: "Please tell us your name." }, { status: 400 });
  if (!fields.summary) return Response.json({ ok: false, error: "Please tell us what's wrong." }, { status: 400 });
  if (!fields.phone && !fields.email) {
    return Response.json({ ok: false, error: "Leave a phone number or an email so we can reach you." }, { status: 400 });
  }

  const photos: File[] = [];
  let totalBytes = 0;
  for (const value of form.getAll("photos")) {
    if (typeof value === "string" || photos.length >= MAX_PHOTOS) continue;
    if (value.size === 0) continue;
    if (!ALLOWED_PHOTO_TYPES.includes(value.type)) continue;
    if (value.size > MAX_PHOTO_BYTES) continue;
    if (totalBytes + value.size > MAX_TOTAL_BYTES) break;
    totalBytes += value.size;
    photos.push(value);
  }

  const portalResult = await forwardToPortal(fields, photos);
  if (portalResult.ok) {
    return Response.json({ ok: true, reference: portalResult.reference, photos: photos.length });
  }

  // Portal unavailable — keep the customer, lose only the photos.
  const fallback = await deliverViaLeadPipeline(fields, photos.length, portalResult.reason);
  if (fallback) {
    console.warn(
      `WARRANTY_PORTAL_FALLBACK reason=${portalResult.reason} photos_dropped=${photos.length} name=${fields.name}`,
    );
    return Response.json({ ok: true, reference: null, photos: 0, degraded: true });
  }

  console.error(
    "CRITICAL WARRANTY_NOT_DELIVERED",
    JSON.stringify({
      at: new Date().toISOString(),
      reason: portalResult.reason,
      photos_dropped: photos.length,
      ...fields,
    }),
  );
  return Response.json(
    { ok: false, error: "We couldn't submit that. Please call our service line and we'll take it down for you." },
    { status: 503 },
  );
}

type PortalResult = { ok: true; reference: string | null } | { ok: false; reason: string };

async function forwardToPortal(fields: WarrantyFields, photos: File[]): Promise<PortalResult> {
  const url = process.env.PORTAL_INTAKE_URL;
  const token = process.env.PORTAL_INTAKE_TOKEN;
  if (!url || !token) return { ok: false, reason: "portal_not_configured" };

  const payload = new FormData();
  payload.set("customer_name", fields.name);
  if (fields.phone) payload.set("customer_phone", fields.phone);
  if (fields.email) payload.set("customer_email", fields.email);
  if (fields.preferredContact) payload.set("preferred_contact", fields.preferredContact);
  if (fields.bestTime) payload.set("best_time", fields.bestTime);
  if (fields.serial) payload.set("serial_number", fields.serial);
  if (fields.address) payload.set("address", fields.address);
  if (fields.city) payload.set("city", fields.city);
  if (fields.state) payload.set("state", fields.state);
  if (fields.zip) payload.set("postal_code", fields.zip);
  payload.set("issue_summary", fields.summary.slice(0, 200));
  if (fields.details) payload.set("issue_detail", fields.details);
  for (const photo of photos) payload.append("photos", photo, photo.name);

  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  // Second, independent gate when the portal sits behind an Access service-token policy.
  if (process.env.PORTAL_ACCESS_CLIENT_ID && process.env.PORTAL_ACCESS_CLIENT_SECRET) {
    headers["CF-Access-Client-Id"] = process.env.PORTAL_ACCESS_CLIENT_ID;
    headers["CF-Access-Client-Secret"] = process.env.PORTAL_ACCESS_CLIENT_SECRET;
  }

  try {
    const response = await fetch(url, { method: "POST", headers, body: payload });
    if (!response.ok) return { ok: false, reason: `portal_http_${response.status}` };
    const body = (await response.json()) as { reference?: string };
    return { ok: true, reference: body.reference ?? null };
  } catch (error) {
    return { ok: false, reason: `portal_unreachable:${error instanceof Error ? error.name : "unknown"}` };
  }
}

/** Reuses the site's existing lead delivery (Follow Up Boss + Resend) verbatim. */
async function deliverViaLeadPipeline(fields: WarrantyFields, photoCount: number, reason: string): Promise<boolean> {
  const message = [
    fields.summary,
    fields.details,
    fields.serial ? `Serial number: ${fields.serial}` : "",
    fields.bestTime ? `Best time to reach: ${fields.bestTime}` : "",
    fields.preferredContact ? `Prefers: ${fields.preferredContact}` : "",
    photoCount > 0 ? `NOTE: ${photoCount} photo(s) could not be delivered (${reason}). Ask the homeowner to resend.` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await deliverLead(
      new Request("https://hplacer.com/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "service",
          name: fields.name,
          phone: fields.phone,
          email: fields.email,
          address: [fields.address, fields.city, fields.state, fields.zip].filter(Boolean).join(", "),
          message,
        }),
      }),
    );
    return response.ok;
  } catch {
    return false;
  }
}
