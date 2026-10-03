import { pageMetadata } from "@/lib/metadata";
import Link from "next/link";
import type { Metadata } from "next";
import { PageHero } from "@/components/page-hero";
import { FinancingForm } from "@/components/financing-form";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { site } from "@/lib/site";

export const metadata: Metadata = pageMetadata({
  title: "Financing",
  description:
    "Explore manufactured-home financing in SC and NC. Ask about USDA, FHA, VA, and conventional options, with borrower, property, program, and lender requirements.",
  alternates: { canonical: "/financing" },
});

const programs = [
  {
    name: "USDA",
    rate: "No down payment for qualifying buyers",
    body: "Ask a participating lender to check your address, household income, proposed home, and application. An eligible rural area is one requirement, not a loan approval. Cash for closing and other costs may still be needed.",
  },
  {
    name: "VA",
    rate: "For eligible borrowers and properties",
    body: "A VA-backed purchase loan may offer no down payment for qualifying borrowers. Your lender checks entitlement, credit, income, the home, appraisal, and other requirements; service history alone does not establish approval.",
  },
  {
    name: "FHA",
    rate: "Ask about the applicable FHA product",
    body: "FHA options have borrower, home, and program requirements. Ask your lender which product it offers for your manufactured-home project and confirm the down payment, mortgage insurance, costs, and property documentation.",
  },
  {
    name: "Conventional",
    rate: "Terms depend on your project and lender",
    body: "Ask about conventional manufactured-home loan options and the home's required documentation, foundation, title, and appraisal. Your lender provides the actual rate, payment, fees, down payment, and approval decision.",
  },
];

export default function FinancingPage() {
  return (
    <>
      <PageHero eyebrow="Paying for it" title="Financing that fits real budgets">
        Tell us about the home and land you have in mind. Home Placer is a
        manufactured-home dealer, not a lender; we can help you connect with a
        lender to review possible financing paths for your project.
      </PageHero>

      <div className="container-x flex flex-wrap gap-x-6 gap-y-3 pt-8">
        <Link href="/down-payment-assistance" className="font-semibold text-brand-700 underline">Explore down-payment assistance</Link>
        <Link href="/buyer-resources#financing" className="font-semibold text-brand-700 underline">Official program information and questions for your lender</Link>
      </div>
      <section className="container-x py-16">
        <div className="mx-auto mb-8 max-w-4xl rounded-card border border-brand-200 bg-brand-50/60 p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Current buyer offer</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
            $5,000 toward closing costs or a 6.5% promotional rate
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-stone-muted">
            Available on qualifying Home Placer land-home packages through January 27, 2027.
            Offers are subject to home and land availability, lender approval, credit and program
            eligibility, and final loan terms. Offers may not be combined and may change or end
            without notice. Contact Home Placer for the current details on a specific home.
          </p>
        </div>
        <div className="mx-auto mb-10 max-w-3xl rounded-card border border-brand-200 bg-brand-50/60 p-6 text-center">
          <p className="leading-relaxed text-stone-ink/90">
            <strong className="font-semibold text-stone-ink">
              The home, land, title, and borrower all matter.
            </strong>{" "}
            Owning land and installing a permanent foundation do not automatically
            establish real-property classification or loan approval. Ask your
            lender and closing professionals to confirm the title, home
            documentation, appraisal, and chosen program&apos;s requirements.
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
            <strong className="font-semibold text-stone-ink">Check the address, not just the town name.</strong>{" "}
            Start with the{" "}
            <a href="https://eligibility.sc.egov.usda.gov/eligibility/welcomeAction.do" className="font-semibold text-brand-700 underline underline-offset-4" target="_blank" rel="noopener noreferrer">official USDA eligibility tool</a>,
            then ask a participating lender to review the actual home and your
            application. A map result is not a financing commitment.
          </p>
        </div>

        <div
          id="apply"
          className="mt-12 grid gap-8 rounded-card border border-stone-line bg-stone-surface p-8 lg:grid-cols-[1.05fr_1fr] lg:items-start"
        >
          <div>
            <h2 className="font-display text-2xl font-semibold text-stone-ink">
              Ask about financing
            </h2>
            <p className="mt-3 text-stone-muted">
              Share your contact information and whether you already have land.
              We&apos;ll discuss your next step and help you connect with a lender.
              This is an information request, not a loan application or approval;
              do not include sensitive financial information here.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-stone-ink/85">
              {["No credit pull for this inquiry", "Ask about assistance eligibility", "Honest guidance, no pressure"].map((t) => (
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
            <FinancingForm submitLabel="Request financing information" successTitle="Thanks for your inquiry." successMessage="A Home Placer team member will reach out to discuss your next step. Your request is not a loan application or approval." />
          </div>
        </div>

        <p className="mt-6 max-w-3xl text-xs leading-relaxed text-stone-muted">
          Rates, terms, payments, and available programs depend on the lender,
          borrower, home, land, appraisal, and applicable requirements. Home
          Placer is not a lender. A lender&apos;s written disclosures and approval
          determine your financing; this page does not promise eligibility or terms.
        </p>

        <aside className="mt-10 max-w-3xl border-t border-stone-line pt-6" aria-labelledby="financing-reading">
          <h2 id="financing-reading" className="font-display text-xl font-semibold text-stone-ink">
            Before you compare financing
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-muted">
            Review the questions to ask about{" "}
            <Link href="/blog/manufactured-home-down-payment-requirements" className="font-semibold text-brand-700 underline underline-offset-4">down payments and cash to close</Link>{" "}
            and{" "}
            <Link href="/blog/manufactured-home-insurance-cost-grand-strand-sc" className="font-semibold text-brand-700 underline underline-offset-4">insurance costs on the Grand Strand</Link>.
            Your lender and insurance agent must provide the figures for your actual home and lot.
            If a term is unfamiliar, use our{" "}
            <Link href="/glossary" className="font-semibold text-brand-700 underline underline-offset-4">home-buying glossary</Link>.
          </p>
        </aside>
      </section>
    </>
  );
}
