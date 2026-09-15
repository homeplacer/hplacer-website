import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import data from "../../../data/sold-homes.json";
import { site } from "@/lib/site";
import { ArrowIcon, PhoneIcon, PinIcon } from "@/components/icons";
import { PlacementsMap, type Placement } from "@/components/placements-map";
import { PlacedHomes } from "@/components/placed-homes";
import { getAllPlacedHomes } from "@/lib/placed-homes";
import { getNewClosedHomePlacerSales } from "@/lib/forturro-closed-feed";
import { JsonLd, placedHomesGalleryLd } from "@/lib/jsonld";
import placementsData from "../../../data/placements.json";

export const metadata: Metadata = pageMetadata({
  title: "Recently Placed Homes Across the Grand Strand",
  description:
    "Browse real photo galleries of manufactured homes Home Placer has placed and sold on their own land across Conway, Loris, Aynor, Longs, and Myrtle Beach, SC.",
  alternates: { canonical: "/recently-placed" },
});

const fmtK = (n: number) => "$" + Math.round(n / 1000) + "K";

export default async function RecentlyPlacedPage() {
  const homes = getAllPlacedHomes();
  const liveClosings = await getNewClosedHomePlacerSales(homes);
  const archivedPoints = placementsData as Placement[];
  const seenAddresses = new Set(
    archivedPoints.map((point) =>
      `${point.address}|${point.city}`.toLowerCase().replace(/[^a-z0-9]/g, ""),
    ),
  );
  // The permanent archive is authoritative. A live match may add only a truly
  // new address; it must never make a second card or pin for an older project.
  const newClosings = liveClosings.filter((home) => {
    const key = `${home.address}|${home.city}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seenAddresses.has(key)) return false;
    seenAddresses.add(key);
    return true;
  });
  const points = [
    ...archivedPoints,
    ...newClosings.flatMap((home) => {
      if (home.lat == null || home.lng == null || home.closePrice == null) return [];
      return [{
        lat: home.lat,
        lon: home.lng,
        address: home.address,
        model: "Home Placer project",
        price: home.closePrice,
        city: home.city,
      } satisfies Placement];
    }),
  ];

  return (
    <>
      <JsonLd data={placedHomesGalleryLd(homes)} />
      <PageHero eyebrow="Our work" title="Homes we've recently placed">
        {placementsData.length} homes Home Placer has placed and sold — almost every one a brand-new
        manufactured home on{" "}
        <strong className="font-semibold text-stone-ink">its own land</strong> — across Conway, Loris,
        Aynor, Longs, Myrtle Beach, and beyond. This is the land-home package, delivered.
      </PageHero>

      {/* Proof stats from the real sales record */}
      <section className="border-b border-stone-line bg-stone-surface">
        <div className="container-x grid gap-px py-2 sm:grid-cols-4">
          {[
            { n: String(placementsData.length), t: "homes placed" },
            { n: `${fmtK(data.priceMin)}–${fmtK(data.priceMax)}`, t: "sale price range" },
            { n: "6", t: "areas across SC" },
            { n: "¼-acre", t: "land with every home" },
          ].map((s) => (
            <div key={s.t} className="p-6 text-center">
              <p className="font-display text-2xl font-semibold text-brand-700 sm:text-3xl">{s.n}</p>
              <p className="mt-1 text-sm text-stone-muted">{s.t}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Map of every placement */}
      <section className="container-x py-12">
        <div className="flex items-center gap-2 text-brand-600">
          <PinIcon className="size-5" />
          <h2 className="font-display text-2xl font-semibold text-stone-ink">Where we&apos;ve placed homes</h2>
        </div>
        <p className="mt-2 max-w-2xl text-stone-muted">
          All {points.length} homes Home Placer has placed, on their own land, across Horry County and the
          Grand Strand. Click any dot for the address, model, and sale price.
        </p>
        <div className="mt-5">
          <PlacementsMap points={points} />
        </div>
      </section>

      <section className="container-x py-12 pt-0">
        <p className="mb-8 max-w-2xl text-stone-muted">
          All {placementsData.length} placements are on the map above. The {data.totalHomes} closed sales
          below are the ones we have full photo sets for —{" "}
          <strong className="font-semibold text-stone-ink">
            click any home for its full photo gallery, the floor plan, and what it sold for
          </strong>
          .
        </p>

        <PlacedHomes homes={homes} />

        {newClosings.length > 0 && (
          <section className="mt-12 border-t border-stone-line pt-12">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
              Newly recorded MLS closings
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink">
              More completed Home Placer projects
            </h2>
            <p className="mt-3 max-w-2xl text-stone-muted">
              These completed projects came from the live MLS feed. Full project
              galleries are added separately when approved photos are available.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {newClosings.map((home) => (
                <article key={home.listingKey} className="rounded-card border border-stone-line bg-stone-surface p-6">
                  <p className="text-sm font-semibold text-brand-700">MLS closed</p>
                  <h3 className="mt-2 font-display text-xl font-semibold text-stone-ink">
                    {home.address}
                  </h3>
                  <p className="mt-1 text-stone-muted">{home.city}, SC</p>
                  {home.closePrice != null && <p className="mt-4 font-semibold text-brand-800">Closed at {fmtK(home.closePrice)}</p>}
                  {(home.beds != null || home.baths != null || home.sqft != null) && (
                    <p className="mt-2 text-sm text-stone-muted">
                      {home.beds != null ? `${home.beds} bed` : ""}
                      {home.beds != null && home.baths != null ? " · " : ""}
                      {home.baths != null ? `${home.baths} bath` : ""}
                      {(home.beds != null || home.baths != null) && home.sqft != null ? " · " : ""}
                      {home.sqft != null ? `${home.sqft.toLocaleString()} sqft` : ""}
                    </p>
                  )}
                  {home.closedOn && <p className="mt-4 text-sm text-stone-muted">Closed {home.closedOn}</p>}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-5 rounded-card border border-stone-line bg-stone-surface p-7 text-center sm:p-10">
          <h2 className="font-display text-2xl font-semibold text-stone-ink sm:text-3xl">
            Your home could be next
          </h2>
          <p className="mx-auto max-w-xl text-stone-muted">
            Bring your land or use ours — we&apos;ll place a brand-new Clayton, Cavco, or Champion home and
            handle the whole thing: one package, one closing.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/homes"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              Browse homes <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-stone-muted">
          Closed sales across the Coastal Carolinas MLS. Photos are of real Home Placer homes.
        </p>
      </section>
    </>
  );
}
