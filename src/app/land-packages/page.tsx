import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/page-hero";
import { ContactForm } from "@/components/contact-form";
import { ForturroLandSearch } from "@/components/forturro-land-search";
import { site } from "@/lib/site";
import { stateAbbrForSlug } from "@/lib/locations";
import { galleryByCategory } from "@/lib/gallery";
import { faqs, type Faq } from "@/lib/faqs";
import { JsonLd, faqLd } from "@/lib/jsonld";
import { CheckIcon, PinIcon, ArrowIcon, PhoneIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Land Packages",
  description:
    "One package, one price: a brand-new home plus the land it sits on. See what's included, what drives the price, and how Home Placer handles permits, delivery, foundation, and utilities across Horry & Georgetown counties, SC.",
  alternates: { canonical: "/land-packages" },
};

const included = [
  "The land — a clear lot, ready to build on",
  "A brand-new Clayton, Cavco, or Champion home",
  "Delivery and professional set on a permanent foundation",
  "Tie-downs, skirting, steps, and final grading",
  "Permits and inspections coordinated for you",
  "Power, water, and septic/sewer hookups",
];

// The honest cost drivers — no invented numbers. Every package is priced as one
// all-in figure; this sets expectations for *why* two packages differ in price.
const priceDrivers = [
  {
    title: "The home you choose",
    body: "Single-wide vs. double-wide, square footage, beds/baths, and finish level. This is the biggest lever — and where the low $200s starts.",
  },
  {
    title: "The land",
    body: "Lot size and location, or whether you bring your own. Already own land? That comes off the package and lowers your all-in price.",
  },
  {
    title: "Site work & foundation",
    body: "Clearing, grading, the permanent foundation, tie-downs, and skirting. A flatter, cleared lot costs less to prep than a wooded or sloped one.",
  },
  {
    title: "Utilities & permits",
    body: "Water tap or well, septic or sewer connection, power, and county permits/impact fees. These vary by parcel and county.",
  },
];

// Reuse the site's real FAQ content — a curated, package-relevant subset.
const WANT = [
  "What's included in a Home Placer land-home package?",
  "Can I put a home on land I already own?",
  "How much does a new manufactured home on land cost?",
  "What kind of financing is available?",
  "How long does the whole process take?",
  "Does the lot need septic or sewer — and what about water?",
];
const packageFaqs = WANT.map((q) => faqs.find((f) => f.q === q)).filter(Boolean) as Faq[];

