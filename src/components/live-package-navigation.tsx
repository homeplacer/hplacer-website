import Link from "next/link";
import { packageSlug, type LivePackageListing } from "@/lib/forturro-package-feed";

// This is navigation over the existing, already-eligible live snapshot, not a
// second inventory source. Keep the first record for each URL, matching the
// existing detail lookup, and do not mutate the feed or its presentation order.
export function packageNeighbors(
  listings: readonly LivePackageListing[],
  currentSlug: string,
): LivePackageListing[] {
  const unique = new Map<string, LivePackageListing>();
  for (const listing of listings) {
    if (
      typeof listing?.listingKey !== "string" || !listing.listingKey.trim()
      || typeof listing.address !== "string" || !listing.address.trim()
      || typeof listing.city !== "string" || !listing.city.trim()
      || !Number.isFinite(listing.listPrice) || listing.listPrice <= 0
    ) continue;
    const slug = packageSlug(listing);
    if (!unique.has(slug)) unique.set(slug, listing);
  }
  const ordered = [...unique.entries()].sort(([a], [b]) => a.localeCompare(b, "en", { numeric: true }));
  const index = ordered.findIndex(([slug]) => slug === currentSlug);
  if (index < 0 || ordered.length < 2) return [];
  const current = ordered[index][1];
  const selected = new Set([currentSlug]);
  const listingKeys = new Set([current.listingKey]);
  const neighbors: LivePackageListing[] = [];
  // Adjacent entries, with wraparound, give every distinct active package a
  // useful path from another detail instead of always promoting the first two.
  for (const direction of [1, -1]) {
    for (let offset = 1; offset < ordered.length; offset++) {
      const [slug, listing] = ordered[(index + direction * offset + ordered.length) % ordered.length];
      if (selected.has(slug) || listingKeys.has(listing.listingKey)) continue;
      selected.add(slug);
      listingKeys.add(listing.listingKey);
      neighbors.push(listing);
      break;
    }
  }
  return neighbors;
}

export function LivePackageNavigation({
  listings,
  currentSlug,
}: {
  listings: readonly LivePackageListing[];
  currentSlug: string;
}) {
  const neighbors = packageNeighbors(listings, currentSlug);
  if (!neighbors.length) return null;
  return (
    <nav aria-label="Other current land-home packages" className="container-x py-10 sm:py-12">
      <h2 className="font-display text-2xl font-semibold text-stone-ink">Compare other current packages</h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-muted">Explore another active MLS package. Ask Home Placer to confirm its availability and included scope.</p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2">
        {neighbors.map((listing) => (
          <li key={packageSlug(listing)}>
            <Link
              href={`/land-packages/${packageSlug(listing)}`}
              className="block h-full rounded-card border border-stone-line bg-stone-bg p-5 transition hover:border-brand-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700"
            >
              <h3 className="font-display text-xl font-semibold text-stone-ink">{listing.address}</h3>
              <p className="mt-1 text-sm text-stone-muted">{listing.city}, SC</p>
              <p className="mt-3 font-semibold text-brand-800">
                {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(listing.listPrice)}
                <span className="ml-2 text-xs font-normal text-stone-muted">Current MLS list price</span>
              </p>
              <span className="mt-4 inline-block text-sm font-semibold text-brand-700">View package <span aria-hidden="true">→</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
