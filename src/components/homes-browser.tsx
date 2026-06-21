"use client";

import { useMemo, useState } from "react";
import type { Home, Brand } from "@/lib/home-types";
import { displayPrice } from "@/lib/home-types";
import { HomeCard } from "@/components/home-card";

type BrandTab = "All" | Brand;
const BRAND_ORDER: Brand[] = ["Clayton", "Cavco", "Champion"];
const BED_OPTIONS = [
  { label: "Any beds", value: 0 },
  { label: "2+", value: 2 },
  { label: "3+", value: 3 },
  { label: "4+", value: 4 },
];
const PRICE_OPTIONS = [
  { label: "Any price", value: Infinity },
  { label: "Under $230k", value: 230000 },
  { label: "Under $260k", value: 260000 },
  { label: "Under $290k", value: 290000 },
];
const SORTS = [
  { label: "Largest first", value: "sqft-desc" },
  { label: "Smallest first", value: "sqft-asc" },
  { label: "Price: low to high", value: "price-asc" },
  { label: "Price: high to low", value: "price-desc" },
] as const;

type Sort = (typeof SORTS)[number]["value"];

export function HomesBrowser({
  homes,
  initialBrand = "All",
}: {
  homes: Home[];
  initialBrand?: BrandTab;
}) {
  // Only offer brand pills for brands actually in inventory — a perpetually
  // empty filter reads as broken. New brands appear automatically as homes load.
  const brandTabs = useMemo<BrandTab[]>(() => {
    const present = new Set(homes.map((h) => h.brand));
    return ["All", ...BRAND_ORDER.filter((b) => present.has(b))];
  }, [homes]);

  const [brand, setBrand] = useState<BrandTab>(
    brandTabs.includes(initialBrand) ? initialBrand : "All",
  );
  const [minBeds, setMinBeds] = useState(0);
  const [maxPrice, setMaxPrice] = useState(Infinity);
  const [sort, setSort] = useState<Sort>("sqft-desc");

  const results = useMemo(() => {
    const filtered = homes.filter((h) => {
      const dp = displayPrice(h);
      return (
        (brand === "All" || h.brand === brand) &&
        h.beds >= minBeds &&
        (maxPrice === Infinity || (dp != null && dp <= maxPrice))
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sort === "price-asc") return (displayPrice(a) ?? Infinity) - (displayPrice(b) ?? Infinity);
      if (sort === "price-desc") return (displayPrice(b) ?? -Infinity) - (displayPrice(a) ?? -Infinity);
      if (sort === "sqft-asc") return a.sqft - b.sqft;
      return b.sqft - a.sqft;
    });
    return sorted;
  }, [homes, brand, minBeds, maxPrice, sort]);

  const selectClass =
    "rounded-lg border border-stone-line bg-stone-bg px-3 py-2 text-sm font-medium text-stone-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

  return (
    <div>
      {/* Filter bar */}
      <div className="sticky top-16 z-30 -mx-5 mb-8 border-y border-stone-line bg-stone-surface/95 px-5 py-3 backdrop-blur md:mx-0 md:rounded-card md:border md:px-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Brand pills */}
          <div className="flex flex-wrap gap-1.5">
            {brandTabs.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrand(b)}
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

          <select
            aria-label="Bedrooms"
            value={minBeds}
            onChange={(e) => setMinBeds(Number(e.target.value))}
            className={selectClass}
          >
            {BED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Max price"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className={selectClass}
          >
            {PRICE_OPTIONS.map((o) => (
              <option key={o.label} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className={`${selectClass} ml-auto`}
          >
            {SORTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-5 text-sm text-stone-muted">
        Showing <span className="font-semibold text-stone-ink">{results.length}</span>{" "}
        {results.length === 1 ? "home" : "homes"}
      </p>

      {results.length === 0 ? (
        <div className="rounded-card border border-dashed border-stone-line bg-stone-surface p-12 text-center">
          <p className="text-stone-muted">No homes match those filters.</p>
          <button
            type="button"
            onClick={() => {
              setBrand("All");
              setMinBeds(0);
              setMaxPrice(Infinity);
            }}
            className="mt-3 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
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
