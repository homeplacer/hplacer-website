import { unstable_cache } from "next/cache";

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

/**
 * Only the builder-scoped active endpoint can establish current availability.
 * An empty snapshot is valid. Errors must escape so ISR retains the last good
 * page instead of publishing stale registry matches or an outage as no homes.
 */
export const getLivePackageListings = unstable_cache(async (): Promise<LivePackageListing[]> => {
  const response = await fetch("https://forturro.com/api/hplacer/active", {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Active MLS feed failed (${response.status})`);
  const body = await response.json();
  if (!Array.isArray(body?.items) || !body.items.every(isActiveListing)) {
    throw new Error("Active MLS feed returned an invalid snapshot");
  }
  return body.items.map((item: ForturroSearchItem) => ({
    ...item,
    photoUrl: item.photo ? `https://forturro.com${item.photo}` : undefined,
  }));
}, ["home-placer-active-validated-v1"], { revalidate: 300 });

function isActiveListing(item: unknown): item is ForturroSearchItem {
  if (!item || typeof item !== "object") return false;
  const row = item as Record<string, unknown>;
  return [row.listingKey, row.address, row.city].every(
    (value) => typeof value === "string" && value.trim().length > 0,
  ) && typeof row.listPrice === "number" && Number.isFinite(row.listPrice) && row.listPrice > 0;
}
