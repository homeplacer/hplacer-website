import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { JsonLd, faqLd, breadcrumbLd } from "@/lib/jsonld";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

// SEO/geo per the standing rule — built from a Gemini "top Google engineer"
// consult (2026-06-29). Deliberately captures the high-volume "mobile home"
// search and pivots it to the accurate "manufactured home" story.
export const metadata: Metadata = pageMetadata({
  title: "Mobile vs. Manufactured Home: What's the Difference?",
  description:
    "Is there a difference between a mobile home and a manufactured home? The structural, legal, and financing differences — plain English, for SC & NC land buyers.",
  alternates: { canonical: "/mobile-home-vs-manufactured-home" },
});

const faqs = [
  {
    q: "What's the difference between a mobile home and a manufactured home?",
    a: "The important distinction is the construction standard. 'Mobile home' commonly refers to a factory-built home made before June 15, 1976. Manufactured homes built after that date follow the federal HUD construction and safety standards. Not every factory-built home is manufactured housing: modular homes follow applicable state and local building codes.",
  },
  {
    q: "Can you still buy a brand-new mobile home?",
    a: "People still use 'mobile home' when searching for a new manufactured home. Compare the specific model's floor plan, specifications, included finishes, construction standard, and written warranty rather than relying on the nickname.",
  },
  {
    q: "Can I get a regular mortgage, or only a 'mobile home loan'?",
    a: "Mortgage options may be available, but land ownership and a permanent foundation do not automatically establish real-property status or loan approval. A lender reviews the home, title, site, appraisal, borrower, and chosen program's requirements. Home-only financing has a different scope; ask which options fit your actual project.",
  },
  {
    q: "What should I check for a Grand Strand coastal site?",
    a: "Confirm the home's HUD data-plate ratings and the required foundation and installation design for the actual site. Coastal exposure and other site conditions may require additional review. No home is storm-proof; follow local emergency guidance rather than treating a wind-zone designation as a safety guarantee.",
  },
];

export default function MobileVsManufacturedPage() {
  return (
    <>
      <JsonLd data={faqLd(faqs)} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Mobile vs. Manufactured", path: "/mobile-home-vs-manufactured-home" },
        ])}
      />

      <PageHero eyebrow="Plain-English guide" title="Mobile home vs. manufactured home">
        Good news: you&apos;re probably picturing the right house — just using the old word. Here&apos;s
        the real difference between a &ldquo;mobile home&rdquo; and a manufactured home, and what it
        means for your home&apos;s safety, financing, and value here in the Grand Strand.
      </PageHero>

      {/* The 1976 pivot */}
      <section className="container-x py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            The 1976 pivot: when &ldquo;mobile&rdquo; became &ldquo;manufactured&rdquo;
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-stone-ink/85">
            <p>
              The short version: the difference is a <strong className="font-semibold text-stone-ink">date</strong>.
              A true &ldquo;mobile home&rdquo; is a factory-built home made{" "}
              <strong className="font-semibold text-stone-ink">before June 15, 1976</strong>. On that day,
              the U.S. Department of Housing and Urban Development (HUD) put a strict federal building code
              in place — covering structure, safety, energy, and wind resistance.
            </p>
            <p>
              <strong className="font-semibold text-stone-ink">Manufactured homes</strong>{" "}
              follow those federal standards. The familiar &ldquo;mobile home&rdquo;
              name still appears in buyer searches, but it does not tell you the
              actual home&apos;s construction standard. Modular homes are also
              factory-built, but follow applicable state and local building codes.
            </p>
            <h3 className="pt-2 font-display text-lg font-semibold text-stone-ink">
              Why the word still sticks
            </h3>
            <p>
              Familiar language lasts longer than changes in construction standards.
              Look at the model&apos;s floor plan, specifications, included finishes,
              actual photos, and written warranty. Neither the name nor land ownership
              guarantees a home&apos;s quality, resale value, or financing terms.
            </p>
          </div>
        </div>
      </section>

      {/* Then vs now */}
      <section className="container-x py-4">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-card border border-stone-line">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-brand-900 text-white">
              <tr>
                <th className="p-4 font-semibold"></th>
                <th className="p-4 font-display text-base font-semibold text-stone-100/85">
                  &ldquo;Mobile home&rdquo; (pre-1976)
                </th>
                <th className="p-4 font-display text-base font-semibold">
                  Manufactured home (today)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-line">
              {[
                { l: "Building standard", o: "No federal code", n: "Federal HUD code (since 1976)" },
                { l: "Construction", o: "Review the individual home's records and condition", n: "Factory-built to HUD construction and safety standards" },
                { l: "Site suitability", o: "Check the actual home, location, and installation", n: "Match documented ratings and installation design to the site" },
                { l: "Interior", o: "Finishes and condition vary by home", n: "Compare model-specific finishes and included options" },
                { l: "Financing", o: "Options depend on home, title, borrower, and lender", n: "Mortgage options may be available; program requirements apply" },
                { l: "Value", o: "Condition, land, location, and market matter", n: "Condition, land, location, and market matter; no guaranteed appreciation" },
              ].map((r, i) => (
                <tr key={r.l} className={i % 2 ? "bg-stone-surface" : "bg-stone-bg"}>
                  <td className="p-4 font-semibold text-stone-ink">{r.l}</td>
                  <td className="p-4 text-stone-muted">{r.o}</td>
                  <td className="p-4 text-stone-ink">{r.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </section>

      {/* Land and financing require project-specific review */}
      <section className="container-x py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            Match the home, land, and financing
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-stone-ink/85">
            <p>
              A <strong className="font-semibold text-stone-ink">permanent foundation</strong>{" "}
              and proper real-property classification can be important mortgage
              requirements. They are not the entire approval process. Your lender
              and closing professionals review the title, home, property, appraisal,
              and borrower against the applicable requirements.
            </p>
            <p>
              Home Placer&apos;s <strong className="font-semibold text-stone-ink">model package estimates</strong>{" "}
              include full setup and assume a quarter-acre lot. Confirm the actual
              parcel, utilities, site work, options, and closing arrangement in the
              written scope. Prefer a lot without an HOA? Ask us to confirm the
              chosen property&apos;s association status and recorded restrictions.
            </p>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-muted">
            {["Model specifications available for review", "Written home-and-land scope", "Lender reviews the actual project", "Confirm the chosen lot's restrictions"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-brand-600" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/financing" className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800">
              How financing works <ArrowIcon className="size-4" />
            </Link>
            <Link href="/modular-vs-manufactured-homes" className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300">
              Modular vs. manufactured
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="container-x py-4">
        <h2 className="text-center font-display text-2xl font-semibold text-stone-ink">Common questions</h2>
        <div className="mx-auto mt-8 max-w-3xl divide-y divide-stone-line">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-stone-ink">
                {f.q}
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-stone-line text-brand-700 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-stone-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-x py-12">
        <div className="mx-auto flex max-w-4xl flex-col gap-5 rounded-card border border-stone-line bg-stone-surface p-7 text-center sm:p-10">
          <h2 className="font-display text-2xl font-semibold text-stone-ink sm:text-3xl">
            Ready to see what a modern one looks like?
          </h2>
          <p className="mx-auto max-w-xl text-stone-muted">
            Forget the word — come see the homes. Browse what we&apos;ve placed on land across the Grand
            Strand, or just call and we&apos;ll answer every question, no pressure.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/recently-placed" className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800">
              See homes we&apos;ve placed <ArrowIcon className="size-4" />
            </Link>
            <a href={`tel:${site.phoneDial}`} className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300">
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
