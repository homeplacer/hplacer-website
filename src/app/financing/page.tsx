import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { FinancingForm } from "@/components/financing-form";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Financing",
  description:
    "FHA, VA, and conventional financing for new manufactured homes on land in South Carolina. Low down payments and help for every credit situation.",
};

const programs = [
  {
    name: "FHA",
    rate: "As low as 3.5% down",
    body: "Government-backed loans built for first-time and budget-conscious buyers. Flexible credit guidelines and low down payments.",
  },
  {
    name: "VA",
    rate: "$0 down for veterans",
    body: "If you’ve served, a VA loan can mean no down payment and no monthly mortgage insurance on your home-and-land package.",
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
        <div className="grid gap-6 md:grid-cols-3">
          {programs.map((p) => (
            <div key={p.name} className="rounded-card border border-stone-line bg-stone-bg p-6">
              <h2 className="font-display text-2xl font-semibold text-stone-ink">{p.name}</h2>
              <p className="mt-1 text-sm font-semibold text-brand-700">{p.rate}</p>
              <p className="mt-3 text-sm leading-relaxed text-stone-muted">{p.body}</p>
            </div>
          ))}
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
