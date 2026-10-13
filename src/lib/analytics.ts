// Analytics accepts public route identifiers only, never form values or URL queries.
const modelSlugs = new Set([
  "ultra-flex-28-52",
  "ultra-flex-28-68",
  "ultra-flex-32-76",
  "beacon",
  "northstar",
  "aspire",
  "haven",
  "eclipse",
  "vision",
  "leo",
  "diamond",
  "hartford",
  "richmond",
  "vivid",
  "atmos",
  "ironclad-2856",
  "ironclad-3276",
  "ironclad-3276-21",
  "dutch-2963-ashley",
  "garner-3975",
  "dutch-elite-1676-01",
  "dutch-elite-1676-07",
  "dutch-elite-2852-02-spruce-pine",
  "piedmont",
  "greenwood",
  "dutch-elite-3258-03",
  "silver-birch",
  "shenandoah",
  "holston",
  "spirit",
  "intuition",
  "rally",
  "dynamic",
  "essence",
  "desire",
  "glimpse",
  "reveal",
  "purpose",
  "impact",
  "ambition",
  "empower",
  "thrive",
  "yesterday",
  "still-the-one",
  "born-to-run",
  "rhythm-nation",
  "move-on-up",
  "stayin-alive",
  "shout",
  "limelight",
  "rocket-man",
  "hey-jude",
  "corbin",
  "pinehurst",
  "sapona",
  "tanglewood",
  "birdie",
  "caddie",
  "palmer",
  "augusta",
  "pegasus",
  "axis",
  "sebastian",
  "reece",
  "ultra-flex-jewel-32-60",
  "ultra-a-plus-16-76",
  "vista",
  "pure-28563x",
  "palm-harbor-28563t",
  "heritage-pointe-32764d",
  "anniversary-76",
  "emerald",
  "lincoln",
  "phoenix",
  "kritzer-3256-04",
  "lake-manor-2856h32p01",
  "tradition-68",
  "clear-48",
  "summit-32483a",
  "summit-28603n",
  "summit-28564t",
  "pinnacle-16763b",
  "levi",
  "lexi",
  "wilder",
  "emilie",
  "lizzie",
  "isabella",
  "everett",
  "nellie",
  "tinsley",
  "brown-eyed-girl",
  "tradition-48f",
]);
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}
export function modelSlugFromPath(pathname: string): string | null {
  const slug = pathname.replace(/\/$/, "").split("/");
  return slug.length === 3 && slug[1] === "homes" && modelSlugs.has(slug[2])
    ? slug[2]
    : null;
}
export function analyticsPath(pathname: string): string {
  const model = modelSlugFromPath(pathname);
  if (model) return `/homes/${model}`;
  const section = pathname.split("/")[1];
  return [
    "homes",
    "brands",
    "land-packages",
    "recently-placed",
    "financing",
    "process",
    "warranty",
    "faq",
    "glossary",
    "locations",
    "blog",
    "about",
    "team",
    "contact",
    "careers",
    "service-request",
    "warranty-request",
    "gallery",
    "find-land",
    "buyer-resources",
    "packages",
    "guides",
    "stories",
    "permits",
    "manufactured-vs-site-built",
    "modular-vs-manufactured-homes",
    "mobile-home-vs-manufactured-home",
    "manufactured-home-drywall-vs-wall-strips",
  ].includes(section)
    ? `/${section}`
    : "/";
}
const allowedEvents = new Set([
  "page_view",
  "view_model",
  "view_financing",
  "form_start",
  "phone_call",
  "text_message",
  "email_click",
  "select_model",
  "pricing_inquiry",
  "financing_click",
  "land_search_click",
  "land_handoff",
  "existing_inventory_handoff",
  "generate_lead",
  "lead_submission_fallback",
  "view_package",
  "package_inquiry",
  "guide_view",
]);
const allowedValues: Record<string, readonly string[]> = {
  form_type: [
    "contact",
    "model_pricing",
    "financing",
    "subscribe",
    "service",
    "warranty",
    "careers",
    "inquiry",
  ],
  submission_method: ["api", "mailto"],
  placement: ["header", "footer", "main_content", "navigation", "contact_bar", "other"],
  destination: ["forturro.com"],
  // Which existing-inventory resale path a visitor chose on /land-packages.
  // Enum ONLY — never a URL, query string, referrer, address, or PII.
  inventory_type: ["all", "owned_land", "leased_land"],
};
// --- Privacy-preserving organic-search attribution --------------------------
// GA4 derives a session's source/medium from the referrer only when no campaign
// parameters are present. Every event here ships page_referrer:"" (a deliberate
// privacy safeguard that strips the full referring URL), which removes the signal
// GA4 would use to classify a Google-organic arrival — a plausible contributor to
// organic sessions landing under Direct (NOT a measured causal share). To let GA4
// classify Google organic WITHOUT leaking the referring URL, the initial landing
// page_view passes ONLY the bare, allowlisted referrer ORIGIN (scheme + host) —
// never the path, query, fragment, userinfo, a non-default port, or an arbitrary
// host.
//
// Scope is deliberately bounded to the canonical Google Search origins, the only
// source justified by the retained google/organic evidence (2026-09-10..10-08).
// Anything else resolves to "" and stays Direct. Broaden ONLY with evidence.
// NOTE: removing the signal-stripping does not by itself close the gap; the
// reclassification must be validated in GA4 DebugView before anything is declared
// fixed (session-source propagation is unverified here).
const APPROVED_REFERRER_ORIGINS = new Set<string>([
  "https://www.google.com",
  "https://google.com",
]);

