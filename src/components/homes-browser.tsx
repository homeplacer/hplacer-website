"use client";

import { useEffect, useMemo, useState } from "react";
import type { Home, Brand } from "@/lib/home-types";
import { displayPrice, hasXlBedrooms, isFullDrywall, availableWidths, sqftForWidth } from "@/lib/home-types";
import { HomeCard } from "@/components/home-card";

type BrandTab = "All" | Brand;
const BRAND_ORDER: Brand[] = ["Clayton", "Cavco", "Champion"];

const BED_OPTIONS = [
  { label: "Any beds", value: 0 },
  { label: "2+ beds", value: 2 },
  { label: "3+ beds", value: 3 },
  { label: "4+ beds", value: 4 },
];
const SQFT_STEPS = [0, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400];
const PRICE_STEPS = [0, 200000, 220000, 240000, 260000, 280000, 300000];

// Single-wides are 14 or 16 ft wide; anything wider is a double-wide.
// "32′ XL" = offered in a 32-ft section (extra-large bedrooms).
const WIDTH_TYPES = [
  { label: "All widths", value: "all" },
  { label: "Single-wide", value: "single" },
  { label: "Double-wide", value: "double" },
  { label: "32′ XL", value: "xl" },
] as const;
type WidthType = (typeof WIDTH_TYPES)[number]["value"];
const isSingleWide = (h: Home) => h.widthFt <= 16;

// Sqft spanning every available section width (so a 28'/32' plan filters and
// sorts on its full range, not just the 28' base value).
const sqftSpan = (h: Home) => {
  const ws = availableWidths(h);
  return { min: sqftForWidth(h, ws[0]), max: sqftForWidth(h, ws[ws.length - 1]) };
};

