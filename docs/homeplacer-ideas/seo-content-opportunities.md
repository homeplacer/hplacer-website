# SEO & Content Opportunities

*Local-search + content audit. Confirmed 2026-07-09. `file:line` cited; opinions labeled.*

## Headline

Technically one of the cleanest small-business SEO builds you'll see: every route has a
unique title + self-referencing canonical, structured data is broad and mostly valid, the
sitemap is complete, robots deliberately welcomes AI crawlers, and there's an `llms.txt`.
Buyer-intent content is deep (22-item FAQ, 4 comparison pages, glossary, 27 town pages, 36
posts). **The gaps are strategic, not plumbing:** (1) zero landowner/seller funnel; (2) the
NC-towns-labeled-"SC" bug (see technical-audit B-NC / website-audit P1); (3) thin internal
linking to target towns Loris/Longs/Aynor; (4) no browsable "available now" inventory.

## Technical SEO — confirmed strengths

- **Per-page metadata unique + complete** — title + description + `alternates.canonical` on
  every sampled route (home, homes, homes/[slug], financing, land-packages, locations,
  locations/[slug], faq, 4 comparisons, blog, blog/[slug], about, brands, contact, gallery,
  glossary, process, team, warranty, service-request, recently-placed). No canonical gaps.
- **Global metadata** (`layout.tsx:23-54`): `metadataBase`, title template `%s · Home Placer`,
  OpenGraph + Twitter `summary_large_image`, geo meta (`geo.region/placename/position`, ICBM).
- **OG image** static 1200×630 (`opengraph-image.tsx`); blog posts set `og:type=article`.
- **Sitemap complete** (`sitemap.ts`): every route family included; placed homes declare per-home
  geotagged `images`; future-dated posts correctly excluded.
- **Robots** welcomes all UAs incl. GPTBot/ClaudeBot/PerplexityBot/Google-Extended; sitemap declared.
- **Structured data broad & mostly valid** (`jsonld.tsx`): HomeAndConstructionBusiness (global,
  address/geo/areaServed 4 counties + 27 cities/hours/rating/makesOffer), Product+Offer w/ brand
  `sameAs` on home detail, BreadcrumbList (home/location/blog/comparison/placed), FAQPage (/faq +
  3 comparisons), BlogPosting, ImageGallery+SingleFamilyResidence (geotagged placed homes),
  DefinedTermSet (glossary). JSON-LD XSS-escaped.

## Technical SEO — issues

| ID | Issue | Sev |
|---|---|---|
| SEO-1 | **NC town pages render ", SC"** (`locations/[slug]:77` hero + `:175` alt); title uses correct state → page contradicts itself on ~11 NC pages. Fix: `getCounty(loc.countyKey)?.stateAbbr`. (= website-audit P1 / technical bug) | **P1** |
| SEO-2 | **`/land-packages` renders 6 FAQs but emits no `FAQPage` schema** (`land-packages:209-219`) — free rich-result left on table; add `faqLd`. | P2 |
| SEO-3 | **Self-serving `aggregateRating`+`review[]` on LocalBusiness won't render stars** — Google disallows self-serving review rich results for LocalBusiness/Organization (since 2019). Syntactically fine/harmless; real stars come from GBP, not markup. `reviewCount:7` is thin. | P2 (NEEDS JOE/ACCESS — grow GBP reviews) |
| SEO-4 | **No `ItemList`/`CollectionPage` schema on `/homes` or `/brands`** — the catalog is a strong `ItemList`-of-`Product` candidate for carousel/entity treatment. | P2 |
| SEO-5 | **Sitemap `lastModified` hardcoded** `2026-06-21` (non-blog) — stale freshness signal. (= technical B5) | P3 |
| SEO-6 | **Homepage `<title>` ~72 chars + `· Home Placer` template ≈ 86 chars** → SERP truncation. Use `title.absolute` or shorten. | P3 |

## Local-SEO coverage table (target queries)

| Target query / intent | Status | Evidence |
|---|---|---|
| Manufactured homes in **Horry County** | **Partial** | homepage title + `/locations` H2 group + FAQ + llms.txt; **no dedicated county hub page** |
| **Conway SC** | Covered | `/locations/conway` + blog |
| **Loris SC** | Covered | `/locations/loris` + blog |
| **Longs SC** | Covered | `/locations/longs` + blog |
| **Aynor SC** | Covered | `/locations/aynor` + blog |
| **Near Myrtle Beach** | Covered | `/locations/myrtle-beach` + geo meta |
| Land-home packages | Covered | `/land-packages`, glossary, homepage |
| Mobile home vs manufactured home | Covered | `/mobile-home-vs-manufactured-home` (+FAQPage) |
| New manufactured homes | Covered | `/homes` catalog |
| FHA/VA/USDA/conventional financing | Covered | `/financing` + 2 blog posts |
| Buying land + home together | Covered | `/land-packages` + blog |
| Manufactured-home setup process | Covered | `/process` + FAQ |
| Septic/well/utility education | Covered | blog + FAQ (no evergreen hub) |
| Permits & timeline education | Covered | `/process` + 2 blog posts |
| **Available homes (browsable)** | **Partial** | `/homes` = model/floorplan catalog, not live availability; "available now" is phone-gated |
| **Available land-home packages (browsable)** | **Gap** | `/land-packages` explains, no browsable list of specific home+lot+price offers |
| **Landowners who want to SELL** | **Gap** | No page — only buyer-with-land |
| **Landowners who want development options** | **Gap** | No page ("development" = a gallery category only) |
| **Seller / owner pages** | **Gap** | Only existing-customer `/warranty` + `/service-request` |
| FAQs | Covered | `/faq` (+FAQPage) |
| Comparison pages | Covered | 4 dedicated |
| Buyer guides | Covered | 36 posts + `/process` + `/financing` |
| Service-area pages | Covered | `/locations` + 27 towns |

