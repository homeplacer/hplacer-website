// Client-safe types and pure helpers. NO Node (fs/path) imports here, so this
// module can be bundled into client components. The fs-backed data loader lives
// in homes.ts (server-only).

export type Brand = "Clayton" | "Cavco" | "Champion";

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
  price?: number; // home-only price (pricing TBD)
  setupPrice?: number; // full-setup all-in: home + ¼-acre lot + setup + utilities (pricing TBD)
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
