import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { pageMetadata } from "@/lib/metadata";
import { getPackages, packageState } from "@/lib/packages";
import { JsonLd } from "@/lib/jsonld";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Land-home package examples & availability",
  description:
    "Browse verified land-home records by town and status. Historical sold examples are clearly separated from current availability.",
  alternates: { canonical: "/packages" },
});
export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; status?: string; model?: string }>;
}) {
  const filters = await searchParams;
  const all = getPackages();
  const markets = [...new Set(all.map((p) => p.market))];
  const rows = all.filter(
    (p) =>
      (!filters.market || p.market === filters.market) &&
      (!filters.status || p.status === filters.status) &&
      (!filters.model || p.modelSlug === filters.model),
  );
  return (
    <>
      <PageHero eyebrow="Home + land" title="Packages, with the status clear">
        Explore recorded projects and check for current opportunities. A floor
        plan alone is not an available land-home package.
      </PageHero>
      <section className="container-x py-12">
        {!all.some((p) => p.status === "available") && (
          <p className="rounded-card border border-stone-line bg-stone-surface p-6">
            No currently available packages have been verified for this
            directory. The examples below are sold historical projects.{" "}
            <Link href="/contact" className="font-semibold underline">
              Ask about current options
            </Link>
            .
          </p>
        )}
        <form
          className="my-8 flex flex-wrap items-end gap-4"
          action="/packages"
        >
          <label className="grid gap-2">
            Town
            <select
              name="market"
              defaultValue={filters.market || ""}
              className="rounded border p-2"
            >
              <option value="">All towns</option>
              {markets.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            Status
            <select
              name="status"
              defaultValue={filters.status || ""}
              className="rounded border p-2"
            >
              <option value="">All published records</option>
              <option value="available">Available</option>
              <option value="under_contract">Under contract</option>
              <option value="sold">Sold examples</option>
            </select>
          </label>
          {filters.model && (
            <input type="hidden" name="model" value={filters.model} />
          )}
          <button className="rounded bg-brand-700 px-5 py-2 text-white">
            Filter packages
          </button>
          <Link href="/packages" className="underline">
            Reset
          </Link>
        </form>
        <p className="mb-4 text-stone-muted">{rows.length} matching records</p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <article
              key={p.id}
              className="rounded-card border border-stone-line p-6"
            >
              <p className="text-sm uppercase text-brand-700">
                {packageState(p).replaceAll("_", " ")}
              </p>
              <h2 className="mt-2 font-display text-xl font-semibold">
                <Link href={`/packages/${p.id}`} className="underline">
                  {p.title}
                </Link>
              </h2>
              <p className="mt-3 text-sm text-stone-muted">
                {p.priceDisclosure}
              </p>
            </article>
          ))}
        </div>
        <p className="mt-10">
          <Link href="/guides" className="font-semibold underline">
            Plan your land review
          </Link>{" "}
          ·{" "}
          <Link href="/homes" className="underline">
            Browse home models
          </Link>
        </p>
      </section>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Home Placer package records",
          url: "https://hplacer.com/packages",
          mainEntity: {
            "@type": "ItemList",
            itemListElement: rows.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: p.title,
              url: `https://hplacer.com/packages/${p.id}`,
            })),
          },
        }}
      />
    </>
  );
}
