// Client-safe, source-specific exceptions for confirmed unavailable tours.
// Oct. 6, 2026: both manufacturer's Matterport IDs return model-not-found (404).
// Keep the authentic URLs in data/models.json for traceability; withhold only
// these IDs in the customer-facing catalog. A verified replacement URL is not
// blocked. Remove an exception only after the exact original tour works again.
const unavailableMatterportTours = new Map<string, string>([
  ["dutch-elite-1676-01", "4YJzwgZWJMZ"],
  ["dutch-elite-1676-07", "Hdjs5Whevk7"],
]);

export function getAvailableModelTourUrl(
  slug: string,
  source: string | undefined,
): string | undefined {
  const unavailableId = unavailableMatterportTours.get(slug);
  if (!source || !unavailableId) return source;
  try {
    const url = new URL(source.replaceAll("&#038;", "&"));
    if (
      url.origin === "https://my.matterport.com" &&
      url.searchParams.getAll("m").includes(unavailableId)
    ) return undefined;
  } catch {
    // Availability exceptions do not replace the existing embed-origin policy.
    // Preserve unrecognized references for trustedVirtualTourUrl to validate.
  }
  return source;
}
