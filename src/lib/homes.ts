import type { Brand, Home, FloorPlan, WallFinish } from "./home-types";
import { asset } from "./asset";
import rawModels from "../../data/models.json";
import setupPricingJson from "../../data/setup-pricing.json";
import homePricingJson from "../../data/home-pricing.json";

// The manufacturer-model inventory (data/models.json, built by
// scripts/build-models.mjs from the extraction workflow) is statically imported
// so it bundles into the server build — the Cloudflare Workers runtime has no
// filesystem at request time. Pricing is merged from two override files keyed by
// model slug (empty {} until finalized — homes show "Call for pricing").
//
// Types + pure helpers live in ./home-types so client components can use them
// without bundling this module. Re-exported here for convenience.
export type { Brand, Home } from "./home-types";
export { formatPrice, displayPrice, priceLabel } from "./home-types";

// Coerce a raw pricing value into a clean positive dollar amount, or null to
// ignore it. Accepts the shapes a human might actually enter so a formatting slip
// degrades to "Call for pricing" instead of rendering "[object Object]" or NaN on
// every card (and breaking the price sort/filter, which do arithmetic on this):
//   264900                                  the canonical shape (a number)
//   "264900" / "$264,900"                   a string, e.g. pasted from a quote
//   { setupPrice: 275000, price: 245000 }   an object — the shape the platform
//                                           roadmap documents; pick the field this
//                                           file is for, else fall back sensibly.
function coercePrice(raw: unknown, prefer: "price" | "setupPrice"): number | null {
  const num = (v: unknown): number | null => {
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const cleaned = v.replace(/[^0-9.]/g, "");
      return cleaned ? Number(cleaned) : null;
    }
    return null;
  };

  let n: number | null;
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    n = num(o[prefer] ?? o.setupPrice ?? o.price ?? o.value);
  } else {
    n = num(raw);
  }
  return n != null && Number.isFinite(n) && n > 0 ? n : null;
}

// Sanitize a pricing map (statically imported JSON) into a clean slug → dollars
// map. Invalid entries are dropped (with a warning) rather than trusted, so a
// malformed pricing file can never break /homes. 0 / null / "" are treated as
// intentional "not priced yet" placeholders (quiet).
function normalizePricing(
  raw: unknown,
  prefer: "price" | "setupPrice",
  label: string,
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    const n = coercePrice(value, prefer);
    if (n == null) {
      const placeholder = value === 0 || value === null || value === "";
      if (!placeholder) {
        console.warn(`[hplacer] ignoring invalid ${prefer} for "${slug}" in ${label}:`, value);
      }
      continue;
    }
    if (n < 10000) {
      console.warn(
        `[hplacer] ${prefer} for "${slug}" looks low ($${n}) in ${label}. If you meant thousands, write ${n}000. Using as-is.`,
      );
    }
    out[slug] = n;
  }
  return out;
}

const setupPricing = normalizePricing(setupPricingJson, "setupPrice", "setup-pricing.json");
const homePricing = normalizePricing(homePricingJson, "price", "home-pricing.json");

interface RawModel {
  slug: string;
  brand: Brand;
  series: string;
  name: string;
  modelCode: string;
  widthFt: number;
  lengthFt: number;
  sqft: number;
  beds: number;
  baths: number;
  description: string;
  decorOptions: string[];
  imageUrls: string[];
  aka?: string[];
  wallFinish?: WallFinish;
  bestSeller?: boolean;
  bestSellerRank?: number;
  widthOptions?: number[];
  tourUrl?: string;
  floorPlans?: FloorPlan[];
  sourceUrl: string;
}

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

let cache: Home[] | null = null;

export function getAllHomes(): Home[] {
  if (cache) return cache;

  const models = rawModels as unknown as RawModel[];

  const homes: Home[] = models.map((m, i) => ({
    id: i + 1,
    slug: m.slug,
    brand: m.brand,
    series: m.series,
    name: m.name,
    modelCode: m.modelCode,
    widthFt: m.widthFt,
    lengthFt: m.lengthFt,
    sqft: m.sqft,
    beds: m.beds,
    baths: m.baths,
    description: m.description,
    excerpt: firstSentence(m.description),
    decorOptions: m.decorOptions ?? [],
    imageUrls: (m.imageUrls ?? []).map(asset),
    aka: m.aka ?? [],
    wallFinish: m.wallFinish,
    bestSeller: m.bestSeller ?? false,
    bestSellerRank: m.bestSellerRank ?? 999,
    widthOptions: m.widthOptions,
    tourUrl: m.tourUrl,
    floorPlans: (m.floorPlans ?? []).map((f) => ({ ...f, url: asset(f.url) })),
    price: homePricing[m.slug],
    setupPrice: setupPricing[m.slug],
  }));

  // Group by brand, largest first within a brand — a sensible default until
  // pricing-based sorting is available.
  homes.sort((a, b) => a.brand.localeCompare(b.brand) || b.sqft - a.sqft);

  cache = homes;
  return homes;
}

export function getHome(slug: string): Home | undefined {
  return getAllHomes().find((h) => h.slug === slug);
}

export function getHomesByBrand(brand: Brand): Home[] {
  return getAllHomes().filter((h) => h.brand === brand);
}

export function bestSellerHomes(): Home[] {
  return getAllHomes()
    .filter((h) => h.bestSeller)
    .sort((a, b) => (a.bestSellerRank ?? 999) - (b.bestSellerRank ?? 999));
}

// Homes that ship with true, site-built-quality full drywall as standard.
export function fullDrywallHomes(): Home[] {
  return getAllHomes().filter((h) => h.wallFinish === "drywall");
}

export function featuredHomes(n = 6): Home[] {
  // a spread across brands rather than N from one brand
  const all = getAllHomes();
  const byBrand: Record<string, Home[]> = {};
  for (const h of all) (byBrand[h.brand] ??= []).push(h);
  const brands = Object.keys(byBrand);
  const picks: Home[] = [];
  let i = 0;
  while (picks.length < Math.min(n, all.length)) {
    const next = byBrand[brands[i % brands.length]].shift();
    if (next) picks.push(next);
    i++;
    if (i > all.length * 2) break;
  }
  return picks;
}

export const BRANDS: { brand: Brand; blurb: string }[] = [
  {
    brand: "Clayton",
    blurb:
      "America's best-known builder. Energy-smart construction and a deep lineup — from the value-minded Horizon to the spacious Giles and Ultra Flex series.",
  },
  {
    brand: "Cavco",
    blurb:
      "Modern, light-filled floor plans with upgraded finishes. The Vivid and Atmos lines bring real design to an affordable footprint.",
  },
  {
    brand: "Champion",
    blurb:
      "Durable, well-equipped homes built for the Carolina climate — the rugged Iron Clad and the feature-rich Dutch Elite, available with 9-ft ceilings.",
  },
];
