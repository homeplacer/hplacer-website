// Client-safe types and pure helpers. NO Node (fs/path) imports here, so this
// module can be bundled into client components. The fs-backed data loader lives
// in homes.ts (server-only).

export type Brand = "Clayton" | "Cavco" | "Champion";

// Interior wall finish — a real quality/value signal buyers ask about.
// "drywall"          → true taped-and-textured drywall, standard (site-built look)
// "drywall-optional" → built with wall strips, but full drywall is an available upgrade
// "strips"           → pre-finished gypsum panels with batten "strips" (the budget look)
export type WallFinish = "drywall" | "drywall-optional" | "strips";

export interface FloorPlan {
  url: string;
  widthFt?: number; // set on multi-width plans so the 28'/32' toggle can switch
}

export interface Home {
  id: number;
  slug: string;
  brand: Brand;
  series: string;
  name: string; // clean display name, e.g. "Beacon", "Iron Clad 2852"
  modelCode: string; // manufacturer code/slug
  widthFt: number;
  lengthFt: number;
  sqft: number; // width × length (MLS total, per Joe's rule)
  beds: number;
  baths: number;
  description: string;
  excerpt: string;
  decorOptions: string[];
  imageUrls: string[];
  aka?: string[]; // common nicknames, searchable (e.g. "52 Breeze")
  wallFinish?: WallFinish; // interior wall finish (see WallFinish)
  bestSeller?: boolean;
  bestSellerRank?: number; // 0-based order among best-sellers; 999 if not
  // Distinct section widths this floor plan is offered in, e.g. [28, 32].
  // Omitted for single-width plans (treated as [widthFt]). Same length/beds
  // across widths — a wider section just means larger rooms.
  widthOptions?: number[];
  tourUrl?: string; // 3D/Matterport virtual-tour embed URL
  floorPlans?: FloorPlan[]; // shown in a dedicated section, NOT the photo gallery
  price?: number; // home-only price (pricing TBD)
  setupPrice?: number; // full-setup all-in: home + ¼-acre lot + setup + utilities (pricing TBD)
}

// A 32'-wide section is our threshold for "extra-large bedrooms" (vs. the
// typical 28' double-wide). Joe's call.
export const XL_WIDTH_FT = 32;

// Every section width this home can be ordered in (sorted, de-duped).
export function availableWidths(h: Home): number[] {
  const ws = h.widthOptions?.length ? h.widthOptions : [h.widthFt];
  return [...new Set(ws)].sort((a, b) => a - b);
}

// True when the home is — or can be ordered — 32' wide (extra-large bedrooms).
export function hasXlBedrooms(h: Home): boolean {
  return availableWidths(h).includes(XL_WIDTH_FT);
}

// True when offered in more than one width (e.g. 28' or 32').
export function isMultiWidth(h: Home): boolean {
  return availableWidths(h).length > 1;
}

// Square feet for a given section width — width × length (Joe's MLS rule).
export function sqftForWidth(h: Home, widthFt: number): number {
  return widthFt * h.lengthFt;
}

// "28′ or 32′ wide" / "32′ wide" — the widths this plan is offered in.
export function widthLabel(h: Home): string {
  return availableWidths(h).map((w) => `${w}′`).join(" or ") + " wide";
}

// "28×60 or 32×60" — the width×length footprint(s).
export function footprintLabel(h: Home): string {
  return availableWidths(h).map((w) => `${w}×${h.lengthFt}`).join(" or ");
}

// The advertised "Starting at" number — full-setup when we have it, else
// home-only. Returns undefined when no price is set yet.
export function displayPrice(h: Home): number | undefined {
  return h.setupPrice ?? h.price;
}

export function formatPrice(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// Price string for UI — formatted price or a graceful fallback while pricing
// is still being finalized.
export function priceLabel(h: Home): string {
  const p = displayPrice(h);
  return p != null ? formatPrice(p) : "Call for pricing";
}

// True when this home ships with true, site-built-quality full drywall as
// standard — the finish we highlight as a value upgrade.
export function isFullDrywall(h: Home): boolean {
  return h.wallFinish === "drywall";
}

// True when the home is built with wall strips but full drywall is an
// available upgrade (don't badge it as standard — frame it as "available").
export function isDrywallOptional(h: Home): boolean {
  return h.wallFinish === "drywall-optional";
}
