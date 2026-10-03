import { site } from "@/lib/site";
import { getAllHomes, bestSellerHomes } from "@/lib/homes";
import { getAllPosts } from "@/lib/blog";
import { locations, counties } from "@/lib/locations";

export const dynamic = "force-static";

// A markdown manifest for LLM tools and AI crawlers — a concise, structured
// summary of who Home Placer is and what's on the site.
export function GET() {
  const homes = getAllHomes();
  const byBrand = homes.reduce<Record<string, number>>((a, h) => {
    a[h.brand] = (a[h.brand] || 0) + 1;
    return a;
  }, {});

  const body = `# ${site.legalName}

> ${site.blurb}

- Website: [Home Placer](${site.url})
- Phone: ${site.phoneDisplay}
- Email: ${site.email}
- Location: ${site.address.street}, ${site.address.city}, ${site.address.state} ${site.address.zip}
- Google Business Profile: [View the current profile and reviews](${site.gbp.url})
- Counties served: Horry County, SC; Georgetown County, SC; Brunswick County, NC; Columbus County, NC
- Towns served: ${locations.map((l) => `${l.name}, ${counties[l.countyKey]?.stateAbbr ?? "SC"}`).join("; ")}
- Pricing: see [current land-home listings](${site.url}/land-packages) for each property's price and availability, and [home models](${site.url}/homes) for estimated package and home-only prices. Model package estimates assume a quarter-acre lot; lot size, location, site work, utility costs, options, and the written project scope can change the total. Call, text, or email for the specific home and lot.
- Warranty: Home Placer provides a one-year builder warranty for defects. The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage and ten years of structural coverage through the 2–10 company. Coverage, exclusions, and claim procedures follow your written warranties.

## What we do
Home Placer is a licensed South Carolina manufactured-home dealer based in Horry County, serving the Grand Strand and nearby southeastern NC — Horry and Georgetown counties in South Carolina, and Brunswick and Columbus counties in North Carolina. We help buyers compare new manufactured homes and land, with one local team coordinating the agreed package. Included work, allowances, exclusions, permit responsibilities, and closing arrangements are confirmed in the written project scope. HOA status, deed restrictions, placement rules, and suitability must be checked for the actual parcel.

## Manufacturers we sell
The current model catalog includes ${Object.keys(byBrand).join(", ")} brand homes. Use each model page for its floor plan, recorded dimensions, available options, and estimate; confirm the selected configuration with our team.

## Buying and installing a home in Horry County, SC
- **Project scope:** review the selected home, lot, delivery, foundation, site work, utility connections, costs, and closing arrangements in writing before committing. A model estimate is not a parcel-specific quote or an offer for an existing listing.
- **Wind standard:** Horry and Georgetown counties in SC and Brunswick and Columbus counties in NC are all in **HUD Wind Zone II** under [24 CFR 3280.305](https://www.ecfr.gov/current/title-24/subtitle-B/chapter-XX/part-3280/subpart-D/section-3280.305). Confirm the selected home's data-plate ratings and the site's foundation and installation requirements. A wind-zone designation is not a storm-safety guarantee.
- **Utilities:** providers, connection availability, and any well or septic requirements depend on the parcel. Verify service and costs with the responsible providers and local offices; the written scope confirms the included work.
- **Permitting:** check placement, setup, and utility requirements with Horry County or the responsible city office for the actual parcel. Confirm the required approvals, documents, and each party's responsibilities.
- **Financing:** ask about FHA, VA, USDA, and conventional options. Availability depends on the borrower, address, home, title, foundation, lender, and program requirements. USDA requires a specific address and application review by a participating lender; a rural town name is not loan approval or a no-down-payment guarantee. See the [USDA Guaranteed Loan Program](https://www.rd.usda.gov/programs-services/single-family-housing-programs/single-family-housing-guaranteed-loan-program).
- **Timing:** ask for a project-specific schedule after the home, parcel readiness, permits, utilities, lender, and written scope have been reviewed; dates can change.

## Featured models
${bestSellerHomes()
  .slice(0, 8)
  .map(
    (h) =>
      `- [**${h.name}** (${h.brand})](${site.url}/homes/${h.slug}) — ${h.beds} bed / ${h.baths} bath, ${h.sqft.toLocaleString()} sq ft (${h.widthFt}×${h.lengthFt})`,
  )
  .join("\n")}

## Inventory (${homes.length} models)
${Object.entries(byBrand)
  .map(([b, n]) => `- ${b}: ${n} models`)
  .join("\n")}
Browse: [all current home models](${site.url}/homes)

## Key pages
- [Package records](${site.url}/packages) — Status-labeled package records; sold examples are historical, not current offers.
- [Land-readiness planning checklists](${site.url}/guides)
- [Project experience by town](${site.url}/stories)
- [Official county and buyer resources](${site.url}/buyer-resources)
- [Land-search handoff](${site.url}/find-land)
- [Warranty](${site.url}/warranty)
- [Homes](${site.url}/homes)
- [Brands](${site.url}/brands)
- [Land packages](${site.url}/land-packages)
- [Financing](${site.url}/financing)
- [How it works](${site.url}/process)
- [FAQ](${site.url}/faq)
- [Locations](${site.url}/locations)
- [Blog](${site.url}/blog)
- [Contact](${site.url}/contact)

## Recent articles
${getAllPosts()
  .slice(0, 6)
  .map((p) => `- [${p.title}](${site.url}/blog/${p.slug})`)
  .join("\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
