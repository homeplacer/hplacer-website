# Public-site remediation — September 9, 2026

Scope: hplacer.com public website, separate from the employee portal.

## Implemented

- Page-specific canonical/Open Graph URLs, titles, and descriptions; unique model descriptions. All 254 rendered public pages checked.
- Verified legacy mapping: `/product-page/conway-land-package` → `/homes/stayin-alive` (301, query preserved). Evidence: the search-indexed former Home Placer page at https://www.hplacer.com/product-page/conway-land-package identifies Stayin’ Alive. Old price/specifications are not imported. Unverified legacy paths remain 404.
- Existing www → apex 301 verified live; preserved.
- Home Placer `/find-land` explains the separate Forturro destination and keeps the Home Placer contact/quote path. All configured land-search entry links use it. No lead data are forwarded in the handoff URL.
- Catalog quote wording replaces the inaccurate implication that all model prices are displayed. Historical sold-price context appears only where existing placed-home records match a model. Three dated sold examples appear on the homepage. No model pricing overrides changed.
- Catalog client payload omits detail-page galleries, floor plans, descriptions, and tours while preserving all 93 cards, filtering, and links. HTML reduced from 587,236 bytes to approximately 432 KB. Hero has explicit dimensions, eager loading, and high fetch priority; existing card lazy loading preserved.
- Self-serving sitewide review/rating structured data removed; visible Google testimonials retained. Existing unpriced catalog pages already omitted Product/Offer schema; no fabricated offers added.
- About service-area stat updated from five cities to four counties.
- Owner-confirmed warranty: Home Placer provides the one-year builder warranty for defects. The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage and ten years of structural coverage through the 2–10 company. Applied to Warranty, homepage, About, FAQ, process, and llms summary; no broader coverage or transferability promise added.
- Analytics: page and model views follow client navigation; call, model selection, pricing, financing, form-start, confirmed lead, and land-handoff events. Known model slugs only; no free-text model field, contact data, raw queries, or raw referrers in custom events. Confirmed lead and mailto fallback remain distinct. No production test leads submitted.

## Analytics account changes

Verified active GA4 property `543322936`, stream `15156265502`, measurement ID `G-0T71PWYQSQ`; zero connected site tags. Existing live source has one measurement ID. No historical properties deleted or new properties created.

In this stream, disabled enhanced measurement for history-driven page views, outbound clicks, site search, form interactions, videos, and downloads. Saved settings were reopened and verified. Scrolls remain enabled. Page loads are controlled by the site's explicit `send_page_view: false` and route-view events. This avoids duplicate events and generic link/query collection. If rolling back the analytics code, review the disabled history/form events before restoring old reporting expectations.

## Open / owner-paused

The coordinator relayed an explicit owner instruction to pause unrelated licensing, financing, and legal/trust wording. These are not silently represented as complete:

- Financing and real-property language, including FHA Title I/Title II, chattel/mortgage, USDA eligibility: source corrections and public publication await the owner's wording authorization.
- Privacy policy and SMS/TCPA consent/disclosures: public wording and business workflow approval remain outstanding.
- License number(s), especially NC claims: need the exact current credentials and authorized wording. Existing licensing text was preserved.
- County permitting pillars: authoritative Horry, Georgetown, Brunswick, and Columbus sources located; regulatory wording is held with the legal-content pause. No thin town pages added.
- GTM: signed-in Carolina@hplacer.com Tag Manager has no accounts/containers. Owner must create/accept the Google terms or provide access to an existing container. Current GA4 continues to work.
- AI policy: Cloudflare injects training-crawler restrictions in live robots.txt (`ai-train=no`, GPTBot/ClaudeBot/Google-Extended blocked), while origin rules allow public pages. Ordinary crawler retrieval is not globally blocked. Do not remove the account-level training policy without owner direction. No policy changed.
- Additional legacy mappings need original URLs and authoritative model identity; do not mass-redirect unknown products to the homepage.
- Manufacturer-locator and business-profile changes require the relevant verified profile/retailer account and approved entity facts. No messages to manufacturers or other third parties were sent.
- `homeplacer.com` domain purchase is outside the available evidence/authorization. Do not buy it or change the active domain.

## Reverified audit findings

The September 9 fetched `forturro.com` homepage is a current application and contains no `homeplacer.com` link or `search.forturro.com` handoff. The original wrong-link finding is not reproduced on that page. The Home Placer interstitial still makes the external-site boundary explicit. Forturro source/account was not modified.

## Validation

`npm run build`; `npx tsc --noEmit`; `npx eslint src tests`; `node --test tests/public-site.test.mjs`; rendered metadata, schema, and link checks; local browser catalog search and homepage/handoff visual review. Deployment and live verification recorded in the task's final report.

## Sources for held content

- Horry setup requirements: https://www.horrycountysc.gov/media/xvdisloy/mobile-home-requirements.pdf
- Georgetown setup application: https://gtcounty.org/DocumentCenter/View/154/Mobile-Home-Permit-Application-PDF
- Brunswick manufactured-home brochure: https://www.brunswickcountync.gov/DocumentCenter/View/214/Manufactured-Homes-Brochure-2022-PDF
- Columbus building inspections: https://www.columbusco.org/building-inspections
- FHA Title I: https://www.hud.gov/program_offices/housing/sfh/title/repair
- USDA guaranteed program: https://www.rd.usda.gov/programs-services/single-family-housing-programs/single-family-housing-guaranteed-loan-program
- CFPB mortgage/chattel research: https://www.consumerfinance.gov/data-research/research-reports/manufactured-housing-finance-new-insights-hmda/
