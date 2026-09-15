import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
import { BathIcon, BedIcon, RulerIcon } from "@/components/icons";
import type { LivePackageListing } from "@/lib/forturro-package-feed";

export function LivePackageListings({
  listings,
  limit,
}: {
  listings: LivePackageListing[];
  limit?: number;
}) {
  const rows = limit ? listings.slice(0, limit) : listings;
  if (!rows.length) {
    return (
      <p className="rounded-card border border-stone-line bg-stone-surface p-6 text-stone-muted">
        No registered packages are active in the MLS right now. Message us for
        upcoming options or a package on your land.
      </p>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {rows.map((listing) => (
        <article
          key={listing.listingKey}
          className="overflow-hidden rounded-card border border-stone-line bg-stone-bg shadow-sm"
        >
          {listing.photoUrl && (
            // Plain img preserves Forturro's MLS media proxy URL without duplicating its images.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={listing.photoUrl}
              alt={`${listing.address}, ${listing.city}`}
              className="aspect-[3/2] w-full object-cover"
              loading="lazy"
            />
          )}
          <div className="p-5">
            <p className="font-display text-2xl font-medium text-brand-900">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(listing.listPrice)}
            </p>
            <h3 className="mt-1.5 font-display text-lg text-stone-ink">{listing.address}</h3>
            <p className="text-sm text-stone-muted">{listing.city}, SC</p>
            <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-line pt-4 text-sm text-stone-ink">
              <span className="inline-flex items-center gap-1.5">
                <BedIcon className="size-4 text-accent-500" /> {listing.beds} bd
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BathIcon className="size-4 text-accent-500" /> {listing.baths} ba
              </span>
              {listing.sqft && (
                <span className="inline-flex items-center gap-1.5">
                  <RulerIcon className="size-4 text-accent-500" /> {listing.sqft.toLocaleString()} sqft
                </span>
              )}
            </p>
            <div className="mt-5">
              <HomeInquiryDialog
                homeName={`${listing.address}, ${listing.city}`}
                label="Ask about this home"
                showArrow={false}
                className="col-span-2 inline-flex items-center justify-center rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
              />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
