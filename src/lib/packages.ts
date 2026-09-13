import data from "../../data/land-home-packages.json";
import models from "../../data/models.json";
import {
  packageErrors,
  packageIsPublic,
  type PackageRecord,
} from "./package-policy";
export { packageState, packageOffer } from "./package-policy";
export type { PackageRecord } from "./package-policy";
const records = data.packages as PackageRecord[];
const slugs = new Set(models.map((m) => m.slug));
export function getPackages(now = Date.now()) {
  return records.filter(
    (p) => packageErrors(p, slugs, now).length === 0 && packageIsPublic(p, now),
  );
}
export function getPackage(id: string, now = Date.now()) {
  return getPackages(now).find((p) => p.id === id);
}
// Explicit projection: never send source records, staff names, or permission evidence to a client.
export function packageLeadContext(id: unknown) {
  if (typeof id !== "string") return {};
  const p = getPackage(id);
  return p
    ? {
        packageId: p.id,
        modelSlug: p.modelSlug,
        market: p.market,
        packageStatus: p.status,
      }
    : {};
}
