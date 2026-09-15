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
  try {
    const response = await fetch("https://forturro.com/api/hplacer/closed", {
      next: { revalidate: 900 },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { items?: ClosedFeedItem[] };
    const knownMls = new Set(archived.map((home) => home.mls.trim()));
    const knownAddresses = new Set(
      archived.map((home) => addressKey(home.address, home.town)),
    );
    const additions: NewClosedHomePlacerSale[] = [];
    for (const home of body.items ?? []) {
      const mlsId = home.mlsId?.trim();
      const normalizedAddress = addressKey(home.address ?? "", home.city ?? "");
      if (!home.listingKey || !mlsId || !normalizedAddress || knownMls.has(mlsId) || knownAddresses.has(normalizedAddress)) continue;
      knownMls.add(mlsId);
      knownAddresses.add(normalizedAddress);
      additions.push(home);
    }
    return additions;
  } catch {
    return [];
  }
}
