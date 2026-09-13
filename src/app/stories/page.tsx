import Link from "next/link";
import { placedHomesByTown } from "@/lib/placed-homes";
import { PageHero } from "@/components/page-hero";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata({
  title: "Recorded project experience by town",
  description:
    "Explore Home Placer’s existing sold-home archive by town, with recorded model details and questions for planning a new project.",
  alternates: { canonical: "/stories" },
});
export default function StoriesPage() {
  return (
    <>
      <PageHero
        eyebrow="Existing project archive"
        title="Real homes, useful context"
      >
        Explore recorded projects by town. These sold homes show past work; they
        do not establish current inventory or what a different lot will require.
      </PageHero>
      <section className="container-x grid gap-6 py-12 md:grid-cols-2">
        {placedHomesByTown().map((t) => (
          <article
            key={t.slug}
            className="rounded-card border border-stone-line p-6"
          >
            <h2 className="font-display text-2xl font-semibold">{t.name}</h2>
            <p className="mt-2 text-stone-muted">
              {t.homes.length} sold homes in the existing archive
            </p>
            <ul className="mt-4 space-y-3">
              {t.homes.slice(0, 3).map((h, i) => (
                <li key={h.slug}>
                  <Link
                    href={`/recently-placed/${h.slug}`}
                    className="underline"
                  >
                    {h.modelName || h.style} · {h.beds} bedrooms · recorded
                    project {i + 1}
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>
    </>
  );
}
