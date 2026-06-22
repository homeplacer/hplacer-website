import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { locations, getLocation, cityGeo } from "@/lib/locations";
import { featuredHomes } from "@/lib/homes";
import { HomeCard } from "@/components/home-card";
import { JsonLd, breadcrumbLd } from "@/lib/jsonld";
import { site } from "@/lib/site";
import { CheckIcon, PhoneIcon, ArrowIcon, PinIcon } from "@/components/icons";

export function generateStaticParams() {
  return locations.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const loc = getLocation(slug);
  if (!loc) return { title: "Location not found" };
  const g = cityGeo[loc.slug];
  return {
    title: loc.headline,
    description: loc.intro,
    alternates: { canonical: `/locations/${loc.slug}` },
    other: g
      ? {
          "geo.region": "US-SC",
          "geo.placename": `${loc.name}, South Carolina`,
          "geo.position": `${g.lat};${g.lng}`,
          ICBM: `${g.lat}, ${g.lng}`,
        }
      : {},
  };
}

export default async function LocationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const loc = getLocation(slug);
  if (!loc) notFound();
  const homes = featuredHomes(3);

  // Real Home Placer homes photographed in this town (geo-tagged from Joe's
  // photos). Empty if none for this town.
  let townPhotos: string[] = [];
  try {
    townPhotos = fs
      .readdirSync(path.join(process.cwd(), "public", "locations", slug))
      .filter((f) => /\.jpe?g$/i.test(f))
      .sort()
      .map((f) => `/locations/${slug}/${f}`);
  } catch {}

  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Locations", path: "/locations" },
          { name: loc.name, path: `/locations/${loc.slug}` },
        ])}
      />

      <section className="relative overflow-hidden bg-brand-950 text-white">
        <div className="topo absolute inset-0" aria-hidden />
        <div className="container-x relative py-16">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-300 ring-1 ring-white/15">
            <PinIcon className="size-3.5" /> {loc.county}, SC
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {loc.headline}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-stone-100/80">{loc.intro}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/homes"
              className="inline-flex items-center gap-2 rounded-full bg-accent-400 px-6 py-3 text-base font-semibold text-brand-950 transition hover:bg-accent-300"
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
        </div>
      </section>

      <section className="container-x grid gap-12 py-14 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5 leading-relaxed text-stone-ink/85">
          {loc.paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <ul className="grid gap-3 pt-2 sm:grid-cols-2">
            {loc.highlights.map((h) => (
              <li key={h} className="flex items-start gap-3">
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                  <CheckIcon className="size-3.5" strokeWidth={2.5} />
                </span>
                <span className="text-stone-ink">{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <aside className="rounded-card border border-stone-line bg-stone-surface p-7">
          <h2 className="font-display text-xl font-semibold text-stone-ink">
            Placing homes in {loc.name}
          </h2>
          <p className="mt-3 text-sm text-stone-muted">
            Tell us about your lot — or use ours. We handle permits, delivery, foundation, and
            utilities, and hand you the keys.
          </p>
          <Link
            href={`/contact?home=${encodeURIComponent(loc.name + " area")}`}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Start in {loc.name} <ArrowIcon className="size-4" />
          </Link>
        </aside>
      </section>

      {townPhotos.length > 0 && (
        <section className="bg-stone-surface py-14">
          <div className="container-x">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Real Home Placer homes</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-stone-ink">
              Recently placed around {loc.name}
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {townPhotos.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src}
                  src={src}
                  alt={`Home Placer manufactured home placed near ${loc.name}, SC`}
                  loading="lazy"
                  className="aspect-[4/3] w-full rounded-card border border-stone-line object-cover shadow-sm"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="container-x pb-16 pt-14">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            Homes you can place near {loc.name}
          </h2>
          <Link href="/homes" className="text-sm font-semibold text-brand-700 hover:text-brand-900">
            View all
          </Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {homes.map((h) => (
            <HomeCard key={h.id} home={h} />
          ))}
        </div>
      </section>
    </>
  );
}
