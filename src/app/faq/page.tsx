import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { faqs } from "@/lib/faqs";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { site } from "@/lib/site";
import { PhoneIcon, ArrowIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "FAQ — Buying a Manufactured Home on Land",
  description:
    "Answers to common questions about buying a new manufactured home on land in Horry County, SC — packages, financing, HOAs, brands, and the process.",
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqLd(faqs)} />
      <PageHero eyebrow="Questions, answered" title="Frequently asked questions">
        Everything we get asked about buying a new home on land in Horry County. Still curious?
        Call us — a real person answers.
      </PageHero>

      <section className="container-x py-12">
        <div className="mx-auto max-w-3xl divide-y divide-stone-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-stone-ink">
                {f.q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-stone-line text-brand-700 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-stone-muted">{f.a}</p>
            </details>
          ))}
        </div>

        <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-between gap-4 rounded-card border border-stone-line bg-stone-surface p-6">
          <p className="font-medium text-stone-ink">Didn&apos;t see your question?</p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              Ask us <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-5 py-2.5 text-sm font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
