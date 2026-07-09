# Public Website Audit

*Customer's-eye audit of all 24 page routes + shared components. Confirmed 2026-07-09.
Facts cite `file:line`; opinions labeled. Severity per README legend.*

## Bottom line

A strong, well-built **buyer-acquisition** site. The offer is clear, the "Call for
pricing" problem is handled gracefully with per-home lead capture, and buyer education
(FAQ, glossary, 4 comparison pages, 36 blog posts, 27 town pages) is genuinely excellent.
The real problems are strategic, not plumbing: the **landowner/seller path doesn't
exist**, **NC towns are mislabeled "SC"**, and an **unverified "Licensed in SC & NC"
claim** rides on the homepage.

## Strengths (confirmed)

- **Homepage nails the offer** in one line — product + buyer + price + "no HOA" (`page.tsx:39-46`; value props `site.ts:80-97`).
- **"Call for pricing" is a lead moment, not a dead end.** Empty pricing → each home swaps in a "Get {home}'s price" form (`homes/[slug]/page.tsx:272-304`), every card has a price CTA (`home-card.tsx:94-98`), and the browser auto-hides the price sort/range filter while nothing is priced (`homes-browser.tsx:74-75,237`). Nicely defensive.
- **Buyer-WITH-land** path is strong and repeated (`land-packages:90-97`, `homes/[slug]:147-152`, `faqs.ts:11-18`, `financing-form:80-100`).
- **Buyer-WITHOUT-land** kept in-house via the Forturro land search (`forturro-land-search.tsx:30-46`) instead of losing them to Zillow.
- **Financing + VA/FHA/USDA** fully served, incl. USDA $0-down callout and a proper "not a lender" disclaimer (`financing/page.tsx:14-35,66-73,107-111`).
- **Education is a standout:** 4 comparison pages w/ FAQ schema, 17-term glossary, 22-item FAQ, 36 blog posts incl. honest ones ("why-you-might-not-want…", "biggest-mistakes…").
- **Trust signals:** real 5.0★ Google reviews → JSON-LD (`testimonials.tsx`, `reviews.ts`), full team page w/ photos, "recently placed" proof w/ real addresses + prices + map.
- **Click-to-call is correct everywhere,** with a proper split between sales (843) 849-HOME and service (843) 484-9844 (`site.ts:13-20`, `site-header.tsx:42-48`, `site-footer.tsx:30-35`).

## P0 — Broken / blocking
None. All in-page anchors resolve; deep links (`/homes?brand=`, `?wall=drywall`) are honored; no dead routes.

## P1 — High-value fixes

- **[BUG] NC town pages & footer render ", SC".** `locations/[slug]/page.tsx:77` (hero pill) and `:175` (image alt) hardcode `, SC`; `site-footer.tsx:128` and `land-packages/page.tsx:105` do the same for `site.locations`. NC towns (Leland/Shallotte/Southport/Calabash → `brunswick-nc`; Whiteville → `columbus-nc`) therefore show "Brunswick County, SC", contradicting the page's *own* title/metadata which use the right state (`:31`). Data already has the fix: `getCounty(loc.countyKey)?.stateAbbr` (`locations.ts:23,85`). **Safe, ~1-line-each fix; fixes ~11 pages.** → build-queue.
- **[CLAIM] "Licensed in SC & NC" is unverified.** Homepage asserts it (`page.tsx:68,154`) but the single source of truth claims **SC only** (footer `site-footer.tsx:138`, value prop `site.ts:95`, about `about/page.tsx:25`). Placing homes in NC generally needs NC Manufactured Housing Board licensure. **NEEDS JOE:** confirm the NC license exists; if not, downgrade the copy. (Also in compliance-review-flags.)
- **[GAP] No landowner/seller path exists** — the exact lead type the business wants next. Every "land" surface targets *buyers* ("Don't have land yet?", "Already own land?" = *place our home on your lot*). No "Sell your land / We buy land / Develop your acreage" page, nav item, or form (`site.ts:100-110,127-130`). **NEEDS JOE** (define the offer: buy outright vs. JV/develop vs. list) **+ P1 build** a `/sell-your-land` (or `/landowners`) page with its own form + distinct FUB tag.

## P2 — Improvements

- **Education/SEO pages are buried in the footer, not nav.** Nav is a flat 9 items, no dropdowns (`site.ts:100-110`, `site-header.tsx:29-39`); Process, FAQ, Gallery, Locations, Blog, Glossary, and all 4 comparison pages are footer-only (`site.ts:112-125`). These win the "manufactured vs modular / mobile home / where we build" searches — group them into a "Learn"/"Why Manufactured" + "Locations" nav.
- **No persistent header CTA.** Header's only action is the phone link (`site-header.tsx:42-48`). Add a sticky "Get your price" button.
- **`/homes` intro assumes prices are shown.** "Each price is a starting point… Call for your exact all-in number" (`homes/page.tsx:26-29`) reads oddly when every card says "Call for pricing." Reword for the unpriced reality.
- **About page is stale vs. the expansion.** Says "5 cities / Across Horry County" (`about/page.tsx:42-46`) while Locations claims "27 towns, four counties, two states" (`locations/page.tsx:24`). Update About.
- **No dealer license number / credentials shown.** Site says "licensed" repeatedly but shows no license #, board affiliation, or BBB. Adding the real SC (and NC, if real) dealer license # to footer/About hardens the strongest trust claim. **NEEDS JOE** for the number.
- **Reviews: UI advertises "7 Google reviews" but `reviews.ts` holds only 3,** and one (Terry Yannick) reads like a *Realtor* review ("real estate in Myrtle Beach", "perfect neighborhood" — `reviews.ts:16`), likely from the Forturro/KW side, not the home dealer. Pull the genuine GBP reviews and lead with product-relevant ones.

## P3 — Nice-to-have

- **"Call or text" CTAs use `tel:`, not `sms:`.** Copy invites texting (`page.tsx:164`, `contact/page.tsx:35`) but all links dial (`site.ts:14`); 0 `sms:` links site-wide. **NEEDS JOE:** confirm the line accepts SMS, then add a real text affordance (also in lead-flow-audit).
- **Contact page hides the email address** (email only in footer) — minor omission for email-preferring buyers (`contact/page.tsx:26-70`).
- **Mild renter framing is on-strategy, low risk.** "skip the rent cycle", "you don't have to rent forever" (`locations.ts:98,146`) target renters-who-want-to-*buy*; no "for rent"/"rental"/"rent-to-own" copy exists anywhere (grep-confirmed). No action; awareness only.

## Persona lead-path matrix (confirmed)

| # | Persona | Self-serve path? | Where |
|---|---|---|---|
| 1 | First-time buyer | Yes | Financing, Process, blog (no single hub) |
| 2 | Buyer WITH land | Yes, strong | land-packages, home detail, FAQ, forms |
| 3 | Buyer WITHOUT land | Yes | Forturro land search |
| 4 | **Landowner / seller** | **No — absent** | Nothing. P1 above. |
| 5 | Financing-sensitive | Yes, strong | `/financing` + form |
| 6 | VA/FHA/USDA | Yes, strong | `/financing` (all 4 programs) |
| 7 | Comparing mfg vs modular/site-built | Yes, excellent | 4 comparison pages + glossary + blog (footer nav) |
| 8 | Permits/septic/utilities | Yes | FAQ + land-packages + per-county facts + blog |
| 9 | Timeline/process | Yes | `/process` (not in nav) + homepage + FAQ |
