import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { FinancingForm } from "@/components/financing-form";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Financing",
  description:
    "USDA, FHA, VA, and conventional financing for new manufactured homes on land in South Carolina. $0-down options and help for every credit situation.",
};

const programs = [
  {
    name: "USDA",
    rate: "$0 down · rural areas",
    body: "Putting a home on land in rural Horry County? A USDA Rural Development loan can finance 100% — zero down — in eligible areas like Loris, Aynor, and Longs. Income limits apply; primary residence only.",
  },
  {
    name: "VA",
    rate: "$0 down for veterans",
    body: "If you’ve served, a VA loan can mean no down payment and no monthly mortgage insurance on your home-and-land package.",
  },
  {
    name: "FHA",
    rate: "As low as 3.5% down",
    body: "Government-backed loans built for first-time and budget-conscious buyers. Flexible credit guidelines and low down payments.",
  },
  {
    name: "Conventional",
    rate: "Competitive fixed rates",
    body: "Strong credit and a down payment? A conventional loan keeps your long-term cost down with predictable fixed payments.",
  },
];

export default function FinancingPage() {
  return (
    <>
      <PageHero eyebrow="Paying for it" title="Financing that fits real budgets">
        Most of our buyers finance the home and the land together as one loan. We&apos;ll
        connect you with lenders who actually do manufactured-home-on-land loans — and
        we&apos;ll help no matter where your credit stands today.
      </PageHero>

      <section className="container-x py-16">
        <div className="mx-auto mb-10 max-w-3xl rounded-card border border-brand-200 bg-brand-50/60 p-6 text-center">
          <p className="leading-relaxed text-stone-ink/90">
            <strong className="font-semibold text-stone-ink">
              Every manufactured home we sell — on land you own — qualifies as real property.
            </strong>{" "}
            That means the same <strong>conventional, FHA, VA, and USDA</strong> loans as a site-built
            house: a real 30-year mortgage, not a short, high-rate &ldquo;mobile home&rdquo; loan.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {programs.map((p) => (
            <div key={p.name} className="rounded-card border border-stone-line bg-stone-bg p-6">
              <h2 className="font-display text-2xl font-semibold text-stone-ink">{p.name}</h2>
              <p className="mt-1 text-sm font-semibold text-brand-700">{p.rate}</p>
              <p className="mt-3 text-sm leading-relaxed text-stone-muted">{p.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-card border border-brand-200 bg-brand-50 p-5">
          <CheckIcon className="mt-0.5 size-5 shrink-0 text-brand-600" strokeWidth={2.5} />
          <p className="text-sm leading-relaxed text-stone-ink/85">
            <strong className="font-semibold text-stone-ink">A lot of Horry County qualifies for USDA $0-down financing.</strong>{" "}
            Because we place homes on land out in Conway, Loris, Longs, and Aynor, many of our lots fall in
            USDA-eligible rural areas — ask us to check your address.
          </p>
        </div>

        <div
          id="apply"
          className="mt-12 grid gap-8 rounded-card border border-stone-line bg-stone-surface p-8 lg:grid-cols-[1.05fr_1fr] lg:items-start"
        >
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-ink">
              Apply for financing
            </h2>
            <p className="mt-3 text-stone-muted">
              Start here and we&apos;ll match you to the right loan. Worried your credit
              isn&apos;t ready? Don&apos;t count yourself out — we work with lenders for a
              wide range of situations and give you a straight answer.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-stone-ink/85">
              {["No credit pull to get started", "Down-payment assistance options", "Honest guidance, no pressure"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <CheckIcon className="size-4 text-brand-600" /> {t}
                </li>
              ))}
            </ul>
            <a
              href={`tel:${site.phoneDial}`}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-5 py-2.5 text-sm font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> Or call {site.phoneDisplay}
            </a>
          </div>
          <div className="rounded-card border border-stone-line bg-stone-bg p-6 shadow-sm">
            <FinancingForm />
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-stone-muted">
          Rates and terms vary by lender, credit profile, and program eligibility. Home
          Placer is not a lender; we connect buyers with third-party lenders. All financing
          subject to credit approval.
        </p>
      </section>
    </>
  );
}
