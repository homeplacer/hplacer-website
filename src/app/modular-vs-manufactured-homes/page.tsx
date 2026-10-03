import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { JsonLd, faqLd, breadcrumbLd } from "@/lib/jsonld";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

// SEO/geo per the standing rule — title/meta/outline/keywords/FAQ from a Gemini
// "top Google engineer" consult (2026-06-29).
export const metadata: Metadata = pageMetadata({
  title: "Modular vs. Manufactured Homes: Pros & Cons",
  description:
    "Confused by modular vs. manufactured homes in SC & NC? An honest, plain-English guide to the real difference, pros and cons, foundations, and financing.",
  alternates: { canonical: "/modular-vs-manufactured-homes" },
});

const rows = [
  { label: "Building code", mod: "Built to applicable state and local building codes", man: "Built to the federal HUD Code" },
  { label: "Foundation", mod: "A permanent foundation designed for the home and site", man: "An installation and foundation system designed for the home and site" },
  { label: "Financing", mod: "Mortgage options depend on borrower, property, and lender approval", man: "Conventional, FHA, VA, or USDA options may be available; program requirements apply" },
  { label: "Value over time", mod: "Location, condition, and the local market affect resale value", man: "Location, land, condition, and the local market affect resale value" },
  { label: "Project cost", man: "Compare current land-home listings or ask for a model-and-lot estimate", mod: "Ask for a quote covering the same land, finishes, and site work" },
  { label: "Time to move in", mod: "Confirm the home's status, permits, foundation, and remaining work", man: "Ready homes and ordered homes have different schedules; confirm the specific property" },
  { label: "Customization", mod: "Available plans and finishes depend on the manufacturer and order", man: "Available floor plans, finishes, and decor depend on the model and order" },
  { label: "When it's finished", mod: "Review the actual home, specifications, and included finishes", man: "Review the actual home, specifications, and included finishes" },
];

const faqs = [
  {
    q: "What's the real difference between a modular and a manufactured home?",
    a: "The main difference is the building code. A manufactured home is factory-built to the federal HUD Code on a permanent chassis. A modular home is factory-built to applicable state and local building codes and assembled on site. Both still need site preparation, installation, and local approvals.",
  },
  {
    q: "Is a manufactured home just a 'mobile home'?",
    a: "People often use the terms interchangeably, but manufactured homes built after June 15, 1976 follow the federal HUD construction and safety standards. Look at the specific model's floor plan, finishes, specifications, and warranty rather than relying on the nickname.",
  },
  {
    q: "Do modular homes hold their value better than manufactured homes?",
    a: "Neither type comes with a guaranteed resale value or appreciation rate. Location, land, condition, comparable sales, and the local market all matter. Compare actual properties and talk with your lender about the appraisal requirements for the home you're considering.",
  },
  {
    q: "Is financing different for modular vs. manufactured homes?",
    a: "Both can have mortgage options, but approval is not automatic. For a manufactured home, lenders review the home's documentation, foundation, title, land, and other program requirements, as well as the borrower. Conventional, FHA, VA, or USDA options may be available. We're not a lender; we can help you connect with one to review your specific home and situation.",
  },
  {
    q: "What should I check for a coastal Carolina site?",
    a: "Check that the home's design ratings suit the specific location and that the foundation and installation meet the applicable requirements. A manufactured home's HUD data plate identifies its wind, roof-load, and thermal zones. Site conditions and local approvals also matter; no home is storm-proof.",
  },
];

