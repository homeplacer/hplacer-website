import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { site } from "@/lib/site";
import { JsonLd, faqLd, breadcrumbLd } from "@/lib/jsonld";
import { CheckIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

// SEO/geo per the standing rule — title/meta/outline/keywords/FAQ from a Gemini
// "top Google engineer" consult (2026-06-29).
export const metadata: Metadata = {
  title: "Modular vs. Manufactured Homes: Pros & Cons",
  description:
    "Confused by modular vs. manufactured homes in SC & NC? An honest, plain-English guide to the real difference, pros and cons, foundations, and financing.",
  alternates: { canonical: "/modular-vs-manufactured-homes" },
};

const rows = [
  { label: "Building code", mod: "Built to the same state/local code as a site-built house (IRC)", man: "Built to the federal HUD code — one national standard" },
  { label: "Foundation", mod: "Set on a permanent foundation (crawlspace, basement, or slab)", man: "Permanent foundation on your land, or a pier-and-beam set" },
  { label: "Financing", mod: "Conventional, FHA, VA, USDA — just like a stick-built home", man: "Sold with land, every one qualifies: conventional, FHA, VA & USDA" },
  { label: "Value over time", mod: "Appraised and appreciates like a site-built home", man: "Builds equity when tied to deeded land — strongest on a permanent foundation" },
  { label: "Typical cost", man: "Most affordable — new homes from the low $200s, all-in with land", mod: "More than manufactured, well under most site-built" },
  { label: "Time to move in", mod: "Weeks (a bit longer for foundation + permits)", man: "Weeks — built indoors, no weather delays" },
  { label: "Customization", mod: "Floor plans + finishes, with more design freedom", man: "Choose floor plan, finishes, and decor packages" },
  { label: "When it's finished", mod: "Looks and lives like any other house on the street", man: "Looks and lives like any other house on the street" },
];

const faqs = [
  {
    q: "What's the real difference between a modular and a manufactured home?",
    a: "It comes down to the building code. A manufactured home is built to the federal HUD code — one national standard — and arrives on a steel chassis. A modular home is built to the same state and local building code as a site-built house (the IRC) and is assembled on a permanent foundation. Both are built indoors in a controlled factory; the code and foundation are what differ.",
  },
  {
    q: "Is a manufactured home just a 'mobile home'?",
    a: "No. True 'mobile homes' haven't been built since 1976, when the federal HUD code took over. A modern manufactured home is a brand-new, code-built, warrantied house — drywall or finished interior, full-size kitchen and baths, energy-efficient, and built to the wind zone for our area. When it's set and skirted on land, most people can't tell it from a site-built home.",
  },
  {
    q: "Do modular homes hold their value better than manufactured homes?",
    a: "Modular homes appraise and appreciate much like site-built homes because they meet local building code on a permanent foundation. Manufactured homes also build value when they're permanently set on deeded land you own — the land is the appreciating asset, and a permanent foundation makes a big difference.",
  },
  {
    q: "Is financing different for modular vs. manufactured homes?",
    a: "Modular homes qualify for standard conventional, FHA, VA, and USDA loans, just like stick-built. Manufactured homes qualify for those same programs when financed as real property on land — lenders look for a permanent, HUD-certified foundation and clear title to the land. We do this every day and can walk you through the path that fits.",
  },
  {
    q: "Can these homes hold up to coastal Carolina weather?",
    a: "Yes. Every home we place is built to the wind zone for its location — HUD Wind Zone II along the Grand Strand coast. Factory construction is consistent and inspected, and a proper foundation and tie-down system are part of every install.",
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
              Both modular and manufactured homes are built indoors, in a controlled factory, then
              delivered to your land — so neither sits out in the rain getting built like a site-built
              house. The difference is the <strong className="font-semibold text-stone-ink">code</strong>{" "}
              each is built to.
            </p>
            <p>
              <strong className="font-semibold text-stone-ink">Manufactured homes</strong> are built to
              the federal <strong>HUD code</strong> — a single national standard — and arrive on a steel
              frame. They&apos;re the most affordable way into a brand-new home on land.
            </p>
            <p>
              <strong className="font-semibold text-stone-ink">Modular homes</strong> are built to the
              same <strong>state and local building code</strong> as a stick-built house and are
              assembled on a permanent foundation — so they appraise and finance much like any other
              house on the street.
            </p>
            <h3 className="pt-2 font-display text-lg font-semibold text-stone-ink">
              &ldquo;But isn&apos;t that just a mobile home?&rdquo;
            </h3>
            <p>
              No — and this is the biggest misconception we hear. True &ldquo;mobile homes&rdquo;
              haven&apos;t been built since 1976. A modern manufactured home is a new, code-built,
              warrantied house with a real kitchen, full baths, and finished interior. Set and skirted
              on land, most people can&apos;t tell the difference from a site-built home.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="container-x py-4">
        <div className="mx-auto max-w-4xl overflow-hidden rounded-card border border-stone-line">
          <table className="w-full text-left text-sm">
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
              pros: ["Most affordable new home on land", "Sold with land, qualifies for conventional, FHA, VA or USDA", "Fastest move-in — weeks, not months", "Brand-new, warrantied, energy-efficient"],
              cons: ["Some still carry an old 'mobile home' perception", "Value is land-driven — strongest on deeded land you own"],
            },
            {
              title: "Modular home",
              pros: ["Appraises & appreciates like a site-built home", "Built to the same local code as stick-built", "Most flexible design & layout", "Conventional/FHA/VA/USDA financing"],
              cons: ["Costs more than a manufactured home", "Foundation + permitting take a little longer"],
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

      {/* Permanent foundation = financeable */}
      <section className="container-x py-4">
        <div className="mx-auto max-w-4xl rounded-card border border-brand-200 bg-brand-50/60 p-6 sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">The financing key</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
            A permanent foundation makes a manufactured home financeable like a regular house
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-ink/85">
            Here&apos;s what most people don&apos;t realize: when a manufactured home is set on a{" "}
            <strong className="font-semibold text-stone-ink">permanent, HUD-certified foundation</strong>{" "}
            on land you own, it&apos;s treated as <strong className="font-semibold text-stone-ink">real
            property</strong> — not a vehicle. That opens up the same mortgage programs as a site-built
            house: <strong>conventional, FHA, VA, and USDA</strong>. It&apos;s the difference between a
            short, high-rate &ldquo;chattel&rdquo; loan and a real 30-year mortgage — and it&apos;s how
            most of our buyers finance their home. In fact,{" "}
            <strong className="font-semibold text-stone-ink">every manufactured home we sell with land
            qualifies for conventional, FHA, VA, or USDA financing</strong> — the same programs as a
            site-built house. We handle the land, the foundation, and the paperwork so it does.
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
