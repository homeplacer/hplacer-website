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
};
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
  window.gtag("event", event, {
    ...safe,
    page_location: `https://hplacer.com${path}`,
    page_referrer: "",
    page_title: `Home Placer ${path}`,
  });
}
