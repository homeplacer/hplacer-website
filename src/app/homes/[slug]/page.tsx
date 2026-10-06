import { getAllPlacedHomes } from "@/lib/placed-homes";
import { pageMetadata } from "@/lib/metadata";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAllHomes,
  getHome,
  getHomesByBrand,
  formatPrice,
  displayPrice,
  isRetiredHome,
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
import { ModelVirtualTour } from "@/components/model-virtual-tour";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
import { WantThisHouseForm } from "@/components/want-this-house-form";
import { WidthSelector } from "@/components/width-selector";
import { WidthProvider } from "@/components/width-context";
import { FloorPlanSection } from "@/components/floor-plan-section";
import { JsonLd, breadcrumbLd, modelWebPageLd } from "@/lib/jsonld";
import { trustedVirtualTourUrl } from "@/lib/media-policy";
import {
  BedIcon,
  BathIcon,
  RulerIcon,
  PhoneIcon,
  CheckIcon,
  ArrowIcon,
} from "@/components/icons";
import { site } from "@/lib/site";
import { ModelPackageJourney } from "@/components/model-package-journey";
import { HistoricalProjectCard } from "@/components/historical-project-card";
import { insetProjectImageSizes } from "@/lib/historical-project-images";

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
  return pageMetadata({
    title: `${home.name} · ${home.brand}`,
    description: `${home.name} by ${home.brand}: ${home.beds} bedrooms, ${home.baths} bathrooms and ${home.sqft.toLocaleString("en-US")} sq ft. Explore the floor plan and ask about a home on your land or a land-home package.`,
    alternates: { canonical: `/homes/${home.slug}` },
    ...(isRetiredHome(home.slug) ? { robots: { index: false, follow: true } } : {}),
    openGraph: home.imageUrls[0] ? { images: [home.imageUrls[0]] } : undefined,
  });
}

