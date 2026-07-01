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

- Website: ${site.url}
- Phone: ${site.phoneDisplay}
- Email: ${site.email}
- Location: ${site.address.street}, ${site.address.city}, ${site.address.state} ${site.address.zip}
- Google Business Profile: ${site.gbp.rating.toFixed(1)}★ (${site.gbp.reviewCount} reviews) — ${site.gbp.url}
- Counties served: Horry County, SC; Georgetown County, SC; Brunswick County, NC; Columbus County, NC
- Towns served: ${locations.map((l) => `${l.name}, ${counties[l.countyKey]?.stateAbbr ?? "SC"}`).join("; ")}
- Pricing: land-home packages from the low $200s. No HOA. One-year warranty.

## What we do
Home Placer is a licensed manufactured-home + land dealer based in Horry County, SC, serving the Grand Strand and nearby southeastern NC — Horry and Georgetown counties in South Carolina, and Brunswick and Columbus counties in North Carolina. We pair brand-new homes from Clayton, Cavco, and Champion with land — one package, one price, one closing — and handle permits, delivery, foundation, and utility hookups. Financing: FHA, VA, USDA, and conventional. (Wind ratings vary by county: the coastal counties are HUD Wind Zone II; inland Columbus County, NC is Wind Zone I.)

## Manufacturers we sell
- **Clayton Homes** — the largest builder of manufactured/modular homes in the U.S. (Maryville, TN; a Berkshire Hathaway company). Series we carry include Oxford (Ultra Pro Flex / Ultra XL), Rockwell (Fairway / Tempo), Giles, and Appalachia.
- **Cavco** — Cavco Industries (Phoenix, AZ), known for light, modern floor plans; we carry Fleetwood- and Cavco-Douglas-built lines (Vivid, Atmos, The Summit, Pinnacle, Pegasus and more).
- **Champion Homes** — Skyline Champion Corporation; durable, well-equipped homes (Iron Clad and Dutch Elite, available with 9-ft ceilings).

## Buying and installing a home in Horry County, SC
- **One package, one closing:** the home + a quarter-acre lot + delivery + a permanent foundation + water/sewer/power hookups, handled by one team.
- **Wind standard:** Horry County is in **HUD Wind Zone II** (coastal South Carolina); our homes are built to that higher coastal wind rating.
- **Utilities:** power is typically provided by Horry Electric Cooperative or Santee Cooper depending on the parcel; water and sewer by Grand Strand Water & Sewer Authority, or a private well and septic system on rural lots.
- **Permitting:** placement, setup, and utility permits are pulled through Horry County; we manage the process end to end.
- **Financing:** FHA, VA, USDA (most of rural Horry County — Conway, Loris, Longs, Aynor — qualifies for USDA $0-down), and conventional land-home loans.
- **Timeline:** typically a few months from pick to keys, depending on land readiness and permitting.

## Featured models
${bestSellerHomes()
  .slice(0, 8)
  .map(
    (h) =>
      `- **${h.name}** (${h.brand}) — ${h.beds} bed / ${h.baths} bath, ${h.sqft.toLocaleString()} sq ft (${h.widthFt}×${h.lengthFt}): ${site.url}/homes/${h.slug}`,
  )
  .join("\n")}

## Inventory (${homes.length} models)
${Object.entries(byBrand)
  .map(([b, n]) => `- ${b}: ${n} models`)
  .join("\n")}
Browse: ${site.url}/homes

## Key pages
- Homes: ${site.url}/homes
- Brands: ${site.url}/brands
- Land packages: ${site.url}/land-packages
- Financing: ${site.url}/financing
- How it works: ${site.url}/process
- FAQ: ${site.url}/faq
- Locations: ${site.url}/locations
- Blog: ${site.url}/blog
- Contact: ${site.url}/contact

## Recent articles
${getAllPosts()
  .slice(0, 6)
  .map((p) => `- ${p.title}: ${site.url}/blog/${p.slug}`)
  .join("\n")}
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
