"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { asset } from "@/lib/asset";
import { PinIcon } from "@/components/icons";
import type { PlacedHome } from "@/lib/placed-homes";

const fmt = (n: number) => "$" + n.toLocaleString("en-US");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const soldLabel = (iso: string | null) => {
  if (!iso) return "Sold";
  const [y, m] = iso.split("-");
  return `Sold ${MONTHS[+m - 1]} ${y}`;
};

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden="true">
      <path
        d="M4 8a2 2 0 012-2h1l1-1.5a1 1 0 01.8-.5h4.4a1 1 0 01.8.5L19 6h1a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V8z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function Card({ h, eager }: { h: PlacedHome; eager: boolean }) {
  const count = h.photos.length;
  return (
    <li className="overflow-hidden rounded-card border border-stone-line bg-stone-surface transition hover:border-brand-300 hover:shadow-sm">
      <Link href={`/recently-placed/${h.slug}`} className="group flex h-full flex-col">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset(h.photo)}
            alt={`A Home Placer manufactured home placed at ${h.address}, ${h.town}, SC`}
            loading={eager ? "eager" : "lazy"}
            width={800}
            height={600}
            className="aspect-[4/3] w-full bg-stone-bg object-cover transition group-hover:opacity-95"
          />
          <span className="absolute left-2 top-2 rounded-full bg-brand-700/90 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur-sm">
            {soldLabel(h.closeDate)}
          </span>
          {count > 1 && (
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
              <CameraIcon /> {count} photos
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <p className="font-semibold text-stone-ink">{h.address}</p>
          <p className="mt-1 text-sm text-stone-muted">
            {h.town}, SC · {h.beds} bd · {h.baths} ba · {h.style}
            {h.lotAcres ? ` · ${h.lotAcres} ac` : ""}
          </p>
          <p className="mt-2 font-display text-lg font-semibold text-brand-700">{fmt(h.price)}</p>
          {h.modelName && (
            <p className="mt-auto pt-2 text-xs text-stone-muted">
              Model: <span className="font-medium text-stone-ink">{h.modelName}</span>
            </p>
          )}
        </div>
      </Link>
    </li>
  );
}

// Grid of every placed home with a sort toggle: newest sales first (default),
// or grouped by city (cities ordered by their most-recent sale). Each card
// links to that home's own page.
export function PlacedHomes({ homes }: { homes: PlacedHome[] }) {
  const [sort, setSort] = useState<"recent" | "city">("recent");

  const byDate = useMemo(
    () => [...homes].sort((a, b) => (b.closeDate || "").localeCompare(a.closeDate || "")),
    [homes],
  );

  const cities = useMemo(() => {
    const m = new Map<string, PlacedHome[]>();
    for (const h of byDate) {
      if (!m.has(h.town)) m.set(h.town, []);
      m.get(h.town)!.push(h);
    }
    return [...m.entries()]
      .map(([name, hs]) => ({ name, homes: hs, newest: hs[0]?.closeDate || "" }))
      .sort((a, b) => b.newest.localeCompare(a.newest));
  }, [byDate]);

  const tab = (key: "recent" | "city", label: string) => (
    <button
      type="button"
      onClick={() => setSort(key)}
      aria-pressed={sort === key}
      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
        sort === key
          ? "bg-brand-700 text-white"
          : "border border-stone-line bg-stone-surface text-stone-ink hover:border-brand-300"
      }`}
    >
      {label}
    </button>
  );

  let idx = 0; // running index so the first row eager-loads in either view

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-stone-muted">Sort by</span>
        {tab("recent", "Most recent")}
        {tab("city", "By city")}
      </div>

      {sort === "recent" ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {byDate.map((h) => (
            <Card key={h.slug} h={h} eager={idx++ < 6} />
          ))}
        </ul>
      ) : (
        cities.map((city) => (
          <div key={city.name} className="mb-14">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex items-center gap-2 text-brand-600">
                <PinIcon className="size-5" />
                <h2 className="font-display text-2xl font-semibold text-stone-ink">{city.name}</h2>
              </div>
              <span className="text-sm font-medium text-stone-muted">
                {city.homes.length} {city.homes.length === 1 ? "home" : "homes"} sold
              </span>
            </div>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {city.homes.map((h) => (
                <Card key={h.slug} h={h} eager={idx++ < 6} />
              ))}
            </ul>
          </div>
        ))
      )}
    </>
  );
}
