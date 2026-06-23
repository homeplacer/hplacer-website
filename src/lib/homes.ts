import fs from "node:fs";
import path from "node:path";
import type { Brand, Home } from "./home-types";
import { asset } from "./asset";

// Reads the manufacturer-model inventory (data/models.json, built by
// scripts/build-models.mjs from the extraction workflow) at request time on the
// server. Pricing, when finalized, is merged from two optional override files
// keyed by model slug — until then homes show "Call for pricing".
//
// Types + pure helpers live in ./home-types so client components can use them
// without bundling this fs-backed module. Re-exported here for convenience.
export type { Brand, Home } from "./home-types";
export { formatPrice, displayPrice, priceLabel } from "./home-types";

const MODELS_FILE = path.join(process.cwd(), "data", "models.json");
const SETUP_PRICING_FILE = path.join(process.cwd(), "data", "setup-pricing.json");
const HOME_PRICING_FILE = path.join(process.cwd(), "data", "home-pricing.json");

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
  bestSeller?: boolean;
  bestSellerRank?: number;
  sourceUrl: string;
}

function loadPricing(file: string): Record<string, number> {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

let cache: Home[] | null = null;

export function getAllHomes(): Home[] {
  if (cache) return cache;

  const models = JSON.parse(fs.readFileSync(MODELS_FILE, "utf8")) as RawModel[];
  const setupPricing = loadPricing(SETUP_PRICING_FILE);
  const homePricing = loadPricing(HOME_PRICING_FILE);

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
    bestSeller: m.bestSeller ?? false,
    bestSellerRank: m.bestSellerRank ?? 999,
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
