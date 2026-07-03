import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { JsonLd, faqLd, breadcrumbLd } from "@/lib/jsonld";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

// SEO/geo per the standing rule — built from a Gemini "top Google engineer"
// consult (2026-06-29). Deliberately captures the high-volume "mobile home"
// search and pivots it to the accurate "manufactured home" story.
export const metadata: Metadata = {
  title: "Mobile vs. Manufactured Home: What's the Difference?",
  description:
    "Is there a difference between a mobile home and a manufactured home? The structural, legal, and financing differences — plain English, for SC & NC land buyers.",
  alternates: { canonical: "/mobile-home-vs-manufactured-home" },
};

const faqs = [
  {
    q: "What's the difference between a mobile home and a manufactured home?",
    a: "It comes down to a date. A 'mobile home' is a factory-built home made before June 15, 1976. On that day the federal HUD code took over with strict safety, structural, and energy standards — and every factory-built home since is legally a 'manufactured home.' So when most people say 'mobile home' today, they're picturing a manufactured home: newer, safer, and far better built.",
  },
  {
    q: "Can you still buy a brand-new mobile home?",
    a: "No — nothing has been built as a 'mobile home' since 1976. Every new home we sell is a manufactured (or modular) home built to today's HUD code, with options like full drywall, energy-efficient construction, and a real warranty. Same idea you're picturing, just the modern, code-built version.",
  },
  {
    q: "Can I get a regular mortgage, or only a 'mobile home loan'?",
    a: "On a permanent foundation on land you own, a manufactured home is real property — so it qualifies for the same conventional, FHA, VA, and USDA mortgages as a site-built house. That's a world away from the short, high-rate 'chattel' loans old mobile homes used. We set ours up to qualify and walk you through it.",
  },
  {
    q: "Are these homes safe in Grand Strand hurricanes?",
    a: "Yes. Every home we place is built to its wind zone — HUD Wind Zone II along the coastal Carolinas — with engineered tie-downs and a proper foundation. Factory construction is consistent and inspected. It's not a 1970s trailer; it's a modern, code-built home.",
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
              Every factory-built home since is, legally and technically, a{" "}
              <strong className="font-semibold text-stone-ink">manufactured home</strong>. So when someone
              says &ldquo;I&apos;m looking at mobile homes,&rdquo; what they&apos;re actually shopping for
              today is a manufactured home — you simply <em>can&apos;t buy a new &ldquo;mobile home,&rdquo;</em>{" "}
              because none have been built in almost 50 years.
            </p>
            <h3 className="pt-2 font-display text-lg font-semibold text-stone-ink">
              Why the word still sticks
            </h3>
            <p>
              Old habits — and old reputations. The 1970s mobile home earned a reputation for thin
              construction and dropping in value. The modern manufactured home is a different animal:
              built indoors to the HUD code, available with full drywall, energy-efficient, warrantied,
              and — set on land you own — it builds equity like any other house.
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
                { l: "Construction", o: "Lightweight trailers", n: "Built indoors, inspected, engineered" },
                { l: "Wind safety", o: "Minimal", n: "Built to the coastal wind zone (HUD Zone II here)" },
                { l: "Interior", o: "Thin panel walls", n: "Full drywall available, full-size kitchen & baths" },
                { l: "Financing", o: "Short, high-rate 'chattel' loans", n: "Conventional / FHA / VA / USDA as real property" },
                { l: "Value", o: "Tended to depreciate", n: "Builds equity on land you own" },
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

      {/* Land, financing, equity */}
      <section className="container-x py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            Land, financing &amp; equity — the part that really matters
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-stone-ink/85">
            <p>
              The reason old mobile homes lost value is that they were often financed and titled like a
              vehicle, with no land underneath. Put a modern manufactured home on a{" "}
              <strong className="font-semibold text-stone-ink">permanent foundation on land you own</strong>,
              and it becomes <strong className="font-semibold text-stone-ink">real property</strong> — it
              appreciates with your land and qualifies for a normal 30-year mortgage.
            </p>
            <p>
              That&apos;s exactly what we do: a <strong className="font-semibold text-stone-ink">land-home
              package</strong> — your new home and a ¼-acre lot, set, connected, and financed together, in
              one closing, across Horry County and the Grand Strand (and into NC).
            </p>
          </div>
          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-muted">
            {["Real-property mortgage, not a trailer loan", "New, HUD-code, warrantied", "Builds equity on your land", "No HOA in our packages"].map((t) => (
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
