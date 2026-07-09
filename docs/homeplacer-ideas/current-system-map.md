# Current System Map (Confirmed)

*Everything here is verified against the code as of 2026-07-09. `file:line` cites the
source of truth. Assumptions are labeled inline.*

## Business facts (from `src/lib/site.ts`)

- **Home Placer LLC** — licensed SC (& NC) manufactured-home + land-home-package dealer.
  Horry County / Grand Strand + nearby NC (Brunswick, Columbus counties).
- Sells **brand-new Clayton, Cavco, Champion** homes placed on land. "One package, one
  price, no HOA." Tagline: *"New homes, on land, from the low $200s."* (`site.ts:9`)
- **Sales line:** (843) 849-HOME → `+18438494663` (`site.ts:13-15`).
- **Warranty/service line:** (843) 484-9844 → `+18434849844` (`site.ts:18-20`) — separate from sales.
- **Email:** Carolina@hplacer.com (`site.ts:16`). Address 1801 N Oak St, Myrtle Beach SC 29577 (`site.ts:22-27`).
- **GA4:** `G-0T71PWYQSQ` (`site.ts:32`). **GBP:** CID 3461988553332431879, 5.0★, 7 reviews (`site.ts:40-44`).
- **Social:** Instagram @homeplacer (live); TikTok + Facebook configured but `live:false` (`site.ts:135-157`).
- **Sister company:** The Forturro Group (KW real-estate team) — cross-over land search (`site.ts:51-59`).

## Stack / platform

- **Next.js 16.2.9** (App Router) · **React 19.2.4** · **Tailwind v4** · `marked ^18` (blog markdown) · TypeScript 5 (`package.json`).
- ⚠️ `AGENTS.md`: this Next 16 build has breaking changes vs training data — check `node_modules/next/dist/docs/` before writing Next code.
- **Deploy target: Cloudflare Workers via OpenNext** (`@opennextjs/cloudflare ^1.19.11`, `wrangler ^4.104`). Worker `hplacer-app`, account `6caa351…`, custom domains `hplacer.com` + `www` (`wrangler.jsonc`). Flags: `nodejs_compat`, `global_fetch_strictly_public`; compat date 2024-12-30.
- ⚠️ **`README.md:8` says "deploy target Vercel" — STALE/WRONG.** Everything else (wrangler, open-next, HANDOFF) is Cloudflare Workers. (See technical-audit → doc drift.)
- **workerd has no runtime filesystem** — files must be static-imported/inlined base64 (e.g. OG hero in `src/app/og-hero.ts`), never `fs.readFileSync`.
- **Package manager:** npm (`package-lock.json`).

## Scripts (`package.json`)

- `dev` → `next dev` (with `predev` → `build-manifests.mjs`)
- `build` → `next build` (with `prebuild` → `build-manifests.mjs`)
- `deploy` → `build-manifests.mjs && opennextjs-cloudflare build && opennextjs-cloudflare deploy`
- `preview` → same but `opennextjs-cloudflare preview`
- `lint` → `eslint` · `cf-typegen` → wrangler types
- **Deploy builds from the WORKING TREE, not git HEAD** (per `HANDOFF.md:68`) — local working files are the source of truth. A scheduled task `hplacer-blog-publish` auto-runs `npm run deploy` 2×/week to surface date-gated blog posts.

## Public routes (~240 prerendered pages)

| Route | Notes |
|---|---|
| `/` | Homepage. Primary CTA = inline `#get-price` capture + `/homes` (`page.tsx:49,55`). |
| `/homes` + `/homes/[slug]` | Inventory browser (brand/width/beds/sqft/price/drywall filters + search + sort) + 93 model detail pages. |
| `/brands` | Clayton/Cavco/Champion marketing. |
| `/land-packages` | Land+home package conversion page. |
| `/recently-placed` + `/recently-placed/[slug]` | 73 real placed homes + Leaflet map. |
| `/financing` | FHA/VA/USDA/conventional education + financing capture form. |
| `/process` | Buyer timeline / how-it-works. |
| `/warranty` + `/service-request` | Existing-homeowner warranty program + service form. |
| `/faq` (23 Q&A), `/glossary` | Content pages w/ schema. |
| `/manufactured-vs-site-built`, `/modular-vs-manufactured-homes`, `/mobile-home-vs-manufactured-home`, `/manufactured-home-drywall-vs-wall-strips` | 4 comparison/education pages. |
| `/locations` + `/locations/[slug]` | 27 town local-SEO pages (`lib/locations.ts`). |
| `/about`, `/team`, `/contact` | Trust + contact. |
| `/gallery` | Photo gallery. |
| `/blog` + `/blog/[slug]` | 36 posts, date-gated (`lib/blog.ts`). |
| SEO routes | `sitemap.ts`, `robots.ts`, `llms.txt/route.ts`, `opengraph-image.tsx`, `icon.png`/`apple-icon.png`/`favicon.ico`. |