// Pure and unit-testable (no window/document access). Returns an allowlisted
// origin, or "" for a direct, internal, unapproved, or malformed referrer.
export function approvedReferrerOrigin(
  referrer: string | null | undefined,
  currentOrigin: string,
): string {
  if (!referrer) return ""; // direct visit / no referrer
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return ""; // malformed → treat as direct
  }
  if (url.protocol !== "https:") return ""; // https only (drops app:// , http, data:, javascript:)
  if (url.username || url.password) return ""; // never pass userinfo/credentials
  if (url.port) return ""; // only the implicit default https port
  if (url.origin === currentOrigin) return ""; // internal navigation is not a source
  // Exact-origin allowlist → rejects arbitrary subdomains (e.g. www.google.com.evil).
  // url.origin is scheme+host only, so path/query/fragment are already excluded.
  return APPROVED_REFERRER_ORIGINS.has(url.origin) ? url.origin : "";
}

// Per-navigation page_referrer state (browser singleton; resets on full reload).
// Google's SPA guidance requires page_referrer to update correctly between virtual
// pageviews. So the EXTERNAL acquisition origin is attached to exactly one event —
// the initial landing page_view — and is never re-sent. Each later virtual
// page_view carries the PREVIOUS screen's sanitized internal location, and
// non-pageview actions carry "". This prevents the stale Google referrer (which
// document.referrer keeps through client-side navigation) from reintroducing an
// acquisition signal on a new session after a timeout / return-after-inactivity.
let hasLanded = false;
let previousPageLocation = "";
export function track(
  event: string,
  params: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined" || !allowedEvents.has(event)) return;
  window.dataLayer ||= [];
  window.gtag ||= function (...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== "string") continue;
    if (key === "model_context" && modelSlugs.has(value)) safe[key] = value;
    else if (key === "page_path") safe[key] = analyticsPath(value);
    else if (allowedValues[key]?.includes(value)) safe[key] = value;
  }
  const path = analyticsPath(window.location.pathname);
  const location = `https://hplacer.com${path}`;
  let referrer = "";
  if (event === "page_view") {
    if (!hasLanded) {
      // Initial landing: the only event that may carry an external acquisition
      // origin (allowlisted + origin-only).
      referrer = approvedReferrerOrigin(document.referrer, window.location.origin);
      hasLanded = true;
    } else {
      // Virtual pageview: the previous screen's sanitized internal location,
      // so the referrer updates correctly between screens (per GA4 SPA guidance)
      // without re-asserting the external origin.
      referrer = previousPageLocation;
    }
    previousPageLocation = location;
  }
  // Non-pageview actions keep referrer "" — never the external origin.
  window.gtag("event", event, {
    ...safe,
    page_location: location,
    page_referrer: referrer,
    page_title: `Home Placer ${path}`,
  });
}
