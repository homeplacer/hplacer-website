import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

export const metadata: Metadata = pageMetadata({
  title: "Manufactured vs Site-Built Homes — An Honest Comparison",
  description:
    "How a new manufactured home on land compares to a site-built house on cost, speed, quality, financing, and value — straight from a licensed SC dealer.",
  alternates: { canonical: "/manufactured-vs-site-built" },
});

const rows = [
  { label: "Project cost", mfg: "Compare current land-home listings or request a model-and-lot estimate", site: "Request a quote with the same land, finishes, and site-work scope" },
  { label: "Time to move in", mfg: "Ready homes and ordered homes have different schedules; confirm the specific property", site: "An existing home and a new build have different schedules; confirm the specific property" },
  { label: "Construction", mfg: "Factory-built to the federal HUD Code, with site preparation and installation afterward", site: "Built on-site to applicable state and local building codes" },
  { label: "Financing", mfg: "Conventional, FHA, VA, or USDA options may be available; lender and property requirements apply", site: "Loan options depend on the borrower, property, and lender" },
  { label: "Customization", mfg: "Available floor plans, finishes, and decor depend on the model and order stage", site: "Available changes depend on the builder, plans, and budget" },
  { label: "Land ownership", mfg: "Land-home packages include land; check the specific lot's restrictions and HOA status", site: "Check the specific lot's restrictions and HOA status" },
  { label: "Warranty", mfg: "One-year builder defects warranty; separate 2–10 mechanical and structural coverage. Written terms apply", site: "Review the builder's written warranty" },
];

export default function ComparisonPage() {
  return (
    <>
      <PageHero eyebrow="An honest comparison" title="Manufactured vs. site-built">
        We&apos;ll be straight with you: a site-built home and a new manufactured home on land
        each have a place. Here&apos;s how they really stack up in Horry County.
      </PageHero>

      <section className="container-x py-12">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-card border border-stone-line">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-brand-900 text-white">
              <tr>
                <th className="p-4 font-semibold"></th>
                <th className="p-4 font-display text-base font-semibold">New manufactured + land</th>
                <th className="p-4 font-display text-base font-semibold text-stone-100/80">Site-built</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-line">
              {rows.map((r, i) => (
                <tr key={r.label} className={i % 2 ? "bg-stone-surface" : "bg-stone-bg"}>
                  <td className="p-4 font-semibold text-stone-ink">{r.label}</td>
                  <td className="p-4 text-stone-ink">{r.mfg}</td>
                  <td className="p-4 text-stone-muted">{r.site}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-4xl rounded-card border border-stone-line bg-stone-surface p-8">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">The honest takeaway</h2>
          <p className="mt-3 text-stone-muted">
            Start with the home, the lot, and the total project scope — not a headline price or a
            promised move-in date. A completed land-home listing is different from ordering a model
            for a lot that still needs permits, utilities, and installation. We&apos;ll help you
            compare those paths and get the details for the property you&apos;re considering.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Federal HUD Code construction",
              "Site-work scope confirmed for your lot",
              "Financing subject to lender approval",
              "Property-specific price and schedule",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-stone-ink">
                <CheckIcon className="size-4 text-brand-600" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/land-packages"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              View land-home packages <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
          <p className="mt-5 text-sm text-stone-muted">
            Home Placer&apos;s builder warranty covers defects for one year. The separate 2–10
            coverage provides two years for mechanical and ten years for structural coverage
            through the 2–10 company. See our{" "}
            <Link href="/warranty" className="font-medium text-brand-700 underline underline-offset-4">
              warranty overview
            </Link>{" "}
            and your written warranty for coverage, exclusions, and claim procedures.
          </p>
        </div>
      </section>
    </>
  );
}
