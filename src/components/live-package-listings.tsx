import { HomeInquiryDialog } from "@/components/home-inquiry-dialog";
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
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
          )}
          <div className="p-5">
            <p className="text-sm font-semibold text-brand-700">Home + land package</p>
            <h3 className="mt-1 font-display text-2xl font-semibold text-stone-ink">
              {listing.address}
            </h3>
            <p className="mt-1 text-stone-muted">{listing.city}, SC</p>
            <p className="mt-5 font-display text-2xl font-semibold text-brand-800">
              {new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(listing.listPrice)}
            </p>
            <p className="mt-2 text-sm text-stone-muted">
              {listing.beds} bed · {listing.baths} bath
              {listing.sqft ? ` · ${listing.sqft.toLocaleString()} sqft` : ""}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <HomeInquiryDialog
                homeName={`${listing.address}, ${listing.city}`}
                label="Message"
                showArrow={false}
                className="inline-flex items-center justify-center rounded-lg border border-brand-200 bg-white px-3 py-2.5 text-sm font-semibold text-brand-800 transition hover:border-brand-400 hover:bg-brand-50"
              />
              <a
                href={listing.listingUrl}
                className="inline-flex items-center justify-center rounded-lg bg-brand-700 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
              >
                See home
              </a>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
