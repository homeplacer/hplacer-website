import Link from "next/link";
import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import { getAllHomes } from "@/lib/homes";
import { HomesBrowser } from "@/components/homes-browser";
import { JsonLd, homesItemListLd } from "@/lib/jsonld";

export const metadata: Metadata = pageMetadata({
  title: "Manufactured & Mobile Homes for Sale",
  description:
    "Browse new Clayton, Cavco, and Champion manufactured homes available with land across Horry County, SC. Current land-home packages from $184,999.",
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
            Model-specific prices are quoted individually. Package pricing depends on the home,
            land, site preparation, delivery, foundation, utilities, and selected options.
            Browse our <Link href="/recently-placed" className="underline">completed projects and historical sold prices</Link> for
            context, then request a current written quote for your model and lot.
          </p>
        </div>
      </section>

      <section className="container-x py-10">
        <HomesBrowser homes={all.map(h => ({ ...h, description: "", excerpt: "", decorOptions: [], floorPlans: [], imageUrls: h.imageUrls.slice(0, 1), tourUrl: undefined }))} />
      </section>
    </>
  );
}
