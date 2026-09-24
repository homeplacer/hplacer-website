import type { Metadata } from "next";
import Link from "next/link";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { FinancingForm } from "@/components/financing-form";
import { PageHero } from "@/components/page-hero";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Down-Payment Assistance for Land-Home Packages",
  description:
    "Explore down-payment assistance options for qualifying Home Placer land-home buyers in South Carolina and North Carolina. Assistance may range from $5,000 to $50,000; restrictions apply.",
  alternates: { canonical: "/down-payment-assistance" },
});

const steps = [
  {
    number: "01",
    title: "Start with your home and location",
    body: "Tell us which Home Placer package, home model, or area you are considering. Assistance programs can depend on the home, property, and location.",
  },
  {
    number: "02",
    title: "Review the options with a lender",
    body: "We will connect you with a lender that can review the programs it offers and the documents needed for your situation.",
  },
  {
    number: "03",
    title: "Get the real numbers in writing",
    body: "Before you make a decision, your lender can explain the available amount, eligibility requirements, loan terms, and any costs you are responsible for.",
  },
];

const factors = [
  "The specific land-home package and where it is located",
  "Program availability and funding at the time you apply",
  "Your lender's program guidelines and credit approval",
  "Your income, household, occupancy, and other eligibility requirements",
];

export default function DownPaymentAssistancePage() {
  return (
    <>
      <PageHero
        eyebrow="Buying help, explained clearly"
        title="Down-payment assistance for your land-home package"
      >
        Assistance may be available for qualifying buyers. We will help you understand the
        options before you commit to a home or lot.
      </PageHero>

      <section className="container-x py-10 sm:py-14">
        <div className="grid gap-8 rounded-[2rem] bg-brand-950 px-6 py-8 text-white shadow-xl sm:px-10 sm:py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent-300">
              For qualifying buyers
            </p>
            <h2 className="mt-3 max-w-2xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
              $5,000 to $50,000 in possible assistance
            </h2>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-stone-100/85 sm:text-lg">
              The amount available depends on the program, the property, and your individual
              qualification. Start with a conversation so we can help you identify the options
              worth asking a lender about.
            </p>
          </div>
          <div className="rounded-card bg-white/10 p-5 ring-1 ring-white/15">
            <p className="font-semibold text-white">What this means</p>
            <p className="mt-2 text-sm leading-relaxed text-stone-100/80">
              This is not a guaranteed credit, a loan approval, or a quote. It is a range of
              potential assistance that may be available to qualified buyers through applicable
              programs. Restrictions apply.
            </p>
          </div>
        </div>
      </section>

      <section className="container-x pb-12 sm:pb-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
              How we help
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
              A clear path from question to real numbers
            </h2>
            <div className="mt-7 space-y-5">
              {steps.map((step) => (
                <article key={step.number} className="flex gap-4 rounded-card border border-stone-line bg-stone-surface p-5">
                  <span className="font-display text-2xl font-semibold text-brand-600">{step.number}</span>
                  <div>
                    <h3 className="font-semibold text-stone-ink">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-stone-muted">{step.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <aside className="rounded-card border border-brand-200 bg-brand-50/60 p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-700">
              What can affect eligibility
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink">
              Every buyer and package is different
            </h2>
            <ul className="mt-6 space-y-4 text-sm leading-relaxed text-stone-ink/85">
              {factors.map((factor) => (
                <li key={factor} className="flex gap-3">
                  <CheckIcon className="mt-0.5 size-5 shrink-0 text-brand-600" strokeWidth={2.5} />
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
            <p className="mt-7 border-t border-brand-200 pt-5 text-sm leading-relaxed text-stone-muted">
              Home Placer is not a lender. Lenders make all lending and program-eligibility
              decisions, and final terms are subject to their review and approval.
            </p>
            <Link
              href="/buyer-resources#financing"
              className="mt-5 inline-flex font-semibold text-brand-700 underline underline-offset-4"
            >
              View official buyer and financing resources
            </Link>
          </aside>
        </div>
      </section>

      <section id="learn-more" className="border-y border-stone-line bg-stone-surface">
        <div className="container-x grid gap-8 py-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
              Ask about your options
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
              Let&apos;s see what may fit your plan
            </h2>
            <p className="mt-4 max-w-xl text-stone-muted">
              Share the basics. We will help you start the right conversation about your
              home, land, financing, and possible assistance — without collecting credit or
              financial details here.
            </p>
            <a
              href={`tel:${site.phoneDial}`}
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-stone-line bg-white px-5 py-2.5 text-sm font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> Call {site.phoneDisplay}
            </a>
          </div>
          <div className="rounded-card border border-stone-line bg-white p-6 shadow-sm">
            <FinancingForm />
          </div>
        </div>
      </section>

      <section className="container-x py-10">
        <p className="max-w-4xl text-xs leading-relaxed text-stone-muted">
          Down-payment assistance availability, amounts, terms, and eligibility vary. The
          $5,000–$50,000 range is not available to every buyer or every property. Programs may
          have income, credit, occupancy, location, property, lender, funding, and other
          restrictions. Home Placer is not a lender and does not make lending decisions.
        </p>
      </section>
    </>
  );
}