export default function LandPackagesPage() {
  const photos = [
    ...galleryByCategory("homes").slice(0, 3),
    ...galleryByCategory("development").slice(0, 1),
  ];

  return (
    <>
      {/* FAQPage schema for the questions shown on this page (mirrors the visible
          accordion below — same curated subset, no hidden or invented content). */}
      {packageFaqs.length > 0 && <JsonLd data={faqLd(packageFaqs)} />}
      <PageHero eyebrow="What you actually get" title="Home + land, one package">
        Buying a manufactured home is usually a scavenger hunt — a home from one place, a
        lot from another, a setup crew from somewhere else. We bundle all of it into a
        single price and a single point of contact.
      </PageHero>

      {/* ─────────────── What's included + where we place ─────────────── */}
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
              whole setup — and the land comes off your price. Call us and we&apos;ll walk the
              site with you.
            </p>
          </div>
        </div>

        <aside className="rounded-card border border-stone-line bg-brand-950 p-7 text-white">
          <h3 className="font-display text-xl font-semibold">Where we place homes</h3>
          <ul className="mt-5 space-y-3">
            {site.locations.map((l) => (
              <li key={l.slug} className="flex items-center gap-3 text-stone-100/85">
                <PinIcon className="size-4 text-accent-300" /> {l.name}, {stateAbbrForSlug(l.slug)}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-stone-100/70">
            Scattered lots across Horry &amp; Georgetown counties — your home isn&apos;t confined to
            one subdivision, and there&apos;s no HOA.
          </p>
          <Link
            href="#get-package-price"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-600"
          >
            Get your package price <ArrowIcon className="size-4" />
          </Link>
        </aside>
      </section>

      {/* ─────────────── What drives your price (transparency) ─────────────── */}
      <section className="bg-stone-surface py-16">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
              Straight talk on pricing
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
              What drives your price
            </h2>
            <p className="mt-3 text-stone-muted">
              Packages start in the low $200s. Because every home and every lot is different,
              we don&apos;t post one-size-fits-all prices — we give you a single, all-in number
              for your exact package. Here&apos;s what moves it.
            </p>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {priceDrivers.map((d, i) => (
              <div key={d.title} className="rounded-card border border-stone-line bg-stone-bg p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-brand-700 font-display text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-stone-ink">{d.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-stone-muted">{d.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-stone-muted">
            No lot yet? A quarter-acre and setup are already built into our package pricing —{" "}
            <Link href="#get-package-price" className="font-semibold text-brand-700 hover:text-brand-900">
              tell us what you want and we&apos;ll price it exactly
            </Link>
            .
          </p>
        </div>
      </section>

      {/* ─────────────── Real work photos ─────────────── */}
      {photos.length > 0 && (
        <section className="container-x py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Real packages, placed</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
                Homes we&apos;ve set on land
              </h2>
            </div>
            <Link
              href="/recently-placed"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
            >
              See homes we&apos;ve placed <ArrowIcon className="size-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {photos.map((img) => (
              <Link key={img.src} href="/gallery" className="group block overflow-hidden rounded-card border border-stone-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.alt}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────── Common questions ─────────────── */}
      <section className="bg-stone-surface py-16">
        <div className="container-x max-w-3xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
              Common questions
            </h2>
            <Link
              href="/faq"
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
            >
              All FAQs <ArrowIcon className="size-4" />
            </Link>
          </div>
          <div className="mt-8 divide-y divide-stone-line rounded-card border border-stone-line bg-stone-bg">
            {packageFaqs.map((f) => (
              <details key={f.q} className="group px-6 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-stone-ink">
                  {f.q}
                  <span className="shrink-0 text-brand-600 transition group-open:rotate-45">
                    <ArrowIcon className="size-4 rotate-90" />
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-stone-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────── Get your package price (inline lead) ─────────────── */}
      <section id="get-package-price" className="relative scroll-mt-24 overflow-hidden bg-brand-950 text-white">
        <div className="topo absolute inset-0" aria-hidden />
        <div className="container-x relative grid gap-10 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent-300">
              One number, no runaround
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
              Get your package price
            </h2>
            <p className="mt-4 max-w-md text-stone-100/80">
              Tell us the home you like (or that you&apos;re not sure yet), whether you have land,
              and roughly where — and we&apos;ll send one all-in number for the home, land, setup,
              and an estimated monthly payment.
            </p>
            <ul className="mt-7 space-y-3 text-sm text-stone-100/85">
              {[
                "Home + land + setup in a single price",
                "Bring your own land and we'll subtract it",
                "Financing help for FHA / VA / USDA buyers",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-accent-300" strokeWidth={2.5} /> {t}
                </li>
              ))}
            </ul>
            <p className="mt-7 text-sm text-stone-100/70">
              Prefer to talk?{" "}
              <a href={`tel:${site.phoneDial}`} className="font-semibold text-white underline-offset-4 hover:underline">
                <PhoneIcon className="mr-1 inline size-4 align-[-2px]" />
                Call or text {site.phoneDisplay}
              </a>
            </p>
          </div>

          <div className="rounded-2xl bg-stone-bg p-6 shadow-2xl ring-1 ring-white/10 sm:p-8">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Need land first? Cross over to our sister company's MLS search. */}
      <ForturroLandSearch />
    </>
  );
}
