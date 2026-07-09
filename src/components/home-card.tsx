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
import { BedIcon, BathIcon, RulerIcon, HomeMark, CheckIcon, ArrowIcon } from "@/components/icons";
import { FallbackImage } from "@/components/fallback-image";

export function HomeCard({ home }: { home: Home }) {
  const price = displayPrice(home);
  const photo = home.imageUrls[0];
  const multiWidth = isMultiWidth(home);
  // Dual-width plans show both footprints ("28×68 or 32×68"); others show sqft.
  const sizeLabel = multiWidth ? footprintLabel(home) : `${home.sqft.toLocaleString()} sqft`;

  return (
    <Link
      href={`/homes/${home.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-stone-line bg-stone-bg shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-100 via-stone-surface to-accent-100">
        {photo ? (
          <FallbackImage
            src={photo}
            alt={`${home.name} by ${home.brand}`}
            loading="lazy"
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
        <span className="absolute left-3 top-3 rounded-full bg-stone-bg/90 px-2.5 py-1 text-xs font-semibold text-brand-800 shadow-sm">
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

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-stone-ink group-hover:text-brand-800">
              {home.name}
            </h3>
            <p className="truncate text-xs text-stone-muted">{home.series}</p>
          </div>
          {price != null && (
            <span className="shrink-0 text-right leading-none">
              <span className="block font-display text-lg font-semibold text-brand-700">
                {formatPrice(price)}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-muted">
                {home.setupPrice ? "full setup" : "starting"}
              </span>
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-4 border-t border-stone-line pt-3 text-sm text-stone-ink/80">
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

        {/* When there's no price yet, the card's job is to capture the lead — a
            clear CTA that carries to the detail page's "Get this home's price"
            form (whole card is the link). Priced cards let the price speak. */}
        {price == null && (
          <span className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition group-hover:border-brand-300 group-hover:bg-brand-100">
            Get this home&rsquo;s price <ArrowIcon className="size-4" />
          </span>
        )}
      </div>
    </Link>
  );
}
