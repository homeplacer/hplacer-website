import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { locations, counties } from "@/lib/locations";
import { PinIcon, ArrowIcon } from "@/components/icons";

const stateName = (abbr: string) => (abbr === "NC" ? "North Carolina" : "South Carolina");

export const metadata: Metadata = {
  title: "Manufactured Homes on Land — Horry, Georgetown, Brunswick & Columbus Counties",
  description:
    "Home Placer places new manufactured homes on land across four counties: Horry & Georgetown in SC and Brunswick & Columbus in NC — 27 towns from Myrtle Beach and Conway to Leland, Shallotte, and Whiteville.",
  alternates: { canonical: "/locations" },
};

export default function LocationsPage() {
  const groups = Object.values(counties).map((county) => ({
    county,
    cities: locations.filter((l) => l.countyKey === county.key),
  }));

  return (
    <>
      <PageHero eyebrow="Where we build" title="27 towns across four counties, two states">
        We place new manufactured homes on land across Horry and Georgetown counties in South
        Carolina and Brunswick and Columbus counties in North Carolina — on scattered lots, never
        boxed into a subdivision, and never with an HOA.
      </PageHero>

      {groups.map(({ county, cities }) => (
        <section key={county.key} className="container-x py-10">
          <h2 className="font-display text-2xl font-semibold text-stone-ink sm:text-3xl">
            Manufactured homes in {county.name}, {county.stateAbbr}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-stone-muted">{county.windText}</p>
          <p className="mt-1 text-xs uppercase tracking-wider text-stone-muted">
            {stateName(county.stateAbbr)}
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {cities.map((l) => (
              <Link
                key={l.slug}
                href={`/locations/${l.slug}`}
                className="group flex flex-col rounded-card border border-stone-line bg-stone-bg p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <span className="inline-flex items-center gap-2 text-brand-600">
                  <PinIcon className="size-5" />
                  <span className="font-display text-xl font-semibold text-stone-ink group-hover:text-brand-800">
                    {l.name}
                  </span>
                </span>
                <p className="mt-3 flex-1 text-sm text-stone-muted">{l.intro}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">
                  Homes in {l.name} <ArrowIcon className="size-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
