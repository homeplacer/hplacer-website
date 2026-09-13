import Link from "next/link";
import { notFound } from "next/navigation";
import { guides, getGuide } from "@/lib/guides";
import { PageHero } from "@/components/page-hero";
import { pageMetadata } from "@/lib/metadata";
import { JsonLd } from "@/lib/jsonld";
export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const g = getGuide((await params).slug);
  return g
    ? pageMetadata({
        title: g.title,
        description: g.description,
        alternates: { canonical: `/guides/${g.slug}` },
      })
    : { title: "Guide not found" };
}
export default async function GuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const g = getGuide((await params).slug);
  if (!g) notFound();
  return (
    <>
      <PageHero eyebrow="Planning checklist" title={g.title}>
        {g.description}
      </PageHero>
      <article className="container-x max-w-3xl py-12">
        <p className="text-sm text-stone-muted">
          Official sources checked {g.sourceCheckedAt}. The applicable authority
          verifies the requirements for your particular parcel.
        </p>
        {g.sections.map((s) => (
          <section key={s.title} className="mt-9">
            <h2 className="font-display text-2xl font-semibold">{s.title}</h2>
            <p className="mt-3 leading-relaxed text-stone-muted">{s.body}</p>
          </section>
        ))}
        <section className="mt-10 border-t border-stone-line pt-8">
          <h2 className="font-display text-xl font-semibold">
            Check the official source
          </h2>
          <ul className="mt-4 list-disc space-y-3 pl-5">
            {g.sources.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {s.title} ↗
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-stone-muted">
            Published forms can change and may retain older agency names or
            fees. Ask the linked office for the current application and
            applicable requirements.
          </p>
        </section>
        <p className="mt-10">
          <Link href="/contact" className="font-semibold underline">
            Discuss your home and lot
          </Link>{" "}
          ·{" "}
          <Link href="/stories" className="underline">
            See recorded projects
          </Link>{" "}
          ·{" "}
          <Link href="/guides" className="underline">
            All checklists
          </Link>
        </p>
      </article>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: g.title,
          description: g.description,
          datePublished: g.sourceCheckedAt,
          dateModified: g.sourceCheckedAt,
          author: {
            "@type": "Organization",
            "@id": "https://hplacer.com/#business",
            name: "Home Placer",
          },
          publisher: { "@id": "https://hplacer.com/#business" },
          mainEntityOfPage: `https://hplacer.com/guides/${g.slug}`,
          citation: g.sources.map((s) => s.url),
        }}
      />
    </>
  );
}
