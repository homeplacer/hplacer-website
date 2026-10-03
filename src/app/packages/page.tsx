import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { pageMetadata } from "@/lib/metadata";
import { getPackages, packageState } from "@/lib/packages";
import { JsonLd } from "@/lib/jsonld";
import { getHome } from "@/lib/homes";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
export const dynamic = "force-dynamic";
export const metadata = pageMetadata({
  title: "Land-home project archive & examples",
  description:
    "Explore recorded land-home project examples by model and town. Sold historical records are separated from links to current land-home availability.",
  alternates: { canonical: "/packages" },
});
export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string; status?: string; model?: string }>;
}) {
  const filters = await searchParams;
  const all = getPackages();
  const selectedHome = filters.model ? getHome(filters.model) : undefined;
  const markets = [...new Set(all.map((p) => p.market))];
  const rows = all.filter(
    (p) =>
      (!filters.market || p.market === filters.market) &&
      (!filters.status || p.status === filters.status) &&
      (!filters.model || p.modelSlug === filters.model),
  );
  return (
    <>
      <PageHero
        eyebrow="Home + land project archive"
        title={selectedHome ? `${selectedHome.name} package examples` : "Land-home project records"}
      >
        {selectedHome ? `Explore recorded ${selectedHome.name} projects by town and status. ` : "Explore recorded home-and-land projects by town, model, and status. "}
        Sold examples show past projects, not homes available to buy. A floor
        plan alone is not an available land-home package.
      </PageHero>
      <section className="container-x py-12">
        <div className="rounded-card border border-stone-line bg-stone-surface p-6">
          <h2 className="font-display text-2xl font-semibold">Looking for a home you can buy now?</h2>
          <p className="mt-3 max-w-3xl text-stone-muted">
            Current properties are listed separately from these recorded
            projects. Browse current land-home packages, or ask about a similar
            home on a new lot. We will confirm the property, available options,
            written scope, and current price with you.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Link href="/land-packages" className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline">
              Browse current land-home packages
            </Link>
            <HomeInquiryDialog
              homeName={selectedHome?.name ?? "a land-home package"}
              label={selectedHome ? `Ask about a ${selectedHome.name} package` : "Ask about current options"}
              showArrow={false}
            />
            {selectedHome && (
              <Link href={`/homes/${selectedHome.slug}`} className="inline-flex min-h-11 items-center text-brand-700 underline">
                View the {selectedHome.name} floor plan
              </Link>
            )}
          </div>
        </div>
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
        <p className="mb-4 text-stone-muted">{rows.length} matching {rows.length === 1 ? "record" : "records"}</p>
        {rows.length === 0 && (
          <p className="rounded-card border border-stone-line p-6 text-stone-muted">
            No published project records match these filters. This does not
            determine whether a model or a new package is available.{" "}
            <Link href="/packages" className="font-semibold text-brand-700 underline">
              Browse all recorded projects
            </Link>
            , or ask our team about your plans using the inquiry above.
          </p>
        )}
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
              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-stone-muted">Town</dt>
                <dd>{p.market}</dd>
                <dt className="text-stone-muted">Model</dt>
                <dd>
                  <Link href={`/homes/${p.modelSlug}`} className="text-brand-700 underline">
                    {getHome(p.modelSlug)?.name ?? p.title}
                  </Link>
                </dd>
                {p.lotAcres !== null && (
                  <>
                    <dt className="text-stone-muted">Recorded lot</dt>
                    <dd>{p.lotAcres.toLocaleString("en-US", { maximumFractionDigits: 4 })} acres</dd>
                  </>
                )}
              </dl>
              <h3 className="mt-5 text-sm font-semibold">What the record supports</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-stone-muted">
                {p.included.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <h3 className="mt-4 text-sm font-semibold">For a new project</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-stone-muted">
                {p.excludedOrVariable.map((item) => <li key={item}>{item}</li>)}
              </ul>
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