**Routes that do NOT exist (confirmed via `find src/app`):** `privacy`, `terms`, `legal`,
`sell` / `sell-my-land`, `landowner`, `seller`. (See compliance + SEO + business docs.)

## API / backend

- **Only one API route: `POST /api/lead`** (`src/app/api/lead/route.ts`) — unified intake
  for all 5 forms. Validates → delivers via FUB + Resend (both env-gated) → always logs.
  Retries transient failures; emits `CRITICAL LEAD_NOT_DELIVERED` if nothing captures.
  Warranty routing is "safe" (never steals a lead from an existing owner).
- **No database, no auth, no admin UI, no customer/employee portal.** Inventory + content
  are **static JSON edited by redeploy**. (This is by design for Phase 0; Phase 1 = D1 + auth + API + admin per `ROADMAP.md`.)

## Forms (5) → all POST `/api/lead` via `lib/lead.ts` `submitLead()`

`contact-form`, `financing-form`, `service-request-form`, `email-capture`, `want-this-house-form`.
Client attaches first-touch attribution (`lib/attribution.ts`) and fires GA `generate_lead`.

## Integrations

| Integration | State |
|---|---|
| **Follow Up Boss** (CRM) | `FUB_API_KEY` = Cloudflare Worker secret (set, per HANDOFF). Warranty owner id 39, collaborators 1,35,46 (defaults in `route.ts:120-129`). This is HP's own FUB, **not** the Forturro brokerage CRM (charter boundary — `CLAUDE.md`). |
| **Resend** (email backup) | `RESEND_API_KEY` **not configured** (optional). |
| **GA4** | Loaded via `components/analytics.tsx`, `anonymize_ip:true`, **no consent gate**. |
| **IndexNow** | `scripts/indexnow.mjs` + `public/…txt` token. |
| **Forturro cross-over** | `search.forturro.com` deep links: land-only (safe) + "browse all listings" (unfiltered) — `site.ts:54-58`, `components/forturro-land-search.tsx`. |
| **Search infra** | Google Search Console (`public/google856369418c83b326.html`), Bing Webmaster, sitemap submitted (per HANDOFF). |

## Environment variables referenced

`FUB_API_KEY`, `FUB_WARRANTY_USER_ID`, `FUB_WARRANTY_COLLABORATORS`, `RESEND_API_KEY`,
`LEADS_TO`, `LEADS_FROM`, `WARRANTY_LEADS_TO` (`.env.example`, `route.ts`). GA id is
**hardcoded** in `site.ts:32`, not env-driven. No secrets committed.

## Security posture (`src/middleware.ts`, `api/lead/route.ts`)

- Edge HTTPS 308 redirect (loop-safe). Headers: X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy. HSTS (prod). **CSP = Report-Only** (not enforcing yet).
- `/api/lead`: 413 payload cap (32 KB), per-field length caps, HTML-escaped email output.
- Blog markdown XSS sanitized; `jsonld.tsx` escapes `<`. `dangerouslySetInnerHTML` used only
  in `blog/[slug]/page.tsx:73` (sanitized) and `jsonld.tsx:16` (escaped) — both handled.

## SEO / schema

Canonicals on ~14 pages; LocalBusiness / Product / FAQPage / BlogPosting / BreadcrumbList /
Review JSON-LD; `robots.ts` allow-all incl. AI crawlers; `sitemap.ts` covers all route
families. ⚠️ Sitemap `lastModified` **hardcoded to `2026-06-21`** for all non-blog pages
(`sitemap.ts:11`).

## Data (static JSON, `data/`)

- `models.json` — **93** models · `placed-homes.json` — **73** · `blog-posts.json` — **36** · 27 locations (`lib/locations.ts`).
- `setup-pricing.json` = `{}` and `home-pricing.json` = `{}` → **every home shows "Call for pricing"** (biggest known conversion gap).
- Supporting: `galleries.json`, `placements.json` (map), `reviews` (`lib/reviews.ts`), plus raw/intermediate build inputs (`_models-raw.json`, `galleries-raw.json`, `paragon-sold.csv`, `sold-homes.json`, `mls-listings-active.json`).
- ⚠️ `HANDOFF.md:70`: **never re-run `scripts/build-models.mjs`** — it wipes hand-finalized fields; edit `models.json` by hand.

## Tests / quality gates

- **No test suite** (no runner, no test files). Quality gates = `tsc --noEmit` + `eslint`.
- ✅ Verified this pass: **typecheck passes, lint passes** (both exit 0).

## Existing docs (don't duplicate)

`README`, `HANDOFF`, `ROADMAP`, `DECISIONS` (D-HP-001…005), `TODO`, `CHANGELOG`, `DEPLOY`,
`AGENTS`, `CLAUDE`, **`LAUNCH-READINESS.md` (untracked in git — see technical-audit)**,
`docs/handoff/00-09`.
