import registry from "../../data/mls-listings-active.json";

type RegistryItem = {
  address: string;
  city: string;
};

type ForturroSearchItem = {
  listingKey: string;
  address: string;
  city: string;
  listPrice: number;
  beds: number;
  baths: number;
  sqft?: number;
  photo?: string;
};

export type LivePackageListing = ForturroSearchItem & {
  photoUrl?: string;
};

/** A stable, human-readable route key derived from the MLS address. */
export function packageSlug(listing: Pick<LivePackageListing, "address" | "city">) {
  return `${listing.address}-${listing.city}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function getLivePackageBySlug(slug: string) {
  const listings = await getLivePackageListings();
  return listings.find((listing) => packageSlug(listing) === slug) ?? null;
}

const FORTURRO_SEARCH = "https://forturro.com/api/db/search";
const FORTURRO_HOME_PLACER_ACTIVE = "https://forturro.com/api/hplacer/active";

function normalizeAddress(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isExactMatch(item: ForturroSearchItem, expected: RegistryItem) {
  return (
    normalizeAddress(item.address) === normalizeAddress(expected.address) &&
    item.city.trim().toLowerCase() === expected.city.trim().toLowerCase()
  );
}

async function fetchRegisteredListing(expected: RegistryItem) {
  const url = new URL(FORTURRO_SEARCH);
  url.searchParams.set("q", expected.address.replaceAll(".", ""));
  url.searchParams.set("pageSize", "20");

  try {
    const response = await fetch(url, { next: { revalidate: 300 } });
    if (!response.ok) return null;
    const body = (await response.json()) as { items?: ForturroSearchItem[] };
    const match = body.items?.find((item) => isExactMatch(item, expected));
    if (!match) return null;
    const result: LivePackageListing = { ...match };
    if (match.photo) result.photoUrl = `https://forturro.com${match.photo}`;
    return result;
  } catch {
    // The package page stays useful even if Forturro is temporarily unavailable.
    return null;
  }
}

/**
 * Read-only feed for the addresses Home Placer has explicitly registered as
 * its MLS packages. We never use a broad manufactured-home search, which would
 * surface other dealers' listings. Forturro is the live status and price source.
 */
export async function getLivePackageListings(): Promise<LivePackageListing[]> {
  // Forturro's Home Placer feed filters from verified builder attribution and
  // current MLS status. This is the primary path: it prevents new packages such
  // as 104 Pepe Court from being invisible just because an older address list
  // was not updated. It is Home Placer-only and never sends buyers to Forturro.
  try {
    const response = await fetch(FORTURRO_HOME_PLACER_ACTIVE, { next: { revalidate: 300 } });
    if (response.ok) {
      const body = (await response.json()) as { items?: ForturroSearchItem[] };
      const items = body.items?.filter((item) => item.listingKey && item.address && item.city && item.listPrice) ?? [];
      if (items.length > 0) {
        return items.map((item) => ({
          ...item,
          photoUrl: item.photo ? `https://forturro.com${item.photo}` : undefined,
        }));
      }
    }
  } catch {
    // Keep the legacy verified-address fallback below for a temporary upstream
    // outage. It is never used to remove a live package from the page.
  }

  // Temporary resilience fallback while the MLS source is unavailable. The
  // active endpoint above is the source of truth for all current packages.
  const registered = registry.listings as RegistryItem[];
  const results = await Promise.all(registered.map(fetchRegisteredListing));
  return results.filter((result): result is LivePackageListing => result !== null);
}
