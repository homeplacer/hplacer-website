import { site } from "@/lib/site";
import { getAllHomes } from "@/lib/homes";
import { getAllPosts } from "@/lib/blog";
import { locations } from "@/lib/locations";

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
- Areas served: ${locations.map((l) => `${l.name}, SC`).join("; ")}
- Pricing: land-home packages from the low $200s. No HOA. One-year warranty.

## What we do
Home Placer is a licensed manufactured-home dealer in Horry County, SC. We pair brand-new homes from Clayton, Cavco, and Champion with land — one package, one price, one closing — and handle permits, delivery, foundation, and utility hookups. Financing: FHA, VA, and conventional.

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
