import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { glossary } from "@/lib/glossary";
import { JsonLd } from "@/lib/jsonld";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Manufactured Home Glossary",
  description:
    "Plain-English definitions of manufactured-home terms — HUD code, single-wide, double-wide, chattel, land-home package, and more.",
  alternates: { canonical: "/glossary" },
};

export default function GlossaryPage() {
  const ld = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    name: "Manufactured Home Glossary",
    url: `${site.url}/glossary`,
    hasDefinedTerm: glossary.map((t) => ({
      "@type": "DefinedTerm",
      name: t.term,
      description: t.def,
    })),
  };

  return (
    <>
      <JsonLd data={ld} />
      <PageHero eyebrow="Speak the language" title="Manufactured home glossary">
        Buying a home comes with a lot of jargon. Here are the terms that actually matter,
        explained simply.
      </PageHero>

      <section className="container-x py-12">
        <dl className="mx-auto max-w-3xl divide-y divide-stone-line">
          {glossary.map((t) => (
            <div key={t.term} className="grid gap-1 py-5 sm:grid-cols-[200px_1fr] sm:gap-6">
              <dt className="font-display text-lg font-semibold text-stone-ink">{t.term}</dt>
              <dd className="text-stone-muted">{t.def}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
