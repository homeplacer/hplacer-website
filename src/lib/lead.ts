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
      track("generate_lead", { form_type: type, method: "api" });
      return "api";
    }
    // The SERVER rejected the input (4xx: validation / payload too large). Opening
    // a mailto with the same bad data won't help and silently no-ops on mobile
    // without a mail client — surface an error so the user can correct it. A 5xx
    // (server down) falls through to the offline mailto fallback below.
    if (res.status >= 400 && res.status < 500) return "error";
    throw new Error("api unavailable");
  } catch {
    track("generate_lead", { form_type: type, method: "mailto" });
    if (typeof window !== "undefined") {
      window.location.href = buildMailto(type, { ...data, ...attribution });
    }
    return "mailto";
  }
}
