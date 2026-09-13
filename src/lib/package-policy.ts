export type PackageStatus =
  | "draft"
  | "available"
  | "under_contract"
  | "sold"
  | "withdrawn";
export type PackageRecord = {
  id: string;
  title: string;
  status: PackageStatus;
  market: string;
  county: string;
  modelSlug: string;
  packagePrice: number | null;
  pricePolicy: "verified-total" | "not-published";
  priceDisclosure: string;
  lotAcres: number | null;
  included: string[];
  excludedOrVariable: string[];
  sourceRecord: string;
  sourceBasis: string;
  lastVerifiedAt: string;
  lastVerifiedBy: string;
  owner: string | null;
  publicAddressPolicy: "town-only";
  publicPhotos: string[];
  mediaPermission: string | null;
  publication: "historical-summary" | "approved" | "draft";
  history: { status: PackageStatus; at: string; reason: string }[];
};
export const FRESHNESS_MS = 7 * 24 * 60 * 60 * 1000;
export function packageErrors(
  p: PackageRecord,
  models: ReadonlySet<string>,
  now = Date.now(),
): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.id)) errors.push("invalid ID");
  if (
    !["draft", "available", "under_contract", "sold", "withdrawn"].includes(
      p.status,
    )
  )
    errors.push("invalid status");
  if (!models.has(p.modelSlug)) errors.push("unknown model");
  if (!["historical-summary", "approved", "draft"].includes(p.publication))
    errors.push("invalid publication state");
  if (
    p.lotAcres !== null &&
    !(
      typeof p.lotAcres === "number" &&
      Number.isFinite(p.lotAcres) &&
      p.lotAcres > 0
    )
  )
    errors.push("invalid lot size");
  if (
    !p.title ||
    !p.market ||
    !p.county ||
    !p.sourceRecord ||
    !p.sourceBasis ||
    !p.lastVerifiedBy
  )
    errors.push("missing source context");
  const verified = Date.parse(p.lastVerifiedAt);
  if (!Number.isFinite(verified) || verified > now)
    errors.push("invalid verification date");
  if (p.publicAddressPolicy !== "town-only")
    errors.push("unsupported address policy");
  if (
    !p.priceDisclosure ||
    !["verified-total", "not-published"].includes(p.pricePolicy)
  )
    errors.push("missing price policy");
  if (
    p.pricePolicy === "verified-total" &&
    !(
      typeof p.packagePrice === "number" &&
      Number.isFinite(p.packagePrice) &&
      p.packagePrice > 0
    )
  )
    errors.push("invalid verified price");
  if (p.pricePolicy === "not-published" && p.packagePrice !== null)
    errors.push("unapproved price");
  if (p.publicPhotos.length && !p.mediaPermission)
    errors.push("missing media permission");
  if (
    p.publicPhotos.some(
      (x) => !/^\/packages\/[a-zA-Z0-9/_-]+\.(webp|jpg|png)$/.test(x),
    )
  )
    errors.push("invalid photo path");
  if (!p.included.length || !p.excludedOrVariable.length)
    errors.push("missing scope disclosure");
  if (
    !p.history.length ||
    p.history.at(-1)?.status !== p.status ||
    p.history.some(
      (h) =>
        !h.reason ||
        !Number.isFinite(Date.parse(h.at)) ||
        Date.parse(h.at) > now,
    )
  )
    errors.push("invalid status history");
  if (
    ["available", "under_contract"].includes(p.status) &&
    (!p.owner || p.publication !== "approved")
  )
    errors.push("active package needs staff approval");
  if (
    p.publication === "historical-summary" &&
    (p.status !== "sold" ||
      p.pricePolicy !== "not-published" ||
      p.publicPhotos.length)
  )
    errors.push("historical summary exceeds publication scope");
  return errors;
}
export function packageState(
  p: PackageRecord,
  now = Date.now(),
): PackageStatus | "needs_verification" {
  if (
    ["available", "under_contract"].includes(p.status) &&
    (now - Date.parse(p.lastVerifiedAt) >= FRESHNESS_MS ||
      Date.parse(p.lastVerifiedAt) > now)
  )
    return "needs_verification";
  return p.status;
}
export function packageIsPublic(p: PackageRecord, now = Date.now()): boolean {
  return (
    p.publication !== "draft" &&
    ["available", "under_contract", "sold"].includes(packageState(p, now))
  );
}
export function packageOffer(p: PackageRecord, now = Date.now()) {
  if (
    packageState(p, now) !== "available" ||
    p.publication !== "approved" ||
    !p.owner ||
    p.pricePolicy !== "verified-total" ||
    !p.packagePrice
  )
    return null;
  return {
    "@type": "Offer",
    price: p.packagePrice,
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
    url: `https://hplacer.com/packages/${p.id}`,
    priceValidUntil: new Date(Date.parse(p.lastVerifiedAt) + FRESHNESS_MS)
      .toISOString()
      .slice(0, 10),
    seller: { "@id": "https://hplacer.com/#business" },
  };
}
