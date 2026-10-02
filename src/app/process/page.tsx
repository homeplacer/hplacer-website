import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { ArrowIcon, PhoneIcon } from "@/components/icons";

export const metadata: Metadata = pageMetadata({
  title: "How It Works — From First Call to Front-Door Key",
  description:
    "The Home Placer process for buying a new manufactured home on land in Horry County, SC — pick a home, pick land, we handle setup, you move in.",
  alternates: { canonical: "/process" },
});

const steps = [
  {
    n: "01",
    t: "Tell us what you need",
    d: "Call or send a quick message with your must-haves — beds, baths, budget, and whether you have land. No pressure, no obligation. We'll help you compare a current land-home listing with ordering a model for your own project.",
  },
  {
    n: "02",
    t: "Pick your home",
    d: "Browse Clayton, Cavco, and Champion floor plans online, then ask about available tours and model options. We'll help you balance size, layout, and budget, and explain whether you're looking at a completed home or a model that needs to be ordered.",
  },
  {
    n: "03",
    t: "Pick your land",
    d: "Ask about land-home packages or bring your own land or family property. We'll review the proposed site — access, zoning, utilities, and septic or sewer — and identify the work and approvals needed. Confirm the included land and setup scope in your written estimate.",
  },
  {
    n: "04",
    t: "Review financing with a lender",
    d: "We're not a lender. We can connect you with lenders who review manufactured-home projects and explain the options for your borrower profile and property. Confirm eligibility, down payment, fees, and the estimated payment with the lender; approval and terms are not guaranteed.",
  },
  {
    n: "05",
    t: "We handle the setup",
    d: "For a project that needs setup, we coordinate the agreed permits, delivery, foundation, installation, skirting, and utility connections. Manufacturing, site readiness, weather, inspections, and third-party approvals can affect the sequence and schedule. Ask us for the remaining milestones for your home.",
  },
  {
    n: "06",
    t: "Move in — and we follow up",
    d: "Once the home is complete and the required approvals and closing are in place, walk through your finished home and settle in. We provide a 30-day walk-through and a one-year builder warranty for defects. The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage and ten years of structural coverage through the 2–10 company. Coverage, exclusions, and claim procedures follow your written warranties.",
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
          <h2 className="font-display text-2xl font-semibold">Let&apos;s map out your next step</h2>
          <p className="mx-auto mt-2 max-w-xl text-stone-100/80">
            A completed home and an ordered-home project have different paths to move-in. Tell us
            which home or lot you&apos;re considering, and we&apos;ll talk through what&apos;s ready,
            what&apos;s left, and the next step.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-full bg-accent-500 px-6 py-3 text-base font-semibold text-white transition hover:bg-accent-600"
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
