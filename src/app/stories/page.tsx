import Link from "next/link";
import { placedHomesByTown } from "@/lib/placed-homes";
import { getHome } from "@/lib/homes";
import { PageHero } from "@/components/page-hero";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
import { PhoneIcon } from "@/components/icons";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/lib/site";
export const metadata = pageMetadata({
  title: "Recorded project experience by town",
  description:
    "Explore Home Placer’s existing sold-home archive by town, with recorded model details and questions for planning a new project.",
  alternates: { canonical: "/stories" },
});
export default function StoriesPage() {
  const towns = placedHomesByTown();
  const archiveCount = towns.reduce((count, town) => count + town.homes.length, 0);

  return (
    <>
      <PageHero
        eyebrow="Existing project archive"
        title="Real homes, useful context"
      >
        Explore real sold homes by town, with their addresses, recorded models
        and closing dates. These are past projects; ask us about a similar home
        for your land or a current land-home package.
      </PageHero>
      <section className="container-x pt-8" aria-label="Explore Home Placer projects">
        <p className="max-w-3xl leading-relaxed text-stone-muted">
          Our photo archive has {archiveCount} sold homes across {towns.length}
          {" "}towns. The examples below show the newest recorded closings in
          each town. Open an address for the project&apos;s photos and details,
          or explore the full gallery for more homes and newly recorded MLS closings.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/recently-placed"
            className="inline-flex items-center justify-center rounded-full bg-brand-700 px-5 py-3 font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            Browse all sold-home galleries
          </Link>
          <Link
            href="/land-packages"
            className="inline-flex items-center justify-center rounded-full border border-stone-line px-5 py-3 font-semibold text-stone-ink transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
          >
            See current land-home packages
          </Link>
        </div>
      </section>
      <section className="container-x grid gap-6 py-12 md:grid-cols-2">
        {towns.map((t) => (
          <article
            key={t.slug}
            className="rounded-card border border-stone-line p-6"
          >
            <h2 className="font-display text-2xl font-semibold">{t.name}</h2>
            <p className="mt-2 text-stone-muted">
              {t.homes.length} {t.homes.length === 1 ? "sold home" : "sold homes"}
              {" "}in the photo archive
            </p>
            <ul className="mt-5 divide-y divide-stone-line">
              {[...t.homes]
                .sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? ""))
                .slice(0, 3)
                .map((h) => {
                  const model = h.modelSlug ? getHome(h.modelSlug) : undefined;
                  const modelName = model?.name ?? h.modelName;
                  return (
                    <li key={h.slug} className="py-4 first:pt-0 last:pb-0">
                      <Link
                        href={`/recently-placed/${h.slug}`}
                        className="break-words font-semibold text-stone-ink underline decoration-brand-300 underline-offset-4 transition hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
                      >
                        {h.address}
                      </Link>
                      {modelName && (
                        <p className="mt-2 text-sm text-stone-muted">
                          Recorded model: {modelName}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-stone-muted">
                        {h.beds} bedrooms · {h.baths} bathrooms
                      </p>
                      {h.closeDate && (
                        <p className="mt-2 text-sm font-medium text-brand-700">
                          Closed{" "}
                          <time dateTime={h.closeDate}>
                            {new Date(`${h.closeDate}T00:00:00Z`).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                              timeZone: "UTC",
                            })}
                          </time>
                        </p>
                      )}
                    </li>
                  );
                })}
            </ul>
          </article>
        ))}
      </section>
      <section className="container-x pb-12">
        <div className="rounded-card border border-stone-line bg-stone-surface p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            Looking for a home like one of these?
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-muted">
            Tell us which project caught your eye and where you want to live.
            We&apos;ll help you explore a home for your own land or a land-home
            package, with the lot, scope and current price confirmed for you.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <HomeInquiryDialog
              homeName="past Home Placer homes"
              label="Ask about a similar home"
              showArrow={false}
              className="inline-flex items-center justify-center rounded-full bg-brand-700 px-5 py-3 font-semibold text-white transition hover:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            />
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-5 py-3 font-semibold text-stone-ink transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              <PhoneIcon className="size-4" /> Call {site.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