export default async function HomeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const home = getHome(slug);
  if (!home) notFound();

  if (isRetiredHome(home.slug)) {
    return (
      <section className="container-x py-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-stone-muted">
          Archived model
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold text-stone-ink">
          {home.name}
        </h1>
        <p className="mt-4 max-w-2xl text-stone-muted">
          This model is no longer in our current lineup. Browse our current
          floor plans or ask our team about a similar home.
        </p>
        <div className="my-6 flex flex-wrap gap-3">
          <Link href="/homes" className="inline-flex items-center rounded-full bg-brand-700 px-5 py-3 font-semibold text-white hover:bg-brand-800">Browse current homes</Link>
          <HomeInquiryDialog homeName={`a home similar to ${home.name}`} label="Ask about alternatives" />
        </div>
        <HomeGallery images={home.imageUrls} name={home.name} brand={home.brand} />
      </section>
    );
  }

  const price = displayPrice(home);
  const sold = getAllPlacedHomes().filter(
    (h) => h.modelSlug === home.slug && h.price > 0 && h.closeDate,
  );
  const soldPrices = sold.map((h) => h.price);
  const tourUrl = trustedVirtualTourUrl(home.tourUrl);
  const widths = availableWidths(home);
  const multiWidth = isMultiWidth(home);
  const xl = hasXlBedrooms(home);

  const sqftSpec = multiWidth
    ? widths
        .map(
          (w) =>
            `${sqftForWidth(home, w).toLocaleString()} (${w}′ × ${home.lengthFt}′)`,
        )
        .join("  ·  ")
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
    ...(wallFinishValue
      ? [{ label: "Wall finish", value: wallFinishValue }]
      : []),
    { label: "Brand", value: home.brand },
    { label: "Series", value: home.series },
    { label: "Model", value: home.modelCode || home.name },
  ];

  const related = getHomesByBrand(home.brand)
    .filter((h) => h.slug !== home.slug)
    .slice(0, 3);

  return (
    <WidthProvider widths={widths} lengthFt={home.lengthFt}>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Homes", path: "/homes" },
          { name: home.name, path: `/homes/${home.slug}` },
        ])}
      />
      <JsonLd data={modelWebPageLd(home)} />
      <div className="container-x pt-8 text-sm text-stone-muted">
        <Link href="/homes" className="hover:text-brand-700">
          ← All homes
        </Link>
      </div>

      <section className="container-x grid gap-10 py-8 lg:grid-cols-2 lg:items-start">
        {/* Gallery */}
        <HomeGallery
          images={home.imageUrls}
          name={home.name}
          brand={home.brand}
        />

        {/* Summary */}
        <div>
          <h1 className="font-display text-4xl font-semibold text-stone-ink">
            {home.name}
          </h1>
          <p className="mt-1 text-stone-muted">
            {home.brand} · {home.series}
          </p>

          {price != null ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-brand-100 bg-brand-50 p-4">
                <p className="text-sm font-semibold text-brand-900">
                  {home.setupPrice ? "Land + home estimate" : "Home-only estimate"}
                </p>
                <p className="mt-2 text-xs text-stone-muted">Starting at</p>
                <p className="font-display text-3xl font-semibold text-brand-800">
                  {formatPrice(price)}
                </p>
              </div>
              {home.setupPrice && home.price && (
                <div className="rounded-xl border border-stone-line p-4">
                  <p className="text-sm font-semibold text-stone-ink">Home-only estimate</p>
                  <p className="mt-2 text-xs text-stone-muted">Starting at</p>
                  <p className="font-display text-3xl font-semibold text-stone-ink">
                    {formatPrice(home.price)}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-5 font-display text-3xl font-semibold text-brand-700">
              Call for pricing
            </p>
          )}

          <p className="mt-3 text-sm text-stone-muted">
            Estimated packages include the home and full setup and assume a
            quarter-acre lot. Land, lot size, site work,
            permits, utility connections, options, and local requirements can
            change the final price. Call, text, or email us for a written
            estimate for your lot.
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
                  <RulerIcon className="size-5 text-brand-600" /> {sqftChip}{" "}
                  sqft
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
                  <strong className="font-semibold">
                    Extra-large bedrooms.
                  </strong>{" "}
                  Built a full 32′ wide, so the bedrooms are noticeably larger
                  than a standard 28′ double-wide.
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
                <strong className="font-semibold">Full drywall.</strong> Taped,
                mudded, and textured just like a site-built house — no visible
                seam strips.{" "}
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
                <strong className="font-semibold text-stone-ink">
                  Full drywall available.
                </strong>{" "}
                This model ships with wall strips, but true taped-and-textured{" "}
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
              <HomeInquiryDialog
                homeName={home.name}
                label="Request this home"
                className="inline-flex items-center gap-2 rounded-full bg-brand-700 px-6 py-3 text-base font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
              />
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
            {[
              "Confirm lot restrictions",
              "1-year warranty",
              "Land + setup available",
              "Written package quote",
            ].map((t) => (
              <li key={t} className="inline-flex items-center gap-1.5">
                <CheckIcon className="size-4 text-brand-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {sold.length > 0 && (
        <section className="container-x py-8">
          <div className="rounded-card border border-stone-line bg-stone-surface p-6">
            <h2 className="font-display text-2xl font-semibold">
              Past {home.name} projects
            </h2>
            <p className="mt-3 text-stone-muted">
              Our {sold.length} recorded completed{" "}
              {sold.length === 1 ? "sale" : "sales"} with this model sold for{" "}
              {formatPrice(Math.min(...soldPrices))}
              {Math.max(...soldPrices) !== Math.min(...soldPrices)
                ? `–${formatPrice(Math.max(...soldPrices))}`
                : ""}
              , including each specific home and property. These are historical
              sale prices, not current quotes. Land, site work, options, and
              market conditions differ.
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sold.slice(0, 3).map((h) => (
                <li key={h.slug}>
                  <HistoricalProjectCard home={h} sizes={insetProjectImageSizes} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Get this home's price — the lead-capture moment when pricing isn't posted */}
      {price == null && (
        <section id="get-price" className="container-x scroll-mt-24 py-8">
          <div className="grid gap-8 rounded-card border border-stone-line bg-stone-surface p-6 sm:p-8 lg:grid-cols-2 lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
                No guessing
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-stone-ink sm:text-3xl">
                Get {home.name}&rsquo;s price
              </h2>
              <p className="mt-3 leading-relaxed text-stone-muted">
                Tell us about the {home.name} and whether you have land.
                We&apos;ll help you get a written estimate that identifies the
                lot, setup, utility work, and selected options. Already own a
                lot? Ask about a home-only estimate for your project. Your
                lender confirms financing terms and estimated payments.
              </p>
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-stone-muted">
                {[
                  "Written model-and-lot estimate",
                  "No pressure",
                  "Lender options to discuss",
                ].map((t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <CheckIcon className="size-4 text-brand-600" /> {t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-stone-muted">
                Prefer to talk?{" "}
                <a
                  href={`tel:${site.phoneDial}`}
                  className="font-semibold text-brand-700 hover:text-brand-900"
                >
                  Call {site.phoneDisplay}
                </a>
              </p>
            </div>
            <div className="rounded-2xl bg-stone-bg p-6 ring-1 ring-stone-line sm:p-8">
              <WantThisHouseForm model={home.name} />
            </div>
          </div>
        </section>
      )}

      {/* Current packages — keep available properties separate from sold history. */}
      <section className="container-x py-4">
        <div className="flex flex-col gap-5 rounded-card border border-stone-line bg-stone-surface p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
              Current land-home packages
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
              See what&apos;s available to tour
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-muted">
              Browse current packages or ask our team which homes are available
              to visit. We&apos;ll confirm the listing&apos;s status and help you
              arrange the next step.
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
              href="/land-packages"
              className="inline-flex items-center gap-2 rounded-full border border-stone-line bg-stone-bg px-6 py-3 text-base font-semibold text-stone-ink transition hover:border-brand-300"
            >
              Browse current packages <ArrowIcon className="size-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Floor plan — its own section, with a 28'/32' toggle that syncs with the summary */}
      {home.floorPlans && home.floorPlans.length > 0 && (
        <FloorPlanSection floorPlans={home.floorPlans} name={home.name} />
      )}

      {/* 3D virtual tour */}
      {tourUrl && (
        <section className="container-x py-10" id="tour">
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            3D virtual tour
          </h2>
          <p className="mt-1 text-sm text-stone-muted">
            Walk through {home.name} from anywhere — drag to look around, or
            step room to room.
          </p>
          <ModelVirtualTour url={tourUrl} name={home.name} />
        </section>
      )}

      {/* Description + specs */}
      <section className="container-x grid gap-10 py-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="font-display text-2xl font-semibold text-stone-ink">
            About this home
          </h2>
          <div className="mt-4 space-y-4 leading-relaxed text-stone-ink/85">
            {home.description
              .split("\n")
              .filter(Boolean)
              .map((para, i) => (
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
            <h3 className="font-display text-lg font-semibold text-stone-ink">
              Specifications
            </h3>
            <dl className="mt-4 divide-y divide-stone-line">
              {specs.map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between gap-4 py-2.5 text-sm"
                >
                  <dt className="text-stone-muted">{s.label}</dt>
                  <dd className="text-right font-medium text-stone-ink">
                    {s.value}
                  </dd>
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
      <ModelPackageJourney homeName={home.name} modelSlug={home.slug} />
    </WidthProvider>
  );
}