## Internal linking

- **Loris / Longs / Aynor have ~zero inbound internal links** outside the `/locations` index
  (grep-confirmed) — they're not in the footer's 10 representative towns (`site.ts:65-76`), yet
  they're explicit target queries. The 3 highest-intent inland SC towns are the most under-linked. **P2.**
- **Location detail pages are near dead-ends** — link out only to `/homes` + `/contact`
  (`locations/[slug]:84,125,190`); no contextual links to `/financing`, `/land-packages`, `/process`,
  or town-specific blog posts. Missed equity + conversion paths. **P2.**
- **Blog "related" isn't topical** — `blog/[slug]:44` uses `getAllPosts().slice(0,2)` (2 newest); posts
  have no in-body links to money pages beyond the `/contact` CTA. With 36 posts, a big interlinking
  miss (financing posts → `/financing`; town posts → town pages). **P2.**

## Content opportunities (prioritized)

- **[P0/strategic] Landowner "Sell or develop your land" hub + spokes** — the single biggest gap;
  serves a stated business goal with **zero** current coverage. Build `/sell-your-land` (or
  `/landowners`) pillar + spokes ("Sell your lot for cash", "Develop your acreage into land-home
  lots", "Family land — sell, gift, or build"), a **distinct lead form + FUB tag**, and
  `Service`/`RealEstateAgent` schema. **NEEDS JOE:** define the offer (buy outright vs. JV/develop vs.
  list) first. (See business-opportunity-review + lead-flow-audit.)
- **[P1] County hub page** — `/manufactured-homes-horry-county` (or `/locations/horry-county`)
  consolidating all Horry towns + USDA notes + inventory to anchor the top commercial query. Replicate
  for Georgetown/Brunswick/Columbus.
- **[P1] "Available now / move-in-ready" page** — availability is entirely phone-gated. Even a
  lightweight "homes ready to tour this month" list captures "available manufactured homes near me /
  in stock" intent + shortens the funnel. Pair with `ItemList` schema. **NEEDS ACCESS** (live MLS/IDX
  feed) for a real inventory feed — current `mlsCollabUrl` is a static collab share, not a feed.
- **[P2]** Add `FAQPage` schema to `/land-packages` (SEO-2); interlink blog↔location↔money pages;
  add Loris/Longs/Aynor to a footer/town link block; `ItemList` on `/homes` + `/brands`.
- **[P3]** Landowner-intent blog spokes ("What's my Horry County lot worth to a home dealer",
  "Selling raw land vs. developing it", "USDA-eligible land: what makes a lot buildable") to feed the
  P0 hub; evergreen "Septic/wells/utilities" + "Permits/timeline" resource pages (currently blog-only).

## Bad-lead (renter) SEO risk — LOW / clean

Grep for `for rent`/`rental listings`/`renters`/`rent-to-own`/`tenant`/`landlord` → **no risky
pages**. The only "rent" usage is deliberate *anti-rent buyer* framing ("skip the rent cycle",
"not a rental space in someone else's park"). Homepage keywords target buyer/ownership terms only.
Note: the global keyword list + town titles use "mobile home" (`layout.tsx:32`, `locations/[slug]:31`)
— high-volume term that pulls some rent/park intent, but pages immediately pivot to ownership/land
(the right call). **No on-site action; NEEDS ACCESS:** apply renter negative keywords (`for rent`,
`rentals`, `parks`, `lease`) in any Google Ads campaign.

## Needs Joe / Needs access

- **NEEDS JOE** — landowner/seller proposition (define buy-vs-develop-vs-list); GBP categories +
  service-area accuracy (incl. NC counties); NC service-area/licensing confirmation (also compliance C-5).
- **NEEDS ACCESS** — Google Search Console + GA4 (`G-0T71PWYQSQ`) to validate actual rankings, find
  query gaps, confirm the NC-"SC" pages aren't already suppressed; grow GBP reviews (self-markup won't
  produce stars); a live CCAR IDX/RESO feed for an "available inventory" page.

## Build-ready quick wins (no strategy needed)

1. `locations/[slug]:77` + `:175` — `, SC` → `getCounty(loc.countyKey)?.stateAbbr` (fixes 11 NC pages). **P1**
2. Add `faqLd(packageFaqs)` to `/land-packages`. **P2**
3. Add Loris/Longs/Aynor (+ other inland towns) to a footer/town link block. **P2**
4. `sitemap.ts:12` `lastModified` → dynamic/per-content. **P3**
5. `ItemList` schema on `/homes`. **P2**