export default function ModularVsManufacturedPage() {
  return (
    <>
      <JsonLd data={faqLd(faqs)} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Modular vs. Manufactured", path: "/modular-vs-manufactured-homes" },
        ])}
      />

      <PageHero eyebrow="Plain-English guide" title="Modular vs. manufactured homes">
        New to all this? You&apos;re not alone. Here&apos;s the honest difference between a modular and a
        manufactured home — the pros, the cons, and what it means for your foundation, financing, and
        value — with zero pressure. When you&apos;re ready, we&apos;ll answer anything.
      </PageHero>

      {/* The core difference */}
      <section className="container-x py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            The core difference: it&apos;s about the building code
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-stone-ink/85">
            <p>
              Both modular and manufactured homes are factory-built, then delivered for installation.
              The main difference is the <strong className="font-semibold text-stone-ink">building code</strong>{" "}
              each follows. Indoor construction does not remove the need for outdoor site work,
              permits, utility connections, or final inspections.
            </p>
            <p>
              <strong className="font-semibold text-stone-ink">Manufactured homes</strong> are built to
              the federal <strong>HUD Code</strong> on a permanent chassis. Compare available models
              and land-home packages to see how their layout, features, and total cost fit your budget.
            </p>
            <p>
              <strong className="font-semibold text-stone-ink">Modular homes</strong> are built to the
              applicable <strong>state and local building codes</strong> and assembled on site.
              The foundation, permits, and lender requirements still need to be checked for the
              specific home and lot.
            </p>
            <h3 className="pt-2 font-display text-lg font-semibold text-stone-ink">
              &ldquo;But isn&apos;t that just a mobile home?&rdquo;
            </h3>
            <p>
              It&apos;s a common name, but the important distinction is the construction standard.
              Manufactured homes built after June 15, 1976 follow the federal HUD standards.
              Browse the floor plans and actual photos to compare kitchens, baths, and finishes —
              and ask which features are included in the model you like.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="container-x py-4">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-card border border-stone-line">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-brand-900 text-white">
              <tr>
                <th className="p-4 font-semibold"></th>
                <th className="p-4 font-display text-base font-semibold">Manufactured</th>
                <th className="p-4 font-display text-base font-semibold text-stone-100/85">Modular</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-line">
              {rows.map((r, i) => (
                <tr key={r.label} className={i % 2 ? "bg-stone-surface" : "bg-stone-bg"}>
                  <td className="p-4 font-semibold text-stone-ink">{r.label}</td>
                  <td className="p-4 text-stone-ink">{r.man}</td>
                  <td className="p-4 text-stone-ink">{r.mod}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* Pros & cons */}
      <section className="container-x py-12">
        <h2 className="text-center font-display text-2xl font-semibold text-stone-ink">
          Honest pros &amp; cons
        </h2>
        <div className="mx-auto mt-8 grid max-w-4xl gap-6 sm:grid-cols-2">
          {[
            {
              title: "Manufactured home",
              pros: ["Factory-built to federal HUD standards", "A range of floor plans and finish options", "Land-home or your-own-land project options", "New-home warranty details available for review"],
              cons: ["Confirm the model can be placed on your specific lot", "Foundation, title, and loan-program requirements need review"],
            },
            {
              title: "Modular home",
              pros: ["Factory-built to applicable state and local codes", "Manufacturer-specific plans and finish choices", "Permanent foundation designed for the site", "Mortgage options subject to lender and property approval"],
              cons: ["Compare quotes with the same project scope", "Site preparation, permitting, and installation still affect timing"],
            },
          ].map((c) => (
            <div key={c.title} className="rounded-card border border-stone-line bg-stone-surface p-6">
              <h3 className="font-display text-lg font-semibold text-stone-ink">{c.title}</h3>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-700">Pros</p>
              <ul className="mt-2 space-y-2 text-sm text-stone-ink">
                {c.pros.map((p) => (
                  <li key={p} className="flex gap-2">
                    <CheckIcon className="mt-0.5 size-4 shrink-0 text-brand-600" /> {p}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-stone-muted">Trade-offs</p>
              <ul className="mt-2 space-y-2 text-sm text-stone-muted">
                {c.cons.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-stone-line" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Financing depends on the home, site, title, and borrower */}
      <section className="container-x py-4">
        <div className="mx-auto max-w-4xl rounded-card border border-brand-200 bg-brand-50/60 p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">The financing key</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
            The foundation matters — so do the title, property, and borrower
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-ink/85">
            A <strong className="font-semibold text-stone-ink">permanent foundation</strong> and
            proper real-property classification can be important requirements for a manufactured-home
            mortgage. Owning the land alone does not guarantee a loan or determine the home&apos;s
            legal classification. Your lender reviews the home, title, site, appraisal, and borrower
            against the chosen program&apos;s rules. Ask which options are available for your
            property before assuming a rate, payment, or approval.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/financing"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              See financing options <ArrowIcon className="size-4" />
            </Link>
            <Link
              href="/land-packages"
              className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              Land + home packages
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-x py-12">
        <h2 className="text-center font-display text-2xl font-semibold text-stone-ink">Common questions</h2>
        <div className="mx-auto mt-8 max-w-3xl divide-y divide-stone-line">
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
      </section>

      {/* CTA */}
      <section className="container-x pb-16">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 rounded-card border border-stone-line bg-stone-surface p-7 text-center sm:p-10">
          <h2 className="font-display text-2xl font-semibold text-stone-ink sm:text-3xl">
            Still not sure which fits you?
          </h2>
          <p className="mx-auto max-w-xl text-stone-muted">
            That&apos;s exactly what we&apos;re here for. Tell us about your land, your budget, and what
            you&apos;re picturing — we&apos;ll lay out your real options, no pressure.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              Ask us anything <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
