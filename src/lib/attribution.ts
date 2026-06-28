// First-touch attribution. Captured ONCE on the visitor's first page load and
// stashed in localStorage so it survives multi-page browsing and is still
// available whenever they later submit any form. First-touch wins: once stored
// we never overwrite, so an internal click-through (e.g. /land-packages →
// /contact) never clobbers the original Google/Facebook/etc. source. Purely
// additive — nothing here is user-visible. The capture key is shared with
// AttributionTracker; the read is consumed by submitLead().

const KEY = "hp_first_touch";

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  gclid?: string;
  fbclid?: string;
  referrer?: string;
  landing_page?: string;
  captured_at?: string;
}

// Query-string params we lift verbatim off the FIRST landing URL.
const URL_KEYS: (keyof Attribution)[] = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "fbclid",
];

// Run on every page load; no-ops after the first capture. Safe during SSR
// (guards window) and when storage is blocked (private mode) — never throws.
export function captureFirstTouch(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(KEY)) return; // first touch already recorded
    const params = new URLSearchParams(window.location.search);
    const data: Attribution = {};
    for (const k of URL_KEYS) {
      const v = params.get(k);
      if (v) data[k] = v;
    }
    const ref = document.referrer || "";
    // Keep only EXTERNAL referrers — drop same-host so we record the true source,
    // not an internal page, even if capture somehow runs after a soft nav.
    if (ref && !ref.includes(window.location.host)) data.referrer = ref;
    data.landing_page = window.location.href;
    data.captured_at = new Date().toISOString();
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private mode / cookies disabled) — fail silent.
  }
}

// Read back the stored first-touch attribution (empty object if none/blocked).
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}
