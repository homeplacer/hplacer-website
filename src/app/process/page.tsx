import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { ArrowIcon, PhoneIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "How It Works — From First Call to Front-Door Key",
  description:
    "The Home Placer process for buying a new manufactured home on land in Horry County, SC — pick a home, pick land, we handle setup, you move in.",
};

const steps = [
  {
    n: "01",
    t: "Tell us what you need",
    d: "Call or send a quick message with your must-haves — beds, baths, budget, and whether you have land. No pressure, no obligation. We'll point you to the right models and a realistic payment range.",
  },
  {
    n: "02",
    t: "Pick your home",
    d: "Browse Clayton, Cavco, and Champion floor plans online, then tour models or walk the options with us. We'll help you balance size, layout, and budget so the home fits your life and your number.",
  },
  {
    n: "03",
    t: "Pick your land",
    d: "Use one of our lots or bring your own land or family property. We'll evaluate the site — access, utilities, septic or sewer — and bundle the land and home into a single package and price.",
  },
  {
    n: "04",
    t: "Lock in financing",
    d: "We connect you with lenders who do manufactured-home-on-land loans (FHA, VA, conventional) and help every credit situation. You get a clear, all-in number and monthly payment before anything is final.",
  },
  {
    n: "05",
    t: "We handle the setup",
    d: "Permits, delivery, foundation, set, tie-downs, skirting, and utility hookups — power, water, and septic or sewer. This is the part that overwhelms people doing it alone. It's our job, start to finish.",
  },
  {
    n: "06",
    t: "Move in — and we follow up",
    d: "Walk through your finished home, get your keys, and settle in. A 30-day walk-through and a one-year limited warranty mean anything that needs attention gets handled after you're in.",
  },
];

export default function ProcessPage() {
  return (
    <>
      <PageHero eyebrow="How it works" title="From first call to front-door key">
        Buying a new home on land shouldn&apos;t mean juggling a builder, a land seller, a setup
        crew, and a lender on your own. Here&apos;s how we make it one path.
      </PageHero>

      <section className="container-x py-14">
        <ol className="mx-auto max-w-3xl space-y-4">
          {steps.map((s) => (
            <li
              key={s.n}
              className="flex gap-5 rounded-card border border-stone-line bg-stone-bg p-6"
            >
              <span className="font-display text-3xl font-semibold text-accent-400">{s.n}</span>
              <div>
                <h2 className="font-display text-xl font-semibold text-stone-ink">{s.t}</h2>
                <p className="mt-1.5 leading-relaxed text-stone-muted">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="topo mx-auto mt-12 max-w-3xl overflow-hidden rounded-3xl bg-brand-900 p-8 text-center text-white">
          <h2 className="font-display text-2xl font-semibold">It really is that simple</h2>
          <p className="mx-auto mt-2 max-w-xl text-stone-100/80">
            Most buyers go from first call to keys in a matter of weeks. Let&apos;s start with a
            conversation.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-accent-400 px-6 py-3 text-base font-semibold text-brand-950 transition hover:bg-accent-300"
            >
              Get started <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-base font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
