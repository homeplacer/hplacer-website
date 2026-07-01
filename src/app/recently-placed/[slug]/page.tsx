import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllPlacedHomes,
  getPlacedHome,
  relatedPlacedHomes,
} from "@/lib/placed-homes";
import { getHome, formatPrice } from "@/lib/homes";
import { HomeGallery } from "@/components/home-gallery";
import { WantThisHouseForm } from "@/components/want-this-house-form";
import { JsonLd, breadcrumbLd, placedHomeLd, placedHomeResidenceLd } from "@/lib/jsonld";
import { asset } from "@/lib/asset";
import { site } from "@/lib/site";
import {
  BedIcon,
  BathIcon,
  RulerIcon,
  PinIcon,
  PhoneIcon,
  ArrowIcon,
  CheckIcon,
} from "@/components/icons";

export function generateStaticParams() {
  return getAllPlacedHomes().map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const h = getPlacedHome(slug);
  if (!h) return { title: "Home not found" };
  const lot = h.lotAcres ? `${h.lotAcres} acres` : "its own land";
  return {
    title: `${h.address}, ${h.town}, SC — ${h.beds} bd / ${h.baths} ba manufactured home`,
    description: `A ${h.beds}-bed ${h.baths}-bath ${h.style.toLowerCase()} manufactured home Home Placer placed and sold on ${lot} at ${h.address}, ${h.town}, SC.${h.modelName ? ` This is the ${h.modelName} — see every photo and the floor plan.` : " See every photo."}`,
    alternates: { canonical: `/recently-placed/${h.slug}` },
    openGraph: { images: [asset(h.photo)] },
  };
}

function LotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
    </svg>
  );
}

