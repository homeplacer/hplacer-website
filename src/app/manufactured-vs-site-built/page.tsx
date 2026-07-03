import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Manufactured vs Site-Built Homes — An Honest Comparison",
  description:
    "How a new manufactured home on land compares to a site-built house on cost, speed, quality, financing, and value — straight from a licensed SC dealer.",
  alternates: { canonical: "/manufactured-vs-site-built" },
};

const rows = [
  { label: "Typical price", mfg: "From the low $200s, all-in with land", site: "Often $350k+ in the same area" },
  { label: "Time to move in", mfg: "Weeks", site: "Many months to over a year" },
  { label: "Construction", mfg: "Built indoors to the federal HUD code — no weather delays or damage", site: "Built on-site, exposed to weather during construction" },
  { label: "Financing", mfg: "FHA, VA, conventional (as real property on land)", site: "FHA, VA, conventional" },
  { label: "Customization", mfg: "Choose floor plan, finishes, and decor packages", site: "Highly custom (at higher cost)" },
  { label: "Land ownership", mfg: "You own the land — no HOA in our packages", site: "You own the land (HOA varies)" },
  { label: "Warranty", mfg: "One-year limited warranty + 30-day walk-through", site: "Builder warranty varies" },
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
          <table className="w-full text-left text-sm">
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

        <div className="mx-auto mt-10 max-w-4xl rounded-card border border-stone-line bg-stone-surface p-8">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">The honest takeaway</h2>
          <p className="mt-3 text-stone-muted">
            A modern manufactured home is built to a strict national standard, sets on a permanent
            foundation, and — when you own the land — is financed, taxed, and valued much like a
            site-built house. For most buyers around the Grand Strand, it&apos;s the fastest, most
            affordable path to owning a brand-new home on your own land.
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Built indoors, on schedule",
              "Real property when on land you own",
              "FHA / VA / conventional financing",
              "No HOA in our packages",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-stone-ink">
                <CheckIcon className="size-4 text-brand-600" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/homes"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              Browse homes <ArrowIcon className="size-4" />
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
