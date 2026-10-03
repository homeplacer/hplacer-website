import type { Home } from "./home-types";
import type { PackageRecord } from "./package-policy";

type ModelSummary = Pick<Home, "name" | "beds" | "baths" | "sqft">;

// Use only published model, town and lot fields; source IDs and private
// addresses must not become search snippets or page copy.
export function packagePresentation(
  record: PackageRecord,
  model?: ModelSummary,
) {
  const modelName = model?.name ?? record.title;
  const lot = record.lotAcres?.toLocaleString("en-US", {
    maximumFractionDigits: 4,
  });
  const location = `${record.market}${lot ? ` on a ${lot}-acre recorded lot` : ""}`;
  const specs = model
    ? `${model.beds} bedrooms, ${model.baths} bathrooms and ${model.sqft.toLocaleString("en-US")} square feet`
    : null;

  if (record.status === "sold") {
    return {
      title: `${modelName} · ${record.market} · Sold${lot ? ` · ${lot} ac` : ""}`,
      description: `${modelName} sold land-home example in ${location}. Ask about a similar package; this historical property is not available.`,
      summary: `${modelName} is recorded as a sold home-and-land project in ${location}.${specs ? ` The catalog floor plan has ${specs}.` : ""} Explore the model and ask about a similar project with current land, scope and pricing.`,
    };
  }

  return {
    title: `${record.title} — ${record.status.replaceAll("_", " ")}`,
    description: `${modelName} home-and-land record in ${location}. ${record.priceDisclosure}`,
    summary: null,
  };
}