export default async function PlacedHomeDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const h = getPlacedHome(slug);
  if (!h) notFound();

  const model = h.modelSlug ? getHome(h.modelSlug) : undefined;
  const fp = model?.floorPlans?.[0];
  const heroImg = model?.imageUrls?.[0];
  const images = (h.photos.length ? h.photos : [h.photo]).map(asset);
  const related = relatedPlacedHomes(h.slug, h.town);

  const specs = [
    { label: "Bedrooms", value: String(h.beds) },
    { label: "Bathrooms", value: String(h.baths) },
    { label: "Home style", value: h.style },
    h.sqftHeated ? { label: "Heated sq ft", value: h.sqftHeated.toLocaleString() } : null,
    h.lotAcres ? { label: "Lot size", value: `${h.lotAcres} acres` } : null,
    { label: "Sold for", value: formatPrice(h.price) },
    h.modelName
      ? { label: "Model", value: model?.name ?? h.modelName, href: model ? `/homes/${model.slug}` : undefined }
      : null,
  ].filter(Boolean) as { label: string; value: string; href?: string }[];

  return (
    <>
      <JsonLd data={placedHomeLd(h, model ? { name: model.name } : undefined)} />
      <JsonLd
        data={placedHomeResidenceLd(
          h,
          model ? { name: model.name, brand: model.brand, sqft: model.sqft } : undefined,
        )}
      />
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Recently Placed", path: "/recently-placed" },
          { name: h.address, path: `/recently-placed/${h.slug}` },
        ])}
      />

      <div className="container-x pt-8 text-sm text-stone-muted">
        <Link href="/recently-placed" className="hover:text-brand-700">
          ← All placed homes
        </Link>
      </div>

      {/* Gallery + summary */}
      <section className="container-x grid gap-10 py-8 lg:grid-cols-2 lg:items-start">
        <HomeGallery images={images} name={`${h.address}, ${h.town}, SC`} brand="Sold" />

        <div>
          <div className="flex items-center gap-2 text-brand-600">
            <PinIcon className="size-5" />
            <span className="text-sm font-semibold uppercase tracking-wider">{h.town}, SC</span>
          </div>
          <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink">{h.address}</h1>
          <p className="mt-1 text-stone-muted">
            {h.beds} bd · {h.baths} ba · {h.style}
            {h.withLand ? " · on its own land" : ""}
          </p>

          <div className="mt-5">
            <p className="font-display text-4xl font-semibold text-brand-700">
              {formatPrice(h.price)}
              <span className="ml-2 align-middle text-base font-normal text-stone-muted">sold</span>
            </p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-stone-muted">
              Closed sale · Coastal Carolinas MLS
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-5 text-base text-stone-ink">
            <span className="inline-flex items-center gap-2">
              <BedIcon className="size-5 text-brand-600" /> {h.beds} beds
            </span>
            <span className="inline-flex items-center gap-2">
              <BathIcon className="size-5 text-brand-600" /> {h.baths} baths
            </span>
            {h.sqftHeated && (
              <span className="inline-flex items-center gap-2">
                <RulerIcon className="size-5 text-brand-600" /> {h.sqftHeated.toLocaleString()} sqft
              </span>
            )}
            {h.lotAcres && (
              <span className="inline-flex items-center gap-2">
                <LotIcon className="size-5 text-brand-600" /> {h.lotAcres} acres
              </span>
            )}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#want-this-house"
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              Want this same house? <ArrowIcon className="size-4" />
            </a>
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full border border-stone-line px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
          </div>

          <dl className="mt-8 divide-y divide-stone-line rounded-card border border-stone-line bg-stone-surface px-5">
            {specs.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-4 py-2.5 text-sm">
                <dt className="text-stone-muted">{s.label}</dt>
                <dd className="text-right font-medium text-stone-ink">
                  {s.href ? (
                    <Link href={s.href} className="text-brand-700 underline-offset-2 hover:underline">
                      {s.value}
                    </Link>
                  ) : (
                    s.value
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-muted">
            {["Land + home, one closing", "New, warrantied home", "We deliver, set & connect"].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-brand-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Matched model: floor plan + tour */}
      {model && (
        <section className="container-x py-8">
          <div className="rounded-card border border-stone-line bg-stone-surface p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
              {fp ? "The floor plan" : "The model"}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
              This home is the {model.name}
              {model.brand ? ` by ${model.brand}` : ""}
            </h2>
            <p className="mt-2 max-w-2xl text-stone-muted">
              {`${fp ? "Love this layout?" : "Love this home?"} It's the ${model.name}${model.sqft ? ` — about ${model.sqft.toLocaleString()} sq ft` : ""}. ${fp ? `Here's the floor plan${model.tourUrl ? ", and you can walk the whole thing in 3D" : ""}.` : `See the full model${model.tourUrl ? ", including a 3D walkthrough" : ""}.`}`}
            </p>

            {(fp || heroImg) && (
              <div className={`mt-5 grid gap-5${fp && heroImg ? " sm:grid-cols-2" : ""}`}>
                {fp && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fp.url}
                    alt={`${model.name} floor plan`}
                    loading="lazy"
                    className="w-full rounded-lg border border-stone-line bg-white object-contain"
                  />
                )}
                {heroImg && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroImg}
                    alt={`The ${model.name} model`}
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-lg object-cover"
                  />
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href={`/homes/${model.slug}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
              >
                See the {model.name} <ArrowIcon className="size-4" />
              </Link>
              {model.tourUrl && (
                <Link
                  href={`/homes/${model.slug}#tour`}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-line px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
                >
                  3D virtual tour
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Discontinued / uncatalogued model — keep a clickable next step so the
          model is never a dead end (Joe: "some models aren't clickable"). */}
      {!model && h.modelName && (
        <section className="container-x py-8">
          <div className="rounded-card border border-stone-line bg-stone-surface p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">The model</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
              This home is the {h.modelName}
            </h2>
            <p className="mt-2 max-w-2xl text-stone-muted">
              The {h.modelName}{" "}isn&apos;t in our current lineup, but we place homes just like it
              all the time. Browse what&apos;s available now — or tell us what you&apos;re after and
              we&apos;ll track one down.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/homes"
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
              >
                Browse current homes <ArrowIcon className="size-4" />
              </Link>
              <Link
                href="#want-this-house"
                className="inline-flex items-center gap-2 rounded-full border border-stone-line px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
              >
                Ask about this home
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Want this same house? — lead capture */}
      <section className="container-x py-10" id="want-this-house">
        <div className="grid gap-8 rounded-card border border-brand-200 bg-brand-50/60 p-6 sm:p-10 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold text-stone-ink">Want this same house?</h2>
            <p className="mt-3 text-stone-muted">
              We can place {model ? `the ${model.name}` : "a home like this"} on your land — or on a
              ¼-acre lot we provide. Tell us a little and we&apos;ll get you a real price.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-stone-ink">
              {[
                "Land + home in one package, one closing",
                "Brand-new, warrantied home",
                "We handle delivery, setup & utilities",
              ].map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <CheckIcon className="size-4 text-brand-600" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-stone-line bg-stone-bg p-5 sm:p-6">
            <WantThisHouseForm address={h.address} model={model?.name ?? h.modelName ?? undefined} />
          </div>
        </div>
      </section>

      {/* More placed homes nearby */}
      {related.length > 0 && (
        <section className="container-x py-12">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            More homes we&apos;ve placed in {h.town}
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug} className="overflow-hidden rounded-card border border-stone-line bg-stone-surface">
                <Link href={`/recently-placed/${r.slug}`} className="group block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(r.photo)}
                    alt={`A Home Placer home placed at ${r.address}, ${r.town}, SC`}
                    loading="lazy"
                    width={800}
                    height={600}
                    className="aspect-[4/3] w-full bg-stone-bg object-cover transition group-hover:opacity-95"
                  />
                  <div className="p-4">
                    <p className="font-semibold text-stone-ink">{r.address}</p>
                    <p className="mt-1 text-sm text-stone-muted">
                      {r.beds} bd · {r.baths} ba · {r.style}
                    </p>
                    <p className="mt-2 font-display text-lg font-semibold text-brand-700">{formatPrice(r.price)}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
