import Link from "next/link";
import type { Home } from "@/lib/home-types";
import {
  formatPrice,
  displayPrice,
  hasXlBedrooms,
  isMultiWidth,
  isFullDrywall,
  footprintLabel,
} from "@/lib/home-types";
import {
  BedIcon,
  BathIcon,
  RulerIcon,
  HomeMark,
  CheckIcon,
  ArrowIcon,
  PhoneIcon,
} from "@/components/icons";
import { FallbackImage } from "@/components/fallback-image";
import { site } from "@/lib/site";
import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";

// Locally hosted catalog covers get a compact WebP srcset. The originals remain
// the fallback and source of record; these derivatives only avoid downloading a
// 1,200px JPEG into a roughly 350–450px card on a phone.
function cardImageSrcSet(src: string | undefined): string | undefined {
  if (!src || !/^\/models\/[^/]+\/01\.jpg$/.test(src)) return undefined;
  const stem = src.slice(0, -4);
  return `${stem}-480.webp 480w, ${stem}-640.webp 640w`;
}

export function HomeCard({ home }: { home: Home }) {
  const price = displayPrice(home);
  const photo = home.imageUrls[0];
  const multiWidth = isMultiWidth(home);
  // Dual-width plans show both footprints ("28×68 or 32×68"); others show sqft.
  const sizeLabel = multiWidth
    ? footprintLabel(home)
    : `${home.sqft.toLocaleString()} sqft`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-card border border-stone-line bg-stone-bg shadow-sm transition duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-xl hover:shadow-brand-900/10">
      <Link
        href={`/homes/${home.slug}`}
        aria-label={`View ${home.name} details and request pricing`}
        className="flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-100 via-stone-surface to-accent-100">
          {photo ? (
            <FallbackImage
              src={photo}
              alt={`${home.name} by ${home.brand}`}
              width={800}
              height={600}
              loading="lazy"
              decoding="async"
              srcSet={cardImageSrcSet(photo)}
              responsiveWidths={[320, 480, 640, 800]}
              sizes="(max-width: 639px) calc(100vw - 2.5rem), (max-width: 1023px) 50vw, 33vw"
              className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
              fallback={
                <div className="absolute inset-0 grid place-items-center text-brand-300/70">
                  <HomeMark className="size-14" strokeWidth={1.25} />
                </div>
              }
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-brand-300/70">
              <HomeMark className="size-14" strokeWidth={1.25} />
            </div>
          )}
          <span className="absolute left-3 top-3 rounded-full bg-stone-bg/95 px-2.5 py-1 text-xs font-semibold tracking-wide text-brand-800 shadow-sm backdrop-blur">
            {home.brand}
          </span>
          {home.bestSeller && (
            <span className="absolute right-3 top-3 rounded-full bg-accent-500 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
              ★ Best Seller
            </span>
          )}
          {hasXlBedrooms(home) && (
            <span className="absolute bottom-3 left-3 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-amber-950 shadow-sm">
              {multiWidth ? "Available with XL Rooms" : "32′ · XL Bedrooms"}
            </span>
          )}
          {isFullDrywall(home) && (
            <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-brand-700 px-2.5 py-1 text-xs font-bold text-white shadow-sm">
              <CheckIcon className="size-3" /> Full Drywall
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-xl font-semibold leading-tight text-stone-ink transition-colors group-hover:text-brand-800">
                {home.name}
              </h3>
              <p className="mt-1 truncate text-xs font-medium tracking-wide text-stone-muted">
                {home.series}
              </p>
            </div>
            {price != null && (
              <span className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-2 text-right leading-none">
                <span className="block font-display text-lg font-semibold text-brand-800">
                  {formatPrice(price)}
                </span>
                <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-stone-muted">
                  {home.setupPrice ? "full setup" : "starting"}
                </span>
              </span>
            )}
          </div>

          <div className="mt-5 flex items-center gap-x-4 gap-y-2 border-t border-stone-line pt-3.5 text-sm text-stone-ink/80">
            <span className="inline-flex items-center gap-1.5">
              <BedIcon className="size-4 text-brand-600" /> {home.beds} bd
            </span>
            <span className="inline-flex items-center gap-1.5">
              <BathIcon className="size-4 text-brand-600" /> {home.baths} ba
            </span>
            <span className="inline-flex items-center gap-1.5">
              <RulerIcon className="size-4 text-brand-600" /> {sizeLabel}
            </span>
          </div>

          <span className="mt-auto pt-5 text-sm font-semibold text-brand-700">
            {price == null ? "Get this home’s price" : "See details & request pricing"}
            <ArrowIcon className="ml-1 inline size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
      <div className="grid grid-cols-3 gap-2 border-t border-stone-line bg-stone-surface/70 p-3">
        <a
          href={`tel:${site.phoneDial}`}
          aria-label={`Call Home Placer about ${home.name}`}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-2.5 text-sm font-semibold text-brand-800 transition hover:border-brand-400 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          <PhoneIcon className="size-4" /> Call
        </a>
        <HomeInquiryDialog
          homeName={home.name}
          label="Message"
          showArrow={false}
          className="inline-flex items-center justify-center rounded-lg border border-brand-200 bg-white px-3 py-2.5 text-sm font-semibold text-brand-800 transition hover:border-brand-400 hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        />
        <Link
          href={`/homes/${home.slug}`}
          className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          See home
        </Link>
      </div>
    </article>
  );
}
