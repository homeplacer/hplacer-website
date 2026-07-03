import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "About",
  description:
    "Home Placer is a licensed manufactured-home dealer in Horry County, SC, pairing new homes with land at honest prices.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <PageHero eyebrow="Who we are" title="Affordable homeownership, done right">
        Home Placer exists to make a brand-new home on your own land genuinely
        affordable in Horry County — without the runaround that usually comes with it.
      </PageHero>

      <section className="container-x grid gap-12 py-16 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5 text-stone-ink/85 leading-relaxed">
          <p>
            We&apos;re a licensed South Carolina manufactured-home dealer based in Myrtle
            Beach. We hand-pick floor plans from Clayton, Cavco, and Champion, then pair
            them with land across the Grand Strand and handle everything in between —
            permits, delivery, foundation, utilities, and the final walk-through.
          </p>
          <p>
            That &quot;everything in between&quot; is the whole point. A new home shouldn&apos;t
            require you to juggle a builder, a land seller, a setup crew, and a lender on
            your own. We put it into one package, one price, and one team you can call.
          </p>
          <p>
            And we keep it honest. Homes from the low $200s, no HOA, a one-year limited
            warranty, and a 30-day walk-through after you move in. If a deal isn&apos;t right
            for you, we&apos;ll tell you.
          </p>

          <div className="grid gap-4 pt-4 sm:grid-cols-2">
            {[
              { stat: "Low $200s", label: "Starting package price" },
              { stat: "5 cities", label: "Across Horry County" },
              { stat: "3 brands", label: "Clayton · Cavco · Champion" },
              { stat: "$0 HOA", label: "You own your land" },
            ].map((s) => (
              <div key={s.label} className="rounded-card border border-stone-line bg-stone-surface p-5">
                <p className="font-display text-2xl font-semibold text-brand-700">{s.stat}</p>
                <p className="mt-1 text-sm text-stone-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-card border border-stone-line bg-stone-bg p-7 shadow-sm">
          <h2 className="font-display text-xl font-semibold text-stone-ink">Why buyers choose us</h2>
          <ul className="mt-4 space-y-3 text-sm text-stone-ink/85">
            {site.valueProps.map((v) => (
              <li key={v.title} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                  <CheckIcon className="size-3" strokeWidth={2.5} />
                </span>
                <span>
                  <span className="font-semibold text-stone-ink">{v.title}.</span> {v.body}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              Talk to us <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-line px-5 py-2.5 text-sm font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </aside>
      </section>
    </>
  );
}
