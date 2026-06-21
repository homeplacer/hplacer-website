import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllHomes,
  getHome,
  getHomesByBrand,
  formatPrice,
  displayPrice,
} from "@/lib/homes";
import { HomeCard } from "@/components/home-card";
import { JsonLd, homeProductLd, breadcrumbLd } from "@/lib/jsonld";
import {
  BedIcon,
  BathIcon,
  RulerIcon,
  PhoneIcon,
  CheckIcon,
  ArrowIcon,
  HomeMark,
} from "@/components/icons";
import { site } from "@/lib/site";

export function generateStaticParams() {
  return getAllHomes().map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const home = getHome(slug);
  if (!home) return { title: "Home not found" };
  return {
    title: `${home.name} — ${home.brand} ${home.series} (${home.beds} bd / ${home.baths} ba)`,
    description: home.excerpt,
    openGraph: home.imageUrls[0] ? { images: [home.imageUrls[0]] } : undefined,
  };
}

export default async function HomeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const home = getHome(slug);
  if (!home) notFound();

  const price = displayPrice(home);
  const [hero, ...rest] = home.imageUrls;
  const thumbs = rest.slice(0, 6);

  const specs = [
    { label: "Bedrooms", value: `${home.beds}` },
    { label: "Bathrooms", value: `${home.baths}` },
    { label: "Square feet", value: `${home.sqft.toLocaleString()} (${home.widthFt}′ × ${home.lengthFt}′)` },
    { label: "Brand", value: home.brand },
    { label: "Series", value: home.series },
    { label: "Model", value: home.modelCode || home.name },
  ];

  const related = getHomesByBrand(home.brand)
    .filter((h) => h.slug !== home.slug)
    .slice(0, 3);

  return (
    <>
      <JsonLd data={homeProductLd(home)} />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Homes", path: "/homes" },
          { name: home.name, path: `/homes/${home.slug}` },
        ])}
      />
      <div className="container-x pt-8 text-sm text-stone-muted">
        <Link href="/homes" className="hover:text-brand-700">
          ← All homes
        </Link>
      </div>

      <section className="container-x grid gap-10 py-8 lg:grid-cols-2 lg:items-start">
        {/* Gallery */}
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-gradient-to-br from-brand-100 via-stone-surface to-accent-100">
            {hero ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={hero} alt={home.name} className="size-full object-cover" />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-brand-300/70">
                <HomeMark className="size-24" strokeWidth={1} />
              </div>
            )}
            <span className="absolute left-4 top-4 rounded-full bg-stone-bg/90 px-3 py-1 text-sm font-semibold text-brand-800 shadow-sm">
              {home.brand}
            </span>
          </div>
          {thumbs.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {thumbs.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={src}
                  alt={`${home.name} photo ${i + 2}`}
                  loading="lazy"
                  className="aspect-square w-full rounded-lg object-cover ring-1 ring-stone-line"
                />
              ))}
            </div>
          )}
        </div>

        {/* Summary */}
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-ink">{home.name}</h1>
          <p className="mt-1 text-stone-muted">
            {home.brand} · {home.series}
          </p>

          {price != null ? (
            <div className="mt-5">
              <p className="font-display text-4xl font-semibold text-brand-700">
                {formatPrice(price)}
                <span className="ml-2 align-middle text-base font-normal text-stone-muted">starting</span>
              </p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-muted">
                {home.setupPrice ? "Full setup — home, ¼-acre lot & utilities" : "Home only"}
              </p>
              {home.setupPrice && home.price && (
                <p className="mt-1 text-sm text-stone-muted">
                  Home only {formatPrice(home.price)}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-5 font-display text-3xl font-semibold text-brand-700">Call for pricing</p>
          )}

          <p className="mt-3 text-sm text-stone-muted">
            Ask about the complete package — this home on a{" "}
            <strong className="font-semibold text-stone-ink">¼-acre lot</strong>, delivered, set,
            and connected to utilities.
          </p>

          <div className="mt-6 flex flex-wrap gap-5 text-base text-stone-ink">
            <span className="inline-flex items-center gap-2">
              <BedIcon className="size-5 text-brand-600" /> {home.beds} beds
            </span>
            <span className="inline-flex items-center gap-2">
              <BathIcon className="size-5 text-brand-600" /> {home.baths} baths
            </span>
            <span className="inline-flex items-center gap-2">
              <RulerIcon className="size-5 text-brand-600" /> {home.sqft.toLocaleString()} sqft
            </span>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/contact?home=${encodeURIComponent(home.name)}`}
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              Request this home <ArrowIcon className="size-4" />
            </Link>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-line px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-muted">
            {["No HOA", "1-year warranty", "Land + setup available", "Move-in ready"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-brand-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Description + specs */}
      <section className="container-x grid gap-10 py-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-ink">About this home</h2>
          <div className="mt-4 space-y-4 leading-relaxed text-stone-ink/85">
            {home.description.split("\n").filter(Boolean).map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          {home.decorOptions.length > 0 && (
            <div className="mt-8">
              <h3 className="font-display text-lg font-semibold text-stone-ink">
                Decor &amp; color options
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {home.decorOptions.map((d) => (
                  <span
                    key={d}
                    className="rounded-full border border-stone-line bg-stone-surface px-3 py-1.5 text-sm text-stone-ink"
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <aside>
          <div className="rounded-card border border-stone-line bg-stone-surface p-6">
            <h3 className="font-display text-lg font-semibold text-stone-ink">Specifications</h3>
            <dl className="mt-4 divide-y divide-stone-line">
              {specs.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-stone-muted">{s.label}</dt>
                  <dd className="text-right font-medium text-stone-ink">{s.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </section>

      {related.length > 0 && (
        <section className="container-x py-12">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            More from {home.brand}
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((h) => (
              <HomeCard key={h.id} home={h} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
