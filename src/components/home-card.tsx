import Link from "next/link";
import type { Home } from "@/lib/home-types";
import { formatPrice, displayPrice } from "@/lib/home-types";
import { BedIcon, BathIcon, RulerIcon, HomeMark } from "@/components/icons";

export function HomeCard({ home }: { home: Home }) {
  const price = displayPrice(home);
  const photo = home.imageUrls[0];

  return (
    <Link
      href={`/homes/${home.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-stone-line bg-stone-bg shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-brand-100 via-stone-surface to-accent-100">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={`${home.name} by ${home.brand}`}
            loading="lazy"
            className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
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
          <span className="absolute right-3 top-3 rounded-full bg-accent-400 px-2.5 py-1 text-xs font-bold text-brand-950 shadow-sm">
            ★ Best Seller
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
          <span className="shrink-0 text-right leading-none">
            {price != null ? (
              <>
                <span className="block font-display text-lg font-semibold text-brand-700">
                  {formatPrice(price)}
                </span>
                <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-muted">
                  {home.setupPrice ? "full setup" : "starting"}
                </span>
              </>
            ) : (
              <span className="block text-sm font-semibold text-brand-700">Call for pricing</span>
            )}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4 border-t border-stone-line pt-3 text-sm text-stone-ink/80">
          <span className="inline-flex items-center gap-1.5">
            <BedIcon className="size-4 text-brand-600" /> {home.beds} bd
          </span>
          <span className="inline-flex items-center gap-1.5">
            <BathIcon className="size-4 text-brand-600" /> {home.baths} ba
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RulerIcon className="size-4 text-brand-600" /> {home.sqft.toLocaleString()} sqft
          </span>
        </div>
      </div>
    </Link>
  );
}
