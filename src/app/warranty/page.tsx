import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { CheckIcon, PhoneIcon, ArrowIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Warranty",
  description:
    "Every Home Placer home is covered: a full 1-year warranty on the home itself, plus a 2-10 Home Buyers Warranty backing your systems for 2 years and structure for 10.",
  alternates: { canonical: "/warranty" },
};

const tiers = [
  {
    years: "1",
    unit: "Year",
    title: "The whole home",
    body:
      "From the day you move in, the home itself is under warranty for a full year — workmanship, fixtures, and the things that make it home. If something isn't right, we make it right.",
  },
  {
    years: "2",
    unit: "Years",
    title: "Your systems",
    body:
      "Your plumbing, electrical, and heating & cooling distribution systems are covered for two years through the 2-10 Home Buyers Warranty.",
  },
  {
    years: "10",
    unit: "Years",
    title: "The structure",
    body:
      "Major structural components are protected for a full ten years under the 2-10 Home Buyers Warranty — the same structural coverage trusted on site-built homes.",
  },
];

export default function WarrantyPage() {
  return (
    <>
      <PageHero eyebrow="Warranty" title="Your home is covered — for years, not days.">
        Buying from Home Placer means real protection: a full <strong className="font-semibold text-stone-ink">1-year warranty</strong> on
        the home itself, plus a <strong className="font-semibold text-stone-ink">2-10 Home Buyers Warranty</strong> that stands behind your
        systems and structure for up to a decade.
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
              The same protection site-built homes get
            </h2>
            <p className="mt-4 text-stone-muted">
              The 2-10 Home Buyers Warranty is a nationally recognized new-home warranty — the industry
              standard builders use to back their homes. It covers your home&apos;s <strong className="font-semibold text-stone-ink">systems
              for 2 years</strong> and its <strong className="font-semibold text-stone-ink">major structure for 10</strong>, as
              independent third-party protection on top of our own 1-year coverage. It&apos;s peace of mind in
              writing — for you and for whoever you sell to down the road.
            </p>
          </div>
          <ul className="space-y-3">
            {[
              "Full 1-year warranty on the home itself",
              "2 years of systems coverage (plumbing, electrical, HVAC)",
              "10 years of major structural coverage",
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
              Submit a warranty request with photos, or call our service line — our team handles
              warranty work start to finish.
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
