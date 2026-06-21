import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { HomeCard } from "@/components/home-card";
import { BRANDS, getHomesByBrand } from "@/lib/homes";
import { ArrowIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Brands — Clayton, Cavco & Champion",
  description:
    "Home Placer carries new Clayton, Cavco, and Champion manufactured homes — hand-picked floor plans placed on land across Horry County, SC.",
};

export default function BrandsPage() {
  return (
    <>
      <PageHero eyebrow="The builders we carry" title="Clayton, Cavco & Champion">
        We don&apos;t build the homes — we pick the best of the ones that are. Every model
        we carry comes from a manufacturer with a real track record, then gets placed on
        land near you.
      </PageHero>

      <div className="container-x divide-y divide-stone-line">
        {BRANDS.map((b) => {
          const homes = getHomesByBrand(b.brand);
          return (
            <section key={b.brand} className="py-14">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <h2 className="font-display text-3xl font-semibold text-stone-ink">{b.brand}</h2>
                  <p className="mt-2 text-stone-muted">{b.blurb}</p>
                </div>
                <Link
                  href={`/homes?brand=${b.brand}`}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
                >
                  All {b.brand} homes <ArrowIcon className="size-4" />
                </Link>
              </div>
              {homes.length > 0 && (
                <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {homes.slice(0, 3).map((h) => (
                    <HomeCard key={h.id} home={h} />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
