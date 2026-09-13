import Link from "next/link";
import { guides } from "@/lib/guides";
import { PageHero } from "@/components/page-hero";
import { pageMetadata } from "@/lib/metadata";
export const metadata = pageMetadata({
  title: "Land-readiness planning checklists",
  description:
    "Prepare questions about your lot, utilities, project sequence, and written home-and-land scope with links to official county resources.",
  alternates: { canonical: "/guides" },
});
export default function GuidesPage() {
  return (
    <>
      <PageHero
        eyebrow="Before choosing a lot"
        title="Prepare for your land review"
      >
        Use these planning checklists to organize questions and documents for
        the county, service providers, and your Home Placer team.
      </PageHero>
      <section className="container-x py-12">
        <div className="grid gap-6 md:grid-cols-2">
          {guides.map((g) => (
            <article
              key={g.slug}
              className="rounded-card border border-stone-line p-6"
            >
              <h2 className="font-display text-2xl font-semibold">
                <Link href={`/guides/${g.slug}`} className="underline">
                  {g.title}
                </Link>
              </h2>
              <p className="mt-3 text-stone-muted">{g.description}</p>
            </article>
          ))}
        </div>
        <p className="mt-8">
          <Link href="/buyer-resources" className="underline">
            Official resources for all four counties
          </Link>{" "}
          ·{" "}
          <Link href="/stories" className="underline">
            Recorded project experience
          </Link>
        </p>
      </section>
    </>
  );
}
