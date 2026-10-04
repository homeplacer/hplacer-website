import { unstable_cache } from "next/cache";
import type { PlacedHome } from "@/lib/placed-homes";

type ClosedFeedItem = {
  listingKey: string;
  mlsId: string;
  address: string;
  city: string;
  closePrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lat: number | null;
  lng: number | null;
  closedOn: string | null;
};

export type NewClosedHomePlacerSale = ClosedFeedItem;

function addressKey(address: string, city: string) {
  return `${address}|${city}`.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Closed sales are additive only. Existing local projects remain the permanent
 * record because an older MLS record can be absent from a future upstream sync.
 */
export async function getNewClosedHomePlacerSales(
  archived: readonly Pick<PlacedHome, "mls" | "address" | "town">[],
): Promise<NewClosedHomePlacerSale[]> {
  const items = await getClosedSnapshot();
  const knownMls = new Set(archived.map((home) => home.mls.trim()));
  const knownAddresses = new Set(
    archived.map((home) => addressKey(home.address, home.town)),
  );
  const additions: NewClosedHomePlacerSale[] = [];
  for (const home of items) {
    const mlsId = home.mlsId?.trim();
    const normalizedAddress = addressKey(home.address ?? "", home.city ?? "");
    if (!home.listingKey || !mlsId || !normalizedAddress || knownMls.has(mlsId) || knownAddresses.has(normalizedAddress)) continue;
    knownMls.add(mlsId);
    knownAddresses.add(normalizedAddress);
    additions.push(home);
  }
  return additions;
}

// Validate before caching so errors cannot overwrite the last good snapshot.
const getClosedSnapshot = unstable_cache(async (): Promise<ClosedFeedItem[]> => {
  const response = await fetch("https://forturro.com/api/hplacer/closed", {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Closed MLS feed failed (${response.status})`);
  const body = (await response.json()) as { items?: ClosedFeedItem[] };
  if (!Array.isArray(body?.items) || !body.items.every((item) =>
    item && [item.listingKey, item.mlsId, item.address, item.city].every(
      (value) => typeof value === "string" && value.trim().length > 0,
    )
  )) throw new Error("Closed MLS feed returned an invalid snapshot");
  return body.items;
}, ["home-placer-closed-validated-v1"], { revalidate: 900 });
