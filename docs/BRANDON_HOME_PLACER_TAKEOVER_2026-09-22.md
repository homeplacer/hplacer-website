# Home Placer — Brandon takeover packet

Prepared September 22, 2026. This is the safe operational handoff for the public website and its Forturro MLS integration. It deliberately contains **no passwords, API tokens, cookies, or customer lead data**.

## What is live now

- Public site: https://hplacer.com
- Hplacer repository: https://github.com/homeplacer/hplacer-website
- Hosting: Cloudflare Workers through OpenNext; Worker is `hplacer-app`.
- Current package feed: `https://forturro.com/api/hplacer/active`
- Forturro repository: https://github.com/homeplacer/forturro-idx

The site is a manufactured-home and land-package dealer site serving Horry and Georgetown counties in SC and Brunswick and Columbus counties in NC. The conversion goal is a qualified **call, email, or in-page message** to Home Placer.

## Production work completed in this handoff

Hplacer commits already pushed and deployed:

| Commit | Change |
|---|---|
| `275ea7e` | Old Wix `/product-page/...` URLs now 301 to `/homes`, avoiding stale-search 404s. |
| `0ad3d53` | Homepage package floor is calculated from the live MLS feed, not hard-coded marketing copy. |
| `a3fe037` | Active packages have sitemap URLs; Forturro MLS images are allowed by Hplacer CSP. |
| `a7f6b7b` | Every active package has an indexable Hplacer detail route with price, facts, Offer/Residence JSON-LD, call, and in-page inquiry. |
| `8ebd340` | Fixed 104 Pepe Court visibility in the live packages feed. |
| `57b1eb6` | Google Maps replacement is prepared, but a restricted browser API key is still required before it can go live. |

Current route example: `https://hplacer.com/land-packages/105-pepe-court-conway`

Packages are dynamic and use Forturro as the current price/availability source. Do not hard-code a package price elsewhere. The live feed can change throughout the day.

## Repositories and important files

### Hplacer (`/Users/builder/projects/hplacer`)

- `src/lib/forturro-package-feed.ts` — Home Placer-only active MLS listings; the single public availability source.
- `src/app/land-packages/page.tsx` — package index.
- `src/app/land-packages/[slug]/page.tsx` — new package detail page.
- `src/components/live-package-listings.tsx` — cards and inquiry actions.
- `src/app/sitemap.ts` — includes current package detail URLs.
- `src/middleware.ts` — HTTPS, CSP, canonical host, and legacy redirects.
- `src/lib/site.ts` and `data/business-identity.json` — business facts; do not duplicate phone/address data in components.
- `DEPLOY.md` — deployment and rollback procedure.

Deploy uses `npm run deploy`. Run lint + production build first. Cloudflare credentials must remain in Keychain/Cloudflare secrets, never in Git.

### Forturro (`/Users/builder/projects/forturro-idx`)

- `src/app/api/hplacer/active/route.ts` — Home Placer-only active MLS endpoint.
- `src/app/api/hplacer/closed/route.ts` — closed/sold source endpoint.
- `src/app/api/img/[listingKey]/[ord]/route.ts` — licensed MLS image proxy cached in R2.
- Commit `92374ab6` published the current Home Placer active feed.

**Important:** Forturro currently has an unrelated local modification to `next-env.d.ts`. Do not overwrite or discard it without checking its owner.

## Audit synthesis: Claude desktop + Gemini desktop + Grok desktop + technical review

### Strong already

- Good structured-data and answer-engine base: `llms.txt`, FAQ JSON-LD, town content, clean canonical host, robots and sitemap.
- Modern visual system and authentic Home Placer photography.
- Forturro-fed live inventory and in-page message flow are better than linking buyers away to another portal.

### Highest-impact remaining work

1. **Package-image performance.** Forturro MLS card images are roughly 500–800 KB each. Add safe responsive image derivation/resizing in the Forturro proxy, then update Hplacer cards to request the correct card width. Do not replace legitimate photos with AI imagery.
2. **Google Maps.** The code is prepared, but only deploy after creating and restricting a browser Maps JavaScript API key to `hplacer.com` and `www.hplacer.com`.
3. **Search Console / Google Business cleanup.** Old Wix/Oak Street snippets remain in Google. Verify GBP address, submit current sitemap, validate redirects, and request re-indexing. This is external console work, not a code change.
4. **Local proof.** Add verified license numbers, actual office/team exterior photography, and a systematic review-request process. Do not invent license, review, financing, warranty, or completion claims.
5. **Town strategy.** Many town pages are intentionally `noindex` because they lack project evidence. Do not simply index all of them. Build real county/town proof before changing that policy.
6. **NC authority.** Establish real Brunswick/Columbus proof and local content; do not copy/paste SC claims.
7. **Measurement.** Improve GA4 event coverage for package detail views, call, email, message, MLS/referral origin, and form completion. Tie events to package and town while avoiding PII in analytics.
8. **Homepage/mobile content order.** Keep actual available packages first. The buyer must see image, price, city, beds/baths, and an inquiry choice before lengthy explanation.

## User-confirmed business facts

- Home Placer is the builder. Warranty language: one year on defects; separate 2-10 coverage is two years mechanical and ten years structural through the 2-10 company.
- Sales office: **601 21st Ave N, Myrtle Beach, SC 29577**.
- Office hours: Monday–Friday, 9:00 AM–6:00 PM.
- Sales phone is an additional line; service/warranty line is separate in `src/lib/site.ts`.
- Buyer-facing priority: call, email, or in-page message — no forced redirect to Forturro for Home Placer packages.
- Active MLS records should remain the source of truth. Never duplicate them with manual NewHomeFeed/Zillow listings when MLS already supplies the listing.

## External/profile status and rules

- Zillow/NewHomeFeed uses MLS-connected listings; avoid manual duplicates.
- Confirmed offer at the time of earlier work: $5,000 closing-cost assistance **or** 6.5% promotional rate through January 27, 2027. Treat this as time-sensitive: verify with lender/owner before repeating or changing it.
- Google Business Profile and NewHomeFeed are external systems: do not publish changes without review of the actual current profile and any required terms.
- Existing deployment credentials are held locally and scoped. Never put them in an email, repository, issue, or handoff document.

## Known constraints / gotchas

- Hplacer uses Cloudflare Workers/OpenNext, **not Vercel**.
- `npm run deploy` deploys the working tree. Keep it clean and commit first.
- Do not submit production test leads; they can create real Follow Up Boss records.
- CSP is currently report-only. It now allows `https://forturro.com` images.
- Next 16 currently warns that `middleware.ts` should migrate to `proxy`; schedule that upgrade separately and test redirects/security headers thoroughly.
- The public price is deliberately live-feed driven. When Forturro has an outage, Hplacer falls back only to its prior verified address registry.

## Recommended first session for Brandon

1. Pull both repos and review the commit history above.
2. Run `npm run lint && npm run build` in Hplacer.
3. Check Hplacer package index/detail, sitemap, mobile behavior, call/email/message flow, and legacy redirect in production.
4. Read `DEPLOY.md`, `CURRENT_STATUS.md`, and this handoff before deploying.
5. Prioritize Forturro image resizing and analytics attribution next; then handle verified proof and Google Search Console with the business owner.
