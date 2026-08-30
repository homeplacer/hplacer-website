import { site } from "./site";
import { track } from "./analytics";
import { getAttribution } from "./attribution";

type LeadData = Record<string, FormDataEntryValue | string | undefined>;

const TYPE_LABELS: Record<string, string> = {
  contact: "Website inquiry",
  financing: "Financing inquiry",
  service: "Service request",
  subscribe: "Email signup",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  phone: "Phone",
  email: "Email",
  home: "Home of interest",
  hasLand: "Has land?",
  address: "Home address",
  message: "Message",
};

function leadAnalyticsContext(type: string, data: LeadData): Record<string, string> {
  const home = typeof data.home === "string" ? data.home.trim().slice(0, 120) : "";
  return {
    form_type: type,
    submission_method: "api",
    page_path: typeof window === "undefined" ? "" : window.location.pathname,
    ...(home ? { model_context: home } : {}),
  };
}

function buildMailto(type: string, data: LeadData): string {
  const subject = `${TYPE_LABELS[type] ?? "Website lead"} — hplacer.com`;
  const lines = Object.entries(data)
    .filter(([k, v]) => v && k !== "type")
    .map(([k, v]) => `${FIELD_LABELS[k] ?? k}: ${v}`);
  const body = `${lines.join("\n")}\n\n— Sent from hplacer.com`;
  return `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Submit a lead. POSTs to the /api/lead route (Cloudflare Worker), which delivers
 * to Follow Up Boss + Resend when those are configured. On a 5xx / network failure
 * it falls back to opening a pre-filled email to the team so a lead is never
 * silently lost; a 4xx (validation) surfaces as an error so the user can fix it.
 * Returns how it went out so the form can show the right confirmation. Never throws.
 */
export async function submitLead(type: string, data: LeadData): Promise<"api" | "mailto" | "error"> {
  // First-touch attribution (utm_*, gclid, fbclid, referrer, landing page),
  // captured on the visitor's first page load. Additive — never affects the
  // user-visible form fields.
  const attribution = getAttribution();
  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...data, attribution }),
    });
    if (res.ok) {
      // A lead conversion is recorded only after the server confirms receipt.
      // Never pass name, email, phone, address, free-text messages, or any
      // attribution identifier to GA4.
      track("generate_lead", leadAnalyticsContext(type, data));
      return "api";
    }
    // The SERVER rejected the input (4xx: validation / payload too large). Opening
    // a mailto with the same bad data won't help and silently no-ops on mobile
    // without a mail client — surface an error so the user can correct it. A 5xx
    // (server down) falls through to the offline mailto fallback below.
    if (res.status >= 400 && res.status < 500) return "error";
    throw new Error("api unavailable");
  } catch {
    // This is not a confirmed lead: the visitor still has to send the email.
    // Keep it distinct from generate_lead so conversion reporting stays honest.
    track("lead_submission_fallback", { form_type: type, submission_method: "mailto" });
    if (typeof window !== "undefined") {
      window.location.href = buildMailto(type, { ...data, ...attribution });
    }
    return "mailto";
  }
}
