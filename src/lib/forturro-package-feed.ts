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

const FORTURRO_SEARCH = "https://forturro.com/api/db/search";

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
  const registered = registry.listings as RegistryItem[];
  const results = await Promise.all(registered.map(fetchRegisteredListing));
  return results.filter((result): result is LivePackageListing => result !== null);
}
