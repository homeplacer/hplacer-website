import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { CheckIcon, PhoneIcon, ArrowIcon } from "@/components/icons";

export const metadata: Metadata = pageMetadata({
  title: "Warranty",
  description:
    "Home Placer provides a one-year builder warranty for defects. The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage and ten years of structural coverage through the 2–10 company.",
  alternates: { canonical: "/warranty" },
});

const tiers = [
  {
    years: "1",
    unit: "Year",
    title: "Home Placer builder warranty",
    body:
      "Home Placer, your builder, provides a one-year warranty for defects.",
  },
  {
    years: "2",
    unit: "Years",
    title: "2–10 mechanical coverage",
    body:
      "The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage through the 2–10 company.",
  },
  {
    years: "10",
    unit: "Years",
    title: "2–10 structural coverage",
    body:
      "The separate 2–10 Home Buyers Warranty provides ten years of structural coverage through the 2–10 company.",
  },
];

export default function WarrantyPage() {
  return (
    <>
      <PageHero eyebrow="Warranty" title="Your home is covered — for years, not days.">
        Home Placer provides a one-year builder warranty for defects. The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage and ten years of structural coverage through the 2–10 company.
      </PageHero>

      {/* 1 / 2 / 10 tiers */}
      <section className="container-x py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.years} className="rounded-card border border-stone-line bg-stone-bg p-8">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold text-brand-700">{t.years}</span>
                <span className="text-sm font-semibold uppercase tracking-wider text-stone-muted">{t.unit}</span>
              </div>
              <h2 className="mt-4 font-display text-xl font-semibold text-stone-ink">{t.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-stone-muted">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What is 2-10 */}
      <section className="bg-stone-surface py-16">
        <div className="container-x grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">What is the 2-10 warranty?</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink">
              Two warranties, clearly explained
            </h2>
            <p className="mt-4 text-stone-muted">
              Home Placer is the builder and provides the one-year defect warranty.
              Mechanical coverage for two years and structural coverage for ten years
              are provided separately through the 2–10 company under the 2–10 Home Buyers Warranty.
              Contact our service team for help with a warranty request and your coverage documents.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "Home Placer: one-year builder warranty for defects",
              "2–10 company: two years of mechanical coverage",
              "2–10 company: ten years of structural coverage",
              "30-day walk-through after you move in",
              "Local service team — real people, not a call center",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-card border border-stone-line bg-stone-bg p-4">
                <CheckIcon className="mt-0.5 size-5 shrink-0 text-brand-600" strokeWidth={2.5} />
                <span className="text-sm font-medium text-stone-ink">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Service CTA */}
      <section className="container-x py-16">
        <div className="grid gap-6 rounded-card border border-stone-line bg-stone-surface p-8 lg:grid-cols-[1.3fr_1fr] lg:items-center sm:p-10">
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-ink">Something not right? We&apos;re on it.</h2>
            <p className="mt-3 text-stone-muted">
              Submit a warranty request with photos, or call our service line — our team can help you with the next steps for the applicable warranty.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Link
              href="/warranty-request"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-accent-600"
            >
              Submit a warranty request <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.warrantyPhoneDial}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> Service line {site.warrantyPhoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
