import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import { getAllHomes } from "@/lib/homes";
import { HomesBrowser } from "@/components/homes-browser";
import { JsonLd, homesItemListLd } from "@/lib/jsonld";

export const metadata: Metadata = pageMetadata({
  title: "Manufactured & Mobile Homes for Sale",
  description:
    "Explore new Clayton, Cavco, and Champion manufactured homes, compare home-only and land-home estimates, and request a written price for your model and lot.",
  alternates: { canonical: "/homes" },
});

export default function HomesPage() {
  const all = getAllHomes();

  return (
    <>
      <JsonLd data={homesItemListLd(all)} />
      <section className="border-b border-stone-line bg-stone-surface">
        <div className="container-x py-14">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            {all.length} floor plans to explore
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink sm:text-5xl">
            Find your home
          </h1>
          <p className="mt-3 max-w-2xl text-stone-muted">
            Estimated land-and-home package prices assume a quarter-acre lot;
            home-only pricing is shown when available. Land, site preparation,
            delivery, foundation, utilities, permits, and selected options can
            change the final price. Call, text, or email us for a written
            estimate for your model and lot.
          </p>
        </div>
      </section>

      <section className="container-x py-10">
        <HomesBrowser homes={all.map(h => ({ ...h, description: "", excerpt: "", decorOptions: [], floorPlans: [], imageUrls: h.imageUrls.slice(0, 1), tourUrl: undefined }))} />
      </section>
    </>
  );
}
