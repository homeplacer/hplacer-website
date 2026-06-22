import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { CheckIcon, PinIcon, ArrowIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Land Packages",
  description:
    "One package, one price: a brand-new home plus the land it sits on. Home Placer handles permits, delivery, foundation, and utilities across Horry County, SC.",
};

const included = [
  "The land — a clear lot, ready to build on",
  "A brand-new Clayton, Cavco, or Champion home",
  "Delivery and professional set on a permanent foundation",
  "Tie-downs, skirting, steps, and final grading",
  "Permits and inspections coordinated for you",
  "Power, water, and septic/sewer hookups",
];

export default function LandPackagesPage() {
  return (
    <>
      <PageHero eyebrow="What you actually get" title="Home + land, one package">
        Buying a manufactured home is usually a scavenger hunt — a home from one place, a
        lot from another, a setup crew from somewhere else. We bundle all of it into a
        single price and a single point of contact.
      </PageHero>

      <section className="container-x grid gap-12 py-16 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            Everything in the package
          </h2>
          <ul className="mt-6 space-y-3">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                  <CheckIcon className="size-3.5" strokeWidth={2.5} />
                </span>
                <span className="text-stone-ink/85">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-card border border-stone-line bg-stone-surface p-6">
            <h3 className="font-display text-lg font-semibold text-stone-ink">Already own land?</h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-muted">
              Perfect. We&apos;ll place any of our homes on your lot or family land and handle the
              whole setup. Call us and we&apos;ll walk the site with you.
            </p>
          </div>
        </div>

        <aside className="rounded-card border border-stone-line bg-brand-950 p-7 text-white">
          <h3 className="font-display text-xl font-semibold">Where we place homes</h3>
          <ul className="mt-5 space-y-3">
            {site.locations.map((l) => (
              <li key={l.slug} className="flex items-center gap-3 text-stone-100/85">
                <PinIcon className="size-4 text-accent-300" /> {l.name}, SC
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-stone-100/70">
            Scattered lots across Horry County — your home isn&apos;t confined to one
            subdivision, and there&apos;s no HOA.
          </p>
          <Link
            href="/contact"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600"
          >
            Start your package <ArrowIcon className="size-4" />
          </Link>
        </aside>
      </section>
    </>
  );
}
