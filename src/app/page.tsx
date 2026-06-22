import Link from "next/link";
import { site } from "@/lib/site";
import { bestSellerHomes, BRANDS } from "@/lib/homes";
import { galleryByCategory } from "@/lib/gallery";
import { HomeCard } from "@/components/home-card";
import {
  ArrowIcon,
  CheckIcon,
  PhoneIcon,
  PinIcon,
  HomeMark,
} from "@/components/icons";

export const metadata = {
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const homes = bestSellerHomes().slice(0, 6);
  const work = [...galleryByCategory("homes").slice(0, 4), ...galleryByCategory("development").slice(0, 2)];

  return (
    <>
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="topo absolute inset-0" aria-hidden />
        <div className="container-x relative grid gap-12 py-20 md:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-300 ring-1 ring-white/15">
              Licensed land + home dealer · Horry County
            </p>
            <h1 className="mt-5 max-w-2xl font-display text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
              A brand-new home — and the land it sits on — from the low&nbsp;$200s.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone-100/80">
              Home Placer pairs Clayton, Cavco, and Champion homes with land in
              Conway, Loris, Longs, Aynor, and Myrtle Beach. One package, one
              team, no HOA.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/homes"
                className="inline-flex items-center gap-2 rounded-full bg-accent-400 px-6 py-3 text-base font-semibold text-brand-950 shadow-sm transition hover:bg-accent-300"
              >
                Browse homes <ArrowIcon className="size-4" />
              </Link>
              <a
                href={`tel:${site.phoneDial}`}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-6 py-3 text-base font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/15"
              >
                <PhoneIcon className="size-4" /> {site.phoneDisplay}
              </a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-100/75">
              {["No HOA", "Land + home bundled", "1-year warranty", "Licensed SC dealer"].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <CheckIcon className="size-4 text-accent-300" /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Hero photo — real #1 best-seller home */}
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/models/ultra-flex-28-52/01.jpg"
              alt="A new Home Placer manufactured home on its land in Horry County, SC"
              className="aspect-[4/3] w-full rounded-2xl object-cover shadow-2xl ring-1 ring-white/15"
            />
            <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-accent-400 px-3 py-1 text-xs font-bold text-brand-950 shadow">
              ★ Best Seller · The 52 Breeze
            </span>
            <div className="absolute bottom-4 left-4 rounded-xl bg-brand-950/80 px-4 py-2.5 backdrop-blur">
              <span className="block text-xs font-medium text-stone-100/70">Packages from</span>
              <span className="font-display text-2xl font-semibold text-white">the low $200s</span>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────── Value props ──────────────────── */}
      <section className="border-b border-stone-line bg-stone-surface">
        <div className="container-x grid gap-px py-2 sm:grid-cols-2 lg:grid-cols-4">
          {site.valueProps.map((v) => (
            <div key={v.title} className="p-6">
              <div className="grid size-10 place-items-center rounded-lg bg-brand-100 text-brand-700">
                <CheckIcon className="size-5" strokeWidth={2.5} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-stone-ink">{v.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-muted">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────── Best sellers ──────────────────── */}
      <section className="container-x py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Our most-placed homes</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
              Best sellers
            </h2>
          </div>
          <Link
            href="/homes"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            View all homes <ArrowIcon className="size-4" />
          </Link>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map((h) => (
            <HomeCard key={h.id} home={h} />
          ))}
        </div>
      </section>

      {/* ──────────────────── Brands ──────────────────── */}
      <section className="bg-stone-surface py-20">
        <div className="container-x">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">The builders we carry</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
              Three trusted brands. One honest price.
            </h2>
            <p className="mt-3 text-stone-muted">
              We hand-pick floor plans from America&apos;s most dependable manufacturers — then
              put them on land near you.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {BRANDS.map((b) => (
              <div key={b.brand} className="rounded-card border border-stone-line bg-stone-bg p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-brand-700 text-white">
                    <HomeMark className="size-5" />
                  </span>
                  <h3 className="font-display text-xl font-semibold text-stone-ink">{b.brand}</h3>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-stone-muted">{b.blurb}</p>
                <Link
                  href="/brands"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900"
                >
                  See {b.brand} homes <ArrowIcon className="size-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ──────────────────── How it works ──────────────────── */}
      <section className="container-x py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">How it works</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
              From first call to front-door key
            </h2>
          </div>
          <Link
            href="/process"
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            See the full process <ArrowIcon className="size-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", t: "Pick your home", d: "Browse our floor plans or tell us what you need. We match you to a model and a budget." },
            { n: "02", t: "Pick your land", d: "Use our lots or bring your own. We handle the package — home plus land, one price." },
            { n: "03", t: "We do the setup", d: "Permits, delivery, foundation, tie-downs, and utility hookups — all coordinated by us." },
            { n: "04", t: "Move in", d: "Walk through your new home, get your keys, and enjoy a 30-day check-in and 1-year warranty." },
          ].map((s) => (
            <div key={s.n} className="rounded-card border border-stone-line bg-stone-bg p-6">
              <span className="font-display text-3xl font-semibold text-accent-400">{s.n}</span>
              <h3 className="mt-3 font-display text-lg font-semibold text-stone-ink">{s.t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────── Locations ──────────────────── */}
      <section className="bg-stone-surface py-16">
        <div className="container-x flex flex-col items-center text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Where we place homes</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink">All across the Grand Strand</h2>
          <ul className="mt-7 flex flex-wrap justify-center gap-3">
            {site.locations.map((l) => (
              <li key={l.slug}>
                <Link
                  href={`/locations/${l.slug}`}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-4 py-2 text-sm font-medium text-stone-ink transition hover:border-brand-300 hover:text-brand-800"
                >
                  <PinIcon className="size-4 text-brand-600" /> {l.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ──────────────────── Our work ──────────────────── */}
      {work.length > 0 && (
        <section className="bg-stone-surface py-20">
          <div className="container-x">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Real projects</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-stone-ink sm:text-4xl">
                  Homes we&apos;ve placed, land we&apos;ve developed
                </h2>
                <p className="mt-3 text-stone-muted">
                  We don&apos;t just sell homes — we develop the land and set the home, start to
                  finish. Here&apos;s a look at real Home Placer work across Horry County.
                </p>
              </div>
              <Link
                href="/gallery"
                className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700 hover:text-brand-900"
              >
                See our work <ArrowIcon className="size-4" />
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {work.map((img) => (
                <Link key={img.src} href="/gallery" className="group block overflow-hidden rounded-card border border-stone-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.src}
                    alt={img.alt}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ──────────────────── Final CTA ──────────────────── */}
      <section className="container-x py-20">
        <div className="topo relative overflow-hidden rounded-3xl bg-brand-900 px-8 py-14 text-center text-white sm:px-12">
          <div className="relative mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-semibold sm:text-4xl">
              Ready to find your home?
            </h2>
            <p className="mt-3 text-stone-100/80">
              Tell us what you&apos;re looking for. We&apos;ll match you to a home, a lot, and a
              monthly payment that works — no pressure, no runaround.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
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
        </div>
      </section>
    </>
  );
}
