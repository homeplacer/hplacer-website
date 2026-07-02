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
import {
  availableWidths,
  hasXlBedrooms,
  isMultiWidth,
  isFullDrywall,
  isDrywallOptional,
  sqftForWidth,
  widthLabel,
} from "@/lib/home-types";
import { HomeCard } from "@/components/home-card";
import { HomeGallery } from "@/components/home-gallery";
import { WantThisHouseForm } from "@/components/want-this-house-form";
import { WidthSelector } from "@/components/width-selector";
import { WidthProvider } from "@/components/width-context";
import { FloorPlanSection } from "@/components/floor-plan-section";
import { JsonLd, homeProductLd, breadcrumbLd } from "@/lib/jsonld";
import {
  BedIcon,
  BathIcon,
  RulerIcon,
  PhoneIcon,
  CheckIcon,
  ArrowIcon,
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
  const widths = availableWidths(home);
  const multiWidth = isMultiWidth(home);
  const xl = hasXlBedrooms(home);

  const sqftSpec = multiWidth
    ? widths.map((w) => `${sqftForWidth(home, w).toLocaleString()} (${w}′ × ${home.lengthFt}′)`).join("  ·  ")
    : `${home.sqft.toLocaleString()} (${home.widthFt}′ × ${home.lengthFt}′)`;
  const sqftChip = multiWidth
    ? `${sqftForWidth(home, widths[0]).toLocaleString()}–${sqftForWidth(home, widths[widths.length - 1]).toLocaleString()}`
    : home.sqft.toLocaleString();

  // Only surface a wall-finish row when it's a selling point — full drywall, or
  // full-drywall-available. Plain wall-strips homes don't advertise it (Joe's call).
  const wallFinishValue = isFullDrywall(home)
    ? "Full drywall"
    : isDrywallOptional(home)
      ? "Full drywall available"
      : null;

  const specs = [
    { label: "Bedrooms", value: `${home.beds}` },
    { label: "Bathrooms", value: `${home.baths}` },
    { label: "Width", value: widthLabel(home) },
    { label: "Square feet", value: sqftSpec },
    ...(wallFinishValue ? [{ label: "Wall finish", value: wallFinishValue }] : []),
    { label: "Brand", value: home.brand },
    { label: "Series", value: home.series },
    { label: "Model", value: home.modelCode || home.name },
  ];

  const related = getHomesByBrand(home.brand)
    .filter((h) => h.slug !== home.slug)
    .slice(0, 3);

  return (
    <WidthProvider widths={widths} lengthFt={home.lengthFt}>
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
        <HomeGallery images={home.imageUrls} name={home.name} brand={home.brand} />

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
            Most buyers get the <strong className="font-semibold text-stone-ink">complete package</strong> —
            this home on a <strong className="font-semibold text-stone-ink">¼-acre lot</strong>, delivered,
            set, and connected to utilities. Already have your own land?{" "}
            <strong className="font-semibold text-stone-ink">Ask about home-only pricing.</strong>
          </p>

          <div className="mt-6 flex flex-wrap gap-5 text-base text-stone-ink">
            <span className="inline-flex items-center gap-2">
              <BedIcon className="size-5 text-brand-600" /> {home.beds} beds
            </span>
            <span className="inline-flex items-center gap-2">
              <BathIcon className="size-5 text-brand-600" /> {home.baths} baths
            </span>
            {!multiWidth && (
              <>
                <span className="inline-flex items-center gap-2">
                  <RulerIcon className="size-5 text-brand-600" /> {sqftChip} sqft
                </span>
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="size-5 text-brand-600"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12h18M3 12l4-4M3 12l4 4M21 12l-4-4M21 12l-4 4" />
                  </svg>
                  {widthLabel(home)}
                </span>
              </>
            )}
          </div>

          {multiWidth ? (
            <WidthSelector />
          ) : (
            xl && (
              <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
                <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-amber-500 text-[11px] font-bold text-amber-950">
                  XL
                </span>
                <p className="text-sm leading-relaxed text-amber-900">
                  <strong className="font-semibold">Extra-large bedrooms.</strong> Built a full 32′
                  wide, so the bedrooms are noticeably larger than a standard 28′ double-wide.
                </p>
              </div>
            )
          )}

          {isFullDrywall(home) && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
              <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-brand-700 text-white">
                <CheckIcon className="size-3.5" />
              </span>
              <p className="text-sm leading-relaxed text-brand-900">
                <strong className="font-semibold">Full drywall.</strong> Taped, mudded, and textured
                just like a site-built house — no visible seam strips.{" "}
                <Link
                  href="/manufactured-home-drywall-vs-wall-strips"
                  className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                >
                  Why that matters →
                </Link>
              </p>
            </div>
          )}

          {isDrywallOptional(home) && (
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-stone-line bg-stone-surface px-4 py-3">
              <span className="mt-px grid size-6 shrink-0 place-items-center rounded-full bg-stone-sunken text-brand-700">
                <CheckIcon className="size-3.5" />
              </span>
              <p className="text-sm leading-relaxed text-stone-ink/85">
                <strong className="font-semibold text-stone-ink">Full drywall available.</strong> This
                model ships with wall strips, but true taped-and-textured{" "}
                <Link
                  href="/manufactured-home-drywall-vs-wall-strips"
                  className="font-semibold text-brand-700 underline-offset-2 hover:underline"
                >
                  full drywall
                </Link>{" "}
                is an available upgrade — just ask.
              </p>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {price != null ? (
              <Link
                href={`/contact?home=${encodeURIComponent(home.name)}`}
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
              >
                Request this home <ArrowIcon className="size-4" />
              </Link>
            ) : (
              <Link
                href="#get-price"
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
              >
                Get this home&rsquo;s price <ArrowIcon className="size-4" />
              </Link>
            )}
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

      {/* Get this home's price — the lead-capture moment when pricing isn't posted */}
      {price == null && (
        <section id="get-price" className="container-x scroll-mt-24 py-8">
          <div className="grid gap-8 rounded-card border border-stone-line bg-stone-surface p-6 sm:p-8 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">No guessing</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-stone-ink sm:text-3xl">
                Get {home.name}&rsquo;s price
              </h2>
              <p className="mt-3 leading-relaxed text-stone-muted">
                Tell us a little and we&apos;ll send your all-in package price — {home.name} on a
                ¼-acre lot, delivered, set, and connected to utilities — plus an estimated monthly
                payment. Already have land? We&apos;ll price it home-only.
              </p>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-muted">
                {["Real numbers, not a range", "No pressure", "Financing help (FHA / VA / USDA)"].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <CheckIcon className="size-4 text-brand-600" /> {t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-stone-muted">
                Prefer to talk?{" "}
                <a href={`tel:${site.phoneDial}`} className="font-semibold text-brand-700 hover:text-brand-900">
                  Call or text {site.phoneDisplay}
                </a>
              </p>
            </div>
            <div className="rounded-2xl bg-stone-bg p-6 ring-1 ring-stone-line sm:p-8">
              <WantThisHouseForm model={home.name} />
            </div>
          </div>
        </section>
      )}

      {/* Available now — tour CTA + link to the live MLS collab (compliant link, not republished data) */}
      <section className="container-x py-4">
        <div className="flex flex-col gap-5 rounded-card border border-stone-line bg-stone-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Available now</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
              We keep homes ready to tour
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-muted">
              Brand-new and just-completed homes are on the ground across Horry, Georgetown, Brunswick,
              and Columbus counties. Call and we&apos;ll show you what&apos;s available right now.
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-wrap gap-3">
            <a
              href={`tel:${site.phoneDial}`}
              className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800"
            >
              <PhoneIcon className="size-4" /> {site.phoneDisplay}
            </a>
            <Link
              href="/recently-placed"
              className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              See our recent homes <ArrowIcon className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Floor plan — its own section, with a 28'/32' toggle that syncs with the summary */}
      {home.floorPlans && home.floorPlans.length > 0 && (
        <FloorPlanSection floorPlans={home.floorPlans} name={home.name} />
      )}

      {/* 3D virtual tour */}
      {home.tourUrl && (
        <section className="container-x py-10" id="tour">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">3D virtual tour</h2>
          <p className="mt-1 text-sm text-stone-muted">
            Walk through {home.name} from anywhere — drag to look around, or step room to room.
          </p>
          <div className="mt-5 aspect-video overflow-hidden rounded-card border border-stone-line bg-stone-sunken">
            <iframe
              src={home.tourUrl}
              title={`${home.name} 3D virtual tour`}
              allow="fullscreen; xr-spatial-tracking; gyroscope; accelerometer"
              allowFullScreen
              loading="lazy"
              className="size-full"
            />
          </div>
        </section>
      )}

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
    </WidthProvider>
  );
}