const SORTS = [
  { label: "Best selling", value: "best" },
  { label: "Largest first", value: "sqft-desc" },
  { label: "Smallest first", value: "sqft-asc" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
] as const;
type Sort = (typeof SORTS)[number]["value"];

const fmtK = (n: number) => `$${Math.round(n / 1000)}k`;

export function HomesBrowser({
  homes,
  initialBrand = "All",
}: {
  homes: Home[];
  initialBrand?: BrandTab;
}) {
  const brandTabs = useMemo<BrandTab[]>(() => {
    const present = new Set(homes.map((h) => h.brand));
    return ["All", ...BRAND_ORDER.filter((b) => present.has(b))];
  }, [homes]);

  const [brand, setBrand] = useState<BrandTab>(brandTabs.includes(initialBrand) ? initialBrand : "All");
  const [widthType, setWidthType] = useState<WidthType>("all");
  const [query, setQuery] = useState("");
  const [minBeds, setMinBeds] = useState(0);
  const [minSqft, setMinSqft] = useState(0);
  const [maxSqft, setMaxSqft] = useState(Infinity);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(Infinity);
  const [drywallOnly, setDrywallOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("best");

  // While no home has a price (pre-launch pricing), the price sort + price range
  // filter are dead controls — hide them rather than show empty/no-op options.
  const anyPriced = useMemo(() => homes.some((h) => displayPrice(h) != null), [homes]);
  const sortOptions = anyPriced ? SORTS : SORTS.filter((o) => !o.value.startsWith("price-"));

  // Deep-link support: ?brand=Clayton, ?wall=drywall. Read on mount — URL params
  // aren't available during SSR, so this must be an effect (an initializer would
  // hydration-mismatch). Setting state here is the intended use.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const b = params.get("brand");
    if (b) {
      const match = brandTabs.find((t) => t.toLowerCase() === b.toLowerCase());
      if (match) setBrand(match);
    }
    if (params.get("wall") === "drywall") setDrywallOnly(true);
  }, [brandTabs]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = homes.filter((h) => {
      if (brand !== "All" && h.brand !== brand) return false;
      if (widthType === "single" && !isSingleWide(h)) return false;
      if (widthType === "double" && isSingleWide(h)) return false;
      if (widthType === "xl" && !hasXlBedrooms(h)) return false;
      if (drywallOnly && !isFullDrywall(h)) return false;
      if (h.beds < minBeds) return false;
      // Keep the home if ANY of its available widths falls in the sqft range.
      const { min: loSqft, max: hiSqft } = sqftSpan(h);
      if (hiSqft < minSqft || loSqft > maxSqft) return false;
      if (q && !`${h.name} ${h.series} ${h.brand} ${h.modelCode} ${(h.aka ?? []).join(" ")}`.toLowerCase().includes(q)) return false;
      // Price filter only applies to homes that have a price set.
      if (minPrice > 0 || maxPrice < Infinity) {
        const dp = displayPrice(h);
        if (dp == null || dp < minPrice || dp > maxPrice) return false;
      }
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sort === "best")
        return ((a.bestSellerRank ?? 999) - (b.bestSellerRank ?? 999)) || sqftSpan(b).max - sqftSpan(a).max;
      if (sort === "price-asc") return (displayPrice(a) ?? Infinity) - (displayPrice(b) ?? Infinity);
      if (sort === "price-desc") return (displayPrice(b) ?? -Infinity) - (displayPrice(a) ?? -Infinity);
      if (sort === "sqft-asc") return sqftSpan(a).min - sqftSpan(b).min;
      return sqftSpan(b).max - sqftSpan(a).max;
    });
  }, [homes, brand, widthType, query, minBeds, minSqft, maxSqft, minPrice, maxPrice, drywallOnly, sort]);

  const selectClass =
    "rounded-lg border border-stone-line bg-stone-bg px-3 py-2 text-sm font-medium text-stone-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

  function reset() {
    setBrand("All");
    setWidthType("all");
    setQuery("");
    setMinBeds(0);
    setMinSqft(0);
    setMaxSqft(Infinity);
    setMinPrice(0);
    setMaxPrice(Infinity);
    setDrywallOnly(false);
  }

  const hasFilters =
    brand !== "All" || widthType !== "all" || query || minBeds || minSqft || maxSqft < Infinity || minPrice || maxPrice < Infinity || drywallOnly;

  return (
    <div>
      <div className="sticky top-16 z-30 -mx-5 mb-8 border-y border-stone-line bg-stone-surface/95 px-5 py-4 backdrop-blur md:mx-0 md:rounded-card md:border md:px-5">
        {/* Search box */}
        <div className="relative">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a model — e.g. “52 Breeze”, “Shout”, “Atmos”…"
            aria-label="Search homes"
            className="w-full rounded-full border border-stone-line bg-stone-bg py-2.5 pl-11 pr-4 text-sm text-stone-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <svg
            className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-stone-muted"
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <div className="flex flex-wrap gap-1.5">
            {brandTabs.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrand(b)}
                aria-pressed={b === brand}
                className={
                  b === brand
                    ? "rounded-full bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white"
                    : "rounded-full border border-stone-line bg-stone-bg px-3.5 py-2 text-sm font-medium text-stone-ink hover:border-brand-300"
                }
              >
                {b}
              </button>
            ))}
          </div>

          <span className="hidden h-6 w-px bg-stone-line sm:block" />

          {/* Single- vs double-wide */}
          <div className="flex flex-wrap gap-1.5">
            {WIDTH_TYPES.map((w) => (
              <button
                key={w.value}
                type="button"
                onClick={() => setWidthType(w.value)}
                aria-pressed={w.value === widthType}
                className={
                  w.value === widthType
                    ? "rounded-full bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white"
                    : "rounded-full border border-stone-line bg-stone-bg px-3.5 py-2 text-sm font-medium text-stone-ink hover:border-brand-300"
                }
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* Full-drywall quality filter */}
          <button
            type="button"
            onClick={() => setDrywallOnly((v) => !v)}
            aria-pressed={drywallOnly}
            title="Show only homes built with true, site-built-quality full drywall"
            className={
              drywallOnly
                ? "inline-flex items-center gap-1.5 rounded-full bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white"
                : "inline-flex items-center gap-1.5 rounded-full border border-stone-line bg-stone-bg px-3.5 py-2 text-sm font-medium text-stone-ink hover:border-brand-300"
            }
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-3.5">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Full drywall
          </button>

          <span className="hidden h-6 w-px bg-stone-line sm:block" />

          <select aria-label="Bedrooms" value={minBeds} onChange={(e) => setMinBeds(Number(e.target.value))} className={selectClass}>
            {BED_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>

          {/* Sqft range */}
          <div className="inline-flex items-center gap-1.5">
            <select aria-label="Min square feet" value={minSqft} onChange={(e) => setMinSqft(Number(e.target.value))} className={selectClass}>
              {SQFT_STEPS.map((s) => (<option key={s} value={s}>{s === 0 ? "Min sqft" : s.toLocaleString()}</option>))}
            </select>
            <span className="text-stone-muted">–</span>
            <select aria-label="Max square feet" value={maxSqft === Infinity ? 0 : maxSqft} onChange={(e) => setMaxSqft(Number(e.target.value) === 0 ? Infinity : Number(e.target.value))} className={selectClass}>
              <option value={0}>Max sqft</option>
              {SQFT_STEPS.filter((s) => s > 0).map((s) => (<option key={s} value={s}>{s.toLocaleString()}</option>))}
            </select>
          </div>

          {/* Price range — only when at least one home has a price set */}
          {anyPriced && (
            <div className="inline-flex items-center gap-1.5">
              <select aria-label="Min price" value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} className={selectClass}>
                {PRICE_STEPS.map((s) => (<option key={s} value={s}>{s === 0 ? "Min price" : fmtK(s)}</option>))}
              </select>
              <span className="text-stone-muted">–</span>
              <select aria-label="Max price" value={maxPrice === Infinity ? 0 : maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value) === 0 ? Infinity : Number(e.target.value))} className={selectClass}>
                <option value={0}>Max price</option>
                {PRICE_STEPS.filter((s) => s > 0).map((s) => (<option key={s} value={s}>{fmtK(s)}</option>))}
              </select>
            </div>
          )}

          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={`${selectClass} ml-auto`}>
            {sortOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-3 text-sm text-stone-muted">
        <span>
          Showing <span className="font-semibold text-stone-ink">{results.length}</span>{" "}
          {results.length === 1 ? "home" : "homes"}
        </span>
        {hasFilters && (
          <button type="button" onClick={reset} className="font-semibold text-brand-700 hover:text-brand-900">
            Clear all
          </button>
        )}
      </div>

      {results.length === 0 ? (
        <div className="rounded-card border border-dashed border-stone-line bg-stone-surface p-12 text-center">
          <p className="text-stone-muted">No homes match your search.</p>
          <button type="button" onClick={reset} className="mt-3 text-sm font-semibold text-brand-700 hover:text-brand-900">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((h) => (
            <HomeCard key={h.id} home={h} />
          ))}
        </div>
      )}
    </div>
  );
}
