# Home Placer — Website + Backend Deep Dive (Complete Bundle)

_Single-file bundle of the full audit. Generated 2026-07-09. Read-only investigation — no production changes, no deploy. Source docs live in `docs/homeplacer-ideas/`._

## Contents

1. Final Report (executive roll-up)
2. Current System Map
3. Website Audit
4. Technical Audit
5. Lead-Flow Audit
6. Backend Opportunities
7. SEO & Content Opportunities
8. Compliance Review Flags
9. Business Opportunity Review
10. Approved Build Queue (all PROPOSED)
11. Parking Lot
12. Questions for Joe



<div style="page-break-before: always;"></div>

---

# Home Placer — Website + Backend Deep Dive · FINAL REPORT

*Investigation + planning pass, 2026-07-09. Read-only — no production changes, no deploy.
This is the executive roll-up; each section points to a detailed companion doc in this folder.
Priority legend in `README.md`.*

---

## 1. Executive summary

Home Placer's website is **already good** — genuinely above the bar for a manufactured-home
dealer. It's a Next.js 16 site on Cloudflare Workers with ~240 prerendered pages, a deep
education layer (comparison pages, glossary, 22-item FAQ, 36 blog posts, 27 town pages), a
clean money-first homepage, and a **well-engineered lead pipeline** (`/api/lead` → Follow Up
Boss with retries, safe warranty routing, first-touch attribution, and a no-silent-loss
marker). **Typecheck and lint both pass. There are no P0 broken-code bugs.** A prior Claude
("Builder-Claude") already completed a Phase-0 hardening cycle (11 PRs) and documented it well.

The company is **not held back by its code — it's held back by business inputs and a few concrete
claim/consistency issues**:

- **No prices.** All 93 homes show "Call for pricing" (pricing files are empty). Biggest conversion drag. *(NEEDS JOE)*
- **No privacy policy / consistent consent.** Legal exposure **and** it blocks Google Ads. *(P0)*
- **No landowner/seller path** — the future lead type the business wants has zero route. *(NEEDS JOE)*
- **A visible bug:** NC town pages/footers render ", SC". *(P1)*
- **Claim inconsistencies** to reconcile: "Licensed in SC & NC" (unverified), warranty "1-year vs 2-10", "7 reviews" but 3 shown.
- **Reliability debt** already on the team's radar: ~950 hotlinked manufacturer images (no fallback) and a runtime unpkg Leaflet script.
- **The lead safety-net alert is unwatched** — wire it before turning on traffic.

Bad-lead (renter/tenant) risk is **low** — the content actively repels that audience. One watch item (the Forturro "Browse all listings" link). The backend roadmap is sound; **don't start it until live pricing + real traffic validate demand, and don't rebuild the CRM that Follow Up Boss already provides.**

## 2. Current system map

Full detail: **`current-system-map.md`**. In one line: Next.js 16 / React 19 / Tailwind 4,
deployed to **Cloudflare Workers via OpenNext** (not Vercel — the README is stale), static-JSON
data edited by redeploy, **no database / auth / admin**, one API route (`/api/lead` → FUB +
optional Resend), GA4 + IndexNow + a Forturro MLS cross-over. FUB is the CRM.

## 3. What appears to be working (don't touch)

- **Lead pipeline** — retries/backoff, E.164 phone normalization, safe warranty routing that never
  steals an owned lead, first-touch attribution on every form, `CRITICAL LEAD_NOT_DELIVERED` marker.
- **Security surfaces** — HTTPS middleware, security headers, markdown-XSS sanitized, JSON-LD escaped,
  `/api/lead` payload/field caps; no secrets committed.
- **SEO plumbing** — unique titles + self-canonicals everywhere, complete sitemap, broad valid schema,
  AI-crawler-friendly robots, `llms.txt`.
- **Education & trust content** — 4 comparison pages, glossary, deep FAQ, 36 posts, real reviews wired
  to schema, team page, "recently placed" proof with a map.
- **Accessibility baseline** — modals with focus trap/restore/Esc/scroll-lock; labeled controls.
- **"Call for pricing" handled gracefully** — each unpriced home becomes a lead-capture moment.
- **Quality gates green** — `tsc --noEmit` + `eslint` both pass.

## 4. Critical bugs / issues (P0)

There are **no P0 code bugs**. The P0s are **operational/legal**:

1. **Unwatched lead-failure marker** — if secrets are unset/invalid at go-live, every lead becomes an
   unread log line. Wire an alert first. *(lead-flow L1; NEEDS ACCESS: Cloudflare)*
2. **No privacy policy / TCPA-grade consent** — collecting PII + running GA with no policy; consent is
   inconsistent fine print. Legal exposure + blocks Google Ads. *(compliance C-1/C-2)*
3. **[External finding — flagged by a concurrent session, not this pass] OpenNext no-op cache.**
   A separate session's `OPENNEXT-CACHE-AUDIT.md` (repo root, untracked) reports that
   `open-next.config.ts` uses `defineCloudflareConfig()` with **no incremental cache** → the
   adapter falls back to the `"dummy"` cache, so every request re-renders the full page in the
   Worker (claimed ~23% cache rate, ~366 ms CPU P90, and `1102` "Worker exceeded CPU" errors under
   load). **I verified the config line (`open-next.config.ts:6`); I did *not* verify the live
   metrics** — those are that session's. If accurate, this is a **P0 live-performance issue** with a
   claimed one-file fix (`static-assets-incremental-cache`). **Do not action blindly** — it belongs
   to the other session; coordinate before anyone edits `open-next.config.ts`. See §"Coordination note".

## 5. High-priority fixes (P1)

1. **NC towns render ", SC"** — `locations/[slug]:77,175`, `site-footer:128`, `land-packages:105`; fix via `getCounty(loc.countyKey)?.stateAbbr`. *(website / SEO-1)*
2. **"Licensed in SC & NC" unverified** — reconcile vs. SC-only source of truth; show license number(s). *(website / compliance C-5)*
3. **Warranty contradiction** — `/warranty` says "2-10"; everywhere else says "1-year." Reconcile to the verified truth. *(compliance C-4)*
4. **Hotlinked images: no `onError` fallback** — a CDN 404 shows a broken-image icon. *(technical B2)* And, larger: **mirror the ~950 images to R2** *(R1 — keystone; unlocks CSP tightening + perf)*.
5. **Self-host Leaflet** — drop the runtime unpkg script. *(technical R2)*
6. **Reviews mismatch** — "7 reviews / 5.0★" advertised, 3 shown; sync to live GBP; drop the off-message testimonial. *(compliance C-7 / website)*
7. **Lead spam protection** — add a honeypot + light rate-limit to `/api/lead`. *(lead-flow L2)*
8. **Landowner/seller intake** — a page + form + distinct FUB tag (cheap; serves a stated goal). *(needs J2)*

## 6. Medium-priority improvements (P2)

Rewrite `DEPLOY.md`/`README` for Cloudflare (currently point an operator at Vercel — genuinely
risky); fix the one `http://` image; add `FAQPage` to `/land-packages` + `ItemList` to `/homes`;
surface education/locations in nav + a sticky "Get your price" CTA; internal-link pass (Loris/Longs/
Aynor + location↔money-page + topical blog links); click-to-text if the line is SMS-capable; sitemap
`lastModified` from content; purge stale GitHub-Pages/Vercel comments + dead `BASE_PATH`; update the
stale About-page stats. *(details across website / technical / SEO docs)*

## 7. Low-priority / nice-to-have (P3)

Double-submit guard + phone `pattern` on all 5 forms; 44px hamburger tap target; `aria-pressed` on
brand/width filter tabs; gate GA to prod + drop the no-op `anonymize_ip`; `width`/`height` on gallery
images (CLS); `aria-hidden` on decorative icons; iframe tour-host allowlist at build time; pin `marked`;
delete leftover Next starter SVGs in `public/`. *(technical audit)*

## 8. Backend / admin opportunities

Full detail: **`backend-opportunities.md`**. Two governing truths: **(a)** launch-readiness before
platform build (D-HP-002) — most backend is "useful later, trigger = validated demand"; **(b)** FUB is
already the CRM — **don't rebuild leads/pipeline/tasks/notes in-app.** Sequencing: *around launch* —
missed-lead alerting + the light landowner intake; *Phase 1* — D1 → Auth/RBAC → `/api/v1` → **Admin UI
for inventory + pricing** (kills the redeploy bottleneck; the keystone); *Phase 2* — **Package Builder**
+ financing estimator + quotes; *Phase 3–4* — construction/permit/delivery/closing trackers + document
checklist + customer portal (where a land-home dealer actually loses time). **Do not build:** a second
CRM, a custom analytics dashboard pre-spend, customer SMS/email without approval, or multi-tenant SaaS.

## 9. SEO / content opportunities

Full detail: **`seo-content-opportunities.md`**. Plumbing is excellent; gaps are strategic:
a **landowner "sell/develop your land" hub** (biggest; needs J2), a **Horry County hub page**, a
browsable **"available now"** page (needs a live MLS feed), `FAQPage`/`ItemList` schema wins, an
internal-linking pass (Loris/Longs/Aynor are under-linked), and topical blog interlinking. Coverage
table shows most buyer queries are already **Covered**; the **Gaps are all seller/landowner + live
availability.**

## 10. Lead-flow gaps

Full detail: **`lead-flow-audit.md`**. The pipeline core is strong; gaps are at the edges: unwatched
failure marker (P0), no bot protection (P1), inconsistent consent + no privacy link (P1, compliance),
double-submit only button-guarded (P2), no customer autoresponder (parked — needs approval), no
seller/landowner lead type/routing (P2), and no offline-conversion loop back to Ads (P2, later). No
in-app visibility — everything lives in FUB, so **verify FUB automations exist for every source/tag.**

## 11. Compliance / legal-review flags

Full detail: **`compliance-review-flags.md`** (13 flags; not legal advice). **P0:** privacy/terms +
TCPA consent. **P1:** financing "$0 down" ad language, warranty 2-10 substantiation, license numbers/NC,
"placed & sold" MLS accuracy + data-use, 7-vs-3 reviews. **P2:** monthly-payment offers, "apply for
financing" wording, "every home qualifies," Fair-Housing pass on "family" copy, GA consent, RESPA on the
Forturro referral. **Verified fine:** wall-finish wording, "not a lender" disclaimer, HUD mobile-vs-
manufactured accuracy, hedged pricing, no rental/property-management wording anywhere.

## 12. Bad-lead risks

**Low.** No `for rent`/`rental`/`tenant`/`rent-to-own` surface exists (grep-confirmed); the content
actively frames *against* renting ("we've never put a family on leased land, and we never will"). Two
notes: the "mobile home" SEO term pulls some rent/park intent but pages pivot to ownership (right call —
add renter negative keywords in any Ads campaign), and the **Forturro "Browse all listings" link is
unfiltered** — confirm it doesn't surface rentals (J9). When the seller path is built, give it its own
lead type so owner leads don't blend into buyer leads.

## 13. Questions for Joe

Full list: **`questions-for-joe.md`**. Top of the pile: **prices (J1)**, **landowner offer (J2)**,
**NC license reality + number (J3/J4)**, **warranty truth (J5)**, **real reviews (J6)**, **SMS-capable
line? (J7)**, **approve the privacy/consent layer (J10)**. Access blockers: Cloudflare, FUB, GSC/GA4,
GBP, MLS feed, registrar.

## 14. Recommended build queue

Full list: **`approved-build-queue.md`** — **currently all `PROPOSED`, nothing approved.** Nothing gets
built until Joe moves an item to `APPROVED`. Recommended order starts: (1) lead-failure alert, (2)
privacy/consent, (3) NC-"SC" fix, (4) license claim, (5) warranty reconcile, (6) image `onError`, (7)
review sync, (8) spam protection, (9) landowner intake — then the P2 batch, then the image-mirroring +
Leaflet reliability keystone.

## 15. Parking lot

Full list: **`parking-lot.md`**. Deferred (not lost): customer SMS/email autoresponder + review-request
(need approval), Package Builder + financing estimator (Phase 2), construction/permit/closing trackers +
portal (Phase 3–4), custom reporting/attribution dashboard, offline-conversion export, modulars catalog,
CSP enforce (blocked on image mirroring), multi-tenant SaaS (out of scope).

## 16. Suggested next Claude sessions

Sequenced so each is self-contained and respects "no build until Joe approves":

1. **Session A — Launch-blocker code fixes (no Joe input needed):** NC-"SC" bug, image `onError`
   fallback, `/api/lead` spam protection, `DEPLOY.md`/`README` Cloudflare rewrite, `http://` image,
   `FAQPage`/`ItemList` schema, sitemap `lastModified`, stale-comment purge. Safe, high-signal, unblocked.
2. **Session B — Compliance layer:** privacy policy + terms + standardized consent (with legal review;
   gated on J10). Unblocks Google Ads.
3. **Session C — Go-live truth pass:** load pricing (J1), reconcile warranty (J5), sync reviews (J6),
   resolve the license claim + show the number (J3/J4). Turns the dormant price sort/filter on.
4. **Session D — Landowner/seller funnel:** page + form + FUB routing + SEO hub (gated on J2).
5. **Session E — Reliability keystone:** mirror the ~950 images to R2, self-host Leaflet, then promote
   CSP to enforcing.
6. **Session F — Ops hardening (needs Cloudflare/FUB access):** wire the lead-failure alert, verify FUB
   automations, set/verify secrets, finish domain + HSTS.
7. **Session G — (later, only when traffic validates demand) Phase 1 platform design:** D1 schema +
   Auth/RBAC + `/api/v1` + Admin UI — brought as a design for review *before* feature code (D-HP-005).

---

## Coordination note (important)

During this audit, two untracked files appeared/were-updated in the repo root at ~15:44 that are
**not** part of this pass: `OPENNEXT-CACHE-AUDIT.md` (names a different session — "Home Placer
Website Stabilization / OpenNext Cache Audit") and `LAUNCH-READINESS.md` (an earlier Builder-Claude
report). This strongly implies **another Claude session is working the same working tree
concurrently.** Because **deploys build from the working tree, not git** (`HANDOFF.md:68`), two
sessions editing the same tree can clobber each other or ship half-finished work. **Recommendation:**
before any build session, confirm with Joe which session owns what, and consider committing/branching
to isolate work. This audit deliberately left both files untouched.

---

*End of report. Per the operating rules: no features were built, nothing was deployed, no external
communications were sent. The only changes this pass are the markdown files in `docs/homeplacer-ideas/`
(and both pre-existing untracked root files were left untouched). Await Joe's decisions before any
build session.*


<div style="page-break-before: always;"></div>

---

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


<div style="page-break-before: always;"></div>

---

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


<div style="page-break-before: always;"></div>

---

# Technical / Code-Quality Audit

*Config, data loaders, components, forms, build scripts, error pages. Confirmed 2026-07-09.
Baseline: **typecheck + lint pass green**; middleware + `/api/lead` already hardened.
**No P0 broken-code found.** Findings are reliability, hardening, a11y, and doc/tech-debt.
Bugs are kept separate from cleanup. `file:line` cited.*

## Headline

The code is clean, typed, well-commented, and the hard security surfaces (markdown XSS,
JSON-LD escaping, HTTPS middleware, modal focus management) are already handled
thoughtfully. The real exposure is **operational/reliability**, concentrated in two
places already on the team's radar — **hotlinked manufacturer images** and the
**runtime unpkg Leaflet script** — plus **stale docs that point an operator at the wrong
deploy platform**.

## Bugs (behavioral / correctness)

| ID | Bug | Sev | Location |
|---|---|---|---|
| B1 | **`http://` image URL** — model `dutch-elite-1676-01` has one `http://` S3 image; every other is `https:`. Browser blocks it as mixed content on the live site, and it violates `img-src … https:` once CSP enforces → broken hero on that model. Fix: rewrite to `https://`. | P2 | `data/models.json` |
| B2 | **No `onError` fallback on any hotlinked `<img>`** — 0 error handlers in `src/`. Empty-array case degrades to a placeholder, but a 404/CDN outage on a *populated* URL shows the browser broken-image icon. Highest-probability visible failure given the hotlinking model. | **P1** | `home-card.tsx:28`, `home-gallery.tsx:110/147/229`, `homes/[slug]` gallery |
| B3 | **Double-submit guard missing** on all 5 forms — no `if(status!=="idle")return`; relies only on the disabled button. Low real-world risk (Enter-submit suppressed while the sole submit button is disabled) but it's the open `TODO.md` item. | P3 | the 5 `*-form.tsx` `handleSubmit` |
| B4 | **Phone field: no client-side format validation** — `type="tel"`+`required` accepts anything; server normalizes. `pattern`/`inputMode="tel"` would catch typos pre-round-trip. | P3 | all forms |
| B5 | **Sitemap `lastModified` hardcoded** `new Date("2026-06-21")` for every non-blog URL (blog uses real dates). Advertises a fixed, now-stale mod date. | P2 | `sitemap.ts:12` |
| B6 | **`aggregateRating.reviewCount` (7) ≠ embedded `Review` objects (3)** — may trip a Search Console "reviewCount mismatch." Intentional (aggregate = true GBP total), noting for awareness. Overlaps compliance #7 & UX review finding. | P3 | `jsonld.tsx:80-89`, `reviews.ts` |

## Reliability / architecture risks (known; assessed)

- **R1 · P1 — ~950 hotlinked manufacturer images across ~20 third-party hosts** (`data/models.json`: claytonhomes.com 611 + 81 floorplans, champion S3 275, cloudinary 125, cloudfront 34, cavco/scene7…). Consequences: (a) reliability — every home page depends on servers HP doesn't control (compounded by B2); (b) **CSP — forces `img-src … https:` wildcard** (`middleware.ts:14`), the most permissive policy, can't tighten until mirrored; (c) perf — raw `<img>`, no `next/image` resizing/AVIF; full-res JPEGs shipped as-is. **The single most valuable fix on the board** (already TODO #1: mirror to R2/`public`).
- **R2 · P1 — Leaflet injected from `unpkg.com` at runtime** (`placements-map.tsx:40,44`). Third-party CDN serving *executable script* into the user's page = availability + supply-chain risk; requires `script-src … unpkg.com` in CSP. Failure degrades to a gray box (`:90`) so non-fatal, but the map silently vanishes if unpkg is down/blocked. TODO: self-host via npm bundle.
- **R3 · P2 — Worker bundle trajectory.** Statically-imported JSON: `blog-posts.json` 266KB, `models.json` 206KB, `placed-homes.json` 117KB, + `og-hero.ts` 277KB base64 ≈ ~900KB embedded. Well under the 10MB gzip cap today; `blog-posts.json` is the growth vector (auto-publishing calendar). Every content change re-ships the whole blob (static-JSON-by-redeploy).
- **R4 · P3 — OSM tiles direct from `tile.openstreetmap.org`** (`placements-map.tsx:53`). Fine now; OSM's usage policy discourages production use — a tiled provider with an SLA is safer long-term.

## Security (mostly clean — no action unless noted)

- **S1 — `dangerouslySetInnerHTML`: both usages safe.** Only `blog/[slug]/page.tsx:73` (renders `sanitizeHtml()` output — strips script/style/iframe/handlers/js: URIs, `blog.ts:47-53`) and `jsonld.tsx:16` (escapes `<`). First-party content. ⚠️ **If untrusted authors are ever added, replace the regex strip with a real sanitizer** (`blog.ts:47` says as much).
- **S2 — No runtime `fs`** — `readFileSync`/`readdirSync` only in build-time `scripts/*.mjs`; OG image inlines base64 (`og-hero.ts`). Correct for workerd.
- **S3 · P3 — `tourUrl` → `<iframe src>` with no host allowlist** (`homes/[slug]/page.tsx:350`). Today only momento360/matterport + CSP `frame-src https:`, but `build-models.mjs` has no allowlist, so a bad ingest becomes an open iframe. Validate tour hosts at build time.
- **S4 · P3 — GA + attribution run with no consent gate or env gate.** GA4 loads whenever `site.gaId` is set (hardcoded) — **including dev/preview**, polluting the GA4 property; `attribution.ts` writes to localStorage unconditionally. Generally acceptable for US/SC (no GDPR), no CCPA opt-out. Note **`anonymize_ip:true` is a no-op in GA4** (dead UA-era config, `analytics.tsx:17`). Event payloads carry no user PII. (Compliance overlap #12.)

## Accessibility

**Strong baseline (verified):** `zoom-image-modal.tsx` + `home-gallery.tsx` implement `role="dialog"`+`aria-modal`, Esc-to-close, Tab focus trap, focus restore, scroll-lock. Toolbar/nav buttons have `aria-label`; toggle groups use `role="group"`; browser search+selects have `aria-label`; testimonial stars labeled.

**Gaps (all P3):**
- **A1 — Mobile hamburger `size-10` (40px)** < 44px WCAG target (`site-header.tsx:54`). Open TODO ("→ `size-11`").
- **A2 — Inconsistent `aria-pressed`:** drywall toggle has it (`homes-browser.tsx:204`), brand tabs (`:164-177`) and width-type tabs (`:184-197`) don't. Add for parity.
- **A3 — Gallery hero/lightbox `<img>` lack `width`/`height`** → CLS (`home-gallery.tsx:110,229`); `placed-homes.tsx:38` does it right — inconsistent.
- **A4 — `icons.tsx` SVGs never set `aria-hidden`** (mostly harmless; decorative icons should be hidden).

## Dead code / stale / doc drift

- **D2 · P2 (operationally risky) — `DEPLOY.md` + `README.md:8` describe Vercel, not Cloudflare.** `DEPLOY.md` is an end-to-end *Vercel* guide (vercel.com, Vercel dashboard secrets, GoDaddy→Vercel DNS); the real pipeline is `opennextjs-cloudflare deploy` to Workers (`package.json:14`, `wrangler.jsonc`), secrets in Cloudflare (`.env.example`). **An operator following `DEPLOY.md` would deploy to the wrong platform and set secrets in the wrong place.** Highest-value doc fix.
- **D1 · P2 — Stale GitHub-Pages/Vercel comments + dead `BASE_PATH`.** `asset.ts:1-4` describes a removed GitHub-Pages export; `NEXT_PUBLIC_BASE_PATH` is never set → `asset()` is now an identity function. `lead.ts:33-39` docblock claims the mailto fallback exists for "the static GitHub Pages export" — that deploy is gone; mailto now only fires on 5xx/network error. Misleading.
- **D3 · P3 — `attribution-tracker.tsx:6-8` comment says it mounts "via the footer"** — it's actually mounted in `site-header.tsx:8,16`. Behavior fine, comment stale.
- **D4 · P3 — `scripts/build-champion-exteriors.mjs:10` hardcodes `/tmp/champ_need.json`** (one-off manual-scrape path; non-reproducible for anyone else).
- **Leftover template assets** in `public/` (`vercel.svg`, `next.svg`, `window.svg`, `globe.svg`, `file.svg`) — dead Next starter files; safe to delete.

## Config & dependency risks

- **C1 · P2 — CSP permissive by necessity.** Ships Report-Only (intentional gate). When enforced, `img-src https:` + `frame-src https:` are wide open — forced by R1 (images) + S3 (tours); `script-src` includes `'unsafe-inline'` (GA/JSON-LD) + unpkg (R2). **Tightening is blocked on R1 + R2** — another reason those are keystone fixes.
- **C2 · P3 — Pinning.** `next` 16.2.9 + `react` 19.2.4 exact-pinned (good, matches the AGENTS.md "not the Next you know" caution). Carets on `@opennextjs/cloudflare`, `marked ^18`, `wrangler`. **Consider pinning `marked`** — a caret minor could change tokenization the regex sanitizer assumes. `package-lock.json` committed → CI deterministic; risk only on next `npm install`.
- **C3 · P3 — `wrangler.jsonc compatibility_date 2024-12-30`** is oldish for Next 16 / OpenNext 1.19; confirm against OpenNext's recommended date. Flags (`nodejs_compat`, `global_fetch_strictly_public`) look correct.
- **C4 · P2 (by design) — static-JSON-edited-by-redeploy:** every inventory/blog/pricing change needs a full rebuild+deploy. The Admin-UI/D1 migration on the roadmap (Phase 1) is the right long-term answer.

## Priority quick-reference

| # | Finding | Sev |
|---|---|---|
| R1 | Mirror ~950 hotlinked CDN images (unlocks CSP tightening + perf) | **P1** |
| B2 | `onError` fallback on hotlinked images | **P1** |
| R2 | Self-host Leaflet (drop unpkg runtime script) | **P1** |
| D2 | Rewrite `DEPLOY.md`/`README` for Cloudflare (not Vercel) | P2 |
| B1 | `http://` → `https://` image | P2 |
| B5 | Sitemap `lastModified` from content | P2 |
| D1 | Purge stale GH-Pages/Vercel comments + dead `BASE_PATH` | P2 |
| A1/A2 | 44px hamburger; `aria-pressed` on brand/width tabs | P3 |
| B3/B4 | Double-submit guard + phone `pattern` on 5 forms | P3 |
| S4 | Gate GA to prod; drop no-op `anonymize_ip` | P3 |


<div style="page-break-before: always;"></div>

---

# Lead-Flow & Conversion Audit

*Traces the full lead journey and flags where leads/attribution/visibility can break.
Confirmed against code 2026-07-09. Opinions labeled.*

## The journey, end to end (confirmed)

```
Visitor
  → first-touch attribution captured to localStorage      (lib/attribution.ts)
  → lands on a page, sees CTA
      • Call:  tel: link (37 across the site)              (grep tel: = 37)
      • Text:  ✗ NONE (0 sms: links)                        (grep sms: = 0)
      • Form:  1 of 5 forms                                (components/*form*, email-capture)
  → submitLead(type, data)                                 (lib/lead.ts)
      → POST /api/lead  (attribution attached)             (api/lead/route.ts)
          → validate (422 if missing name/phone; email for subscribe)
          → deliverToFub()  — event + person + tags + source (+ warranty routing)
          → deliverByEmail() — Resend team email (if key set)
          → always console.log; if BOTH fail → CRITICAL LEAD_NOT_DELIVERED
      → GA4 generate_lead event                            (lib/analytics.ts)
  → on-page confirmation state ("Thanks — we've got it")
  → follow-up happens inside Follow Up Boss (automations live in FUB, not code)
```

**This pipeline is genuinely well-built** — retries w/ backoff, E.164 phone normalization
to maximize FUB merge, safe warranty routing that never steals an owned lead, first-touch
attribution on every form, and a no-silent-loss marker. Credit where due. The gaps below
are mostly at the **edges** (ops config, visibility, consent, missing paths), not the core.

## Lead types today (confirmed — `route.ts:33`)

`contact` · `financing` · `subscribe` · `service`. **No `seller`/`landowner` type.**

---

## Where leads can be LOST

| # | Risk | Detail | Severity |
|---|---|---|---|
| L1 | **Unwatched failure marker** | `CRITICAL LEAD_NOT_DELIVERED` (`route.ts:540-545`) is the last-resort net, but **no alert is wired to it** (`LAUNCH-READINESS.md:46`, `TODO.md`). If secrets are unset/invalid at go-live and Resend is off, *every* lead becomes an unread log line. | **P0 (ops)** / NEEDS ACCESS |
| L2 | **No bot/spam protection** | `/api/lead` has payload/field caps but **no honeypot, rate-limit, or captcha**. Spam floods FUB and buries real leads; also skews GA `generate_lead`. | **P1** |
| L3 | **Double-submit → duplicate events** | All 5 forms only disable the *button* while sending (`disabled={status==="sending"}`); Enter-key resubmit isn't blocked and there's **no `if(status!=="idle")return` guard** (open in `TODO.md`). FUB merges the *person* by email/phone, but duplicate **events/tasks** can still be created. No idempotency key on the request. | **P2** |
| L4 | **5xx → mailto fallback can dead-end** | On a 5xx/network error `submitLead` opens a `mailto:` (`lead.ts:61-67`). On mobile with no configured mail app it silently no-ops — though the UI does tell the user "didn't open? call." Acceptable, but a durable server-side outbox (KV/Queue) would be safer than relying on the client. | **P2** |
| L5 | **localStorage blocked → attribution lost** | First-touch is client-side only (`attribution.ts`). Private mode / blocked storage → lead arrives with no source. Minor; inherent to the approach. | **P3** |

## Where ATTRIBUTION can break

- **First-touch only** (by design, `attribution.ts:1-7`). A visitor who first arrives
  "direct" then converts via a paid click is credited "direct." Reasonable tradeoff; just
  know last-touch/multi-touch isn't captured. (P3 / NEEDS JOE if paid ads scale.)
- **No offline-conversion loop back to Google/Meta.** `gclid`/`fbclid` are captured and
  passed to FUB, but there's no export of *closed* deals back to Ads/Meta for
  conversion-optimized bidding. Big lever once ad spend starts. (P2 opportunity — see
  seo-content-opportunities + backend-opportunities.)
- **No GA4 ↔ FUB stitching** (no client_id/user_id joined to the CRM record). (P3.)

## Where STAFF may not know what happened

- **All visibility lives in FUB. There is no in-app admin/dashboard** (no DB, no auth).
  If a FUB Lead Flow/automation isn't configured for a given `source`/`tag`, a lead can
  land quietly on a timeline with no human alert. HANDOFF already flags *"verify a FUB
  Lead Flow rule exists for the `subscribe` tag"* — treat that as a live gap. **NEEDS JOE
  / NEEDS ACCESS** to confirm FUB automations for every source: `hplacer.com`,
  `Home Placer Warranty`, and each tag. (P1 to verify.)
- The unwatched `LEAD_NOT_DELIVERED` marker (L1) is the extreme version of this.

## Where the CUSTOMER may not get confirmation

- On-page confirmation states are good (every form). **But there is no automated
  email/SMS *receipt to the customer*** — Resend only emails the *team*
  (`route.ts:419-423`). A buyer who submits at 11pm gets an on-screen message and then
  silence until someone calls. An autoresponder would set expectations and reduce "did it
  go through?" anxiety. **Customer-facing email/SMS needs Joe's explicit approval**
  (standing rule) → PARKING LOT / NEEDS JOE, not a silent build.

## Wrong-type-of-lead & owner/seller separation

- **Buyer vs. financing vs. service** are cleanly separated by `type` + tags + routing. Good.
- **Landowner/seller has no path.** There's no `seller`/`landowner` lead type, no intake
  page, no distinct routing. A landowner wanting to *sell* land to HP would have to use the
  generic contact form and self-describe in free text — and would be tagged like a buyer.
  When the seller path is built, give it its **own `type` + tag + FUB routing** so owner
  opportunities don't get worked like buyer leads. (P2 opportunity; NEEDS JOE on timing.)
- **Note the buyer "landowner" language is different:** all on-site "already have land?"
  copy (`land-packages`, `financing-form`, `homes/[slug]`) targets a *buyer who owns a lot*,
  not a *seller offering land*. Don't confuse the two in the build queue.

## Bad-lead (tenant/renter) risk — LOW, with one watch item

- Site content **actively repels** the leased-land/rental audience (education pages argue
  *owning* land beats a land-lease park; "We've never put a family on leased land, and we
  never will" — `data/blog-posts.json`). This is on-message and good.
- **One watch item:** the Forturro **"Browse all listings"** button
  (`forturro-land-search.tsx:39` → `site.forturro.searchUrl`) is an *unfiltered* MLS search,
  unlike the land-only deep link beside it. If `search.forturro.com` surfaces rentals, an HP
  visitor could land on rental inventory and generate a rental inquiry (on the Forturro
  side, not HP's CRM — but still off-message). **NEEDS JOE:** confirm what that search shows;
  consider pointing "Browse all" to *for-sale-only* (and land-first). (P2.)

## Consent capture — inconsistent (compliance overlap)

| Form | Consent line | Collects |
|---|---|---|
| contact | "By submitting, you agree to be contacted by Home Placer about your inquiry." (`contact-form.tsx:112`) | name, phone, email |
| want-this-house | same line (`want-this-house-form.tsx:112`) | name, phone, land notes |
| financing | *no "agree to be contacted"*; "No credit pull… We'll call…" (`financing-form.tsx:110`) | name, phone, email |
| service-request | *no consent line found* | name, phone, address |
| email-capture | "No spam — unsubscribe anytime." (`email-capture.tsx:37`) | email |

- **Inconsistent + no privacy-policy link** (no `/privacy` route exists). For phone
  contact, TCPA-style **express consent to call/text** is the safer standard, ideally the
  same sentence on every form with a link to a privacy policy. Detailed in
  `compliance-review-flags.md`. **P1 (compliance) to standardize.**

## Quick wins (build-ready, pending approval)

1. **Add click-to-text** (`sms:` CTA) next to click-to-call — *if the sales line is
   SMS-capable* (NEEDS JOE to confirm). Manufactured-home buyers skew text-first. (P2)
2. **Standardize consent** copy across all 5 forms + link a privacy policy. (P1)
3. **Add a honeypot field + light rate-limit** to `/api/lead`. (P1)
4. **Add `if(status!=="idle")return`** double-submit guard to all 5 forms. (P2)
5. **Wire an alert** to `CRITICAL LEAD_NOT_DELIVERED` before traffic. (P0 ops)
6. **Build a `seller`/`landowner` intake** with its own type/tag/routing (later). (P2)


<div style="page-break-before: always;"></div>

---

# Backend / Admin Opportunities

*What internal systems Home Placer should eventually have — evaluated, not built.
Grounded in the current system (no DB/auth/admin; FUB is the CRM; static-JSON-by-redeploy)
and the locked roadmap (`ROADMAP.md`, `DECISIONS.md` D-HP-001…005). 2026-07-09.*

## The one framing that governs everything here

Two decisions Joe already locked shape every recommendation below:

1. **D-HP-002 — launch-readiness *before* platform build.** Finish Phase 0, get pricing +
   marketing live, and let **real traffic/conversion data** decide the backend scope. So the
   honest answer for most items below is **"useful later — trigger = validated demand,"** not "now."
2. **The CRM already exists — it's Follow Up Boss.** Leads, pipeline, tasks, notes, activity log,
   collaborators, and follow-up automations live in FUB today (`/api/lead` feeds it well).
   **Do not rebuild the CRM in-app.** Build in-house backend only for what FUB *can't* do
   (inventory, packages/quotes, construction/permit/delivery tracking, customer portal, reporting
   that spans FUB + inventory + ads).

Everything is also bound by the platform charter (`CLAUDE.md` / D-021): keep HP's data/CRM
boundary its own; reuse Forturro *patterns*, not internals.

## Scorecard

Legend — **Urgent** (do at/around launch) · **Useful later** (real value, gated behind Phase 1
or validated demand) · **Parking lot** (premature/duplicative now) · **Do not build** (would
duplicate FUB or is a distraction).

| System | Verdict | Business value | Complexity / risk | Depends on |
|---|---|---|---|---|
| **Missed-lead alerting** (wire `CRITICAL LEAD_NOT_DELIVERED` → email/Slack; durable KV/Queue outbox) | **Urgent** | Prevents silent lead loss — the one gap between "resilient" and "safe" | Low (Logpush/Tail or a Worker Queue binding) | Cloudflare access |
| **Admin UI to edit inventory + pricing without deploy** | **Useful later (Phase 1, highest backend ROI)** | Kills the redeploy bottleneck; lets pricing go live + stay fresh; non-engineers manage content | Medium (needs D1 + auth + API first) | D1, Auth, API |
| **Database (D1) as system of record** | Useful later (Phase 1 spine) | Everything downstream consumes it | Medium–High | — (foundation) |
| **Unified Auth + RBAC** (employees/customers/vendors) | Useful later (Phase 1, foundational) | Unlocks admin, portals, saved quotes, documents, audit | Medium | D1 |
| **Versioned `/api/v1/*` service layer** | Useful later (Phase 1) | Business logic behind API; site becomes one client | Medium | D1, Auth |
| **Home-model / land / lot / package inventory managers** | Useful later (Phase 1 admin) | Real availability, no "call for" gating, price history | Medium | D1, Admin |
| **Package Builder** (land→utilities→septic→foundation→home→upgrades→delivery→payment→proposal) | Useful later (**Phase 2 flagship**) | Highest conversion ROI; the core product per D-HP-005 | **High** | Phase 1 complete |
| **Financing estimator** (FHA/VA/USDA — education, not advice) | Useful later (Phase 2) | Answers the #1 buyer question before they call; qualifies leads | Medium (+ **compliance review** — see C-3/C-8) | API; legal review |
| **Quote / proposal generation** | Useful later (Phase 2) | Speeds sales; professional artifact | Medium | Package builder |
| **Lender / preapproval tracker** | Useful later (Phase 3) | Visibility into financing stage; fewer stalls | Medium | D1, CRM link |
| **Permit / septic-well-utility / order / delivery-setup / inspection-CO / closing trackers** | Useful later (Phase 3–4) | **Where a land-home dealer actually bleeds time** — coordination across county, installer, lender, surveyor | High (multi-party workflow) | D1, Auth, API |
| **Document checklist + storage** | Useful later (Phase 4) | Fewer dropped docs at closing; customer + staff share one list | Medium | D1, Auth |
| **Internal task system / staff assignment / notes / activity log** | **Do not build (use FUB)** | FUB already does this | — | — |
| **Lead dashboard / customer pipeline / buyer status tracker** | **Do not build now (use FUB)** | Duplicates FUB pipeline; build only the *inventory/construction* views FUB lacks | — | — |
| **Customer portal** (saved homes/quotes, docs, messaging, build status) | Useful later (Phase 4) | Trust + fewer status calls; differentiator | High | Auth, D1, trackers |
| **Owner / seller / landowner intake** | **Useful sooner — light** | Captures the stated future lead type; it's a *form + FUB tag*, not heavy backend | **Low** (a page + form + distinct FUB routing) | **NEEDS JOE: define the offer** |
| **CRM sync depth** (FUB webhooks back, dedupe, offline-conversion export to Ads/Meta) | Useful later | Lets ad platforms optimize on *closed deals*, not just form-fills | Medium | Ad accounts, FUB API |
| **Reporting dashboard** (leads × source × stage × inventory) | Parking lot | GA4 + FUB reports cover it until volume justifies custom | Medium | Data volume |
| **Advertising / source-attribution dashboard** | Parking lot | First-touch already flows to FUB; custom dashboard premature pre-spend | Medium | Ad spend + data |
| **SMS / email follow-up automation** | Parking lot — **needs approval + compliance** | Real value, but Joe's standing rule = explicit approval; TCPA/consent gate (C-2) | Medium | Consent framework, Joe |
| **Review-request workflow** | Parking lot — **needs approval** | Grows the thin GBP review count (the real local-SEO lever) | Low–Medium | Joe, GBP |

## Recommended sequencing (honest)

1. **Around launch (ops, not a platform):** missed-lead alerting; set secrets; verify FUB
   automations exist for every source/tag. Add the **landowner intake** once Joe defines the offer —
   it's cheap and serves a stated goal.
2. **Phase 1 (only once traffic/conversion data justifies it):** D1 → Auth/RBAC → `/api/v1` →
   **Admin UI for inventory + pricing**. This is the keystone: it ends the redeploy bottleneck and is
   the prerequisite for everything else.
3. **Phase 2:** Package Builder + financing estimator + quotes (highest conversion ROI; the flagship).
4. **Phase 3–4:** construction/permit/delivery/closing trackers + document checklist + customer portal
   — the operational depth that actually saves staff time in this business.

## What NOT to build (and why)

- **A second CRM / lead dashboard / task system in-app** — FUB already does leads, pipeline, tasks,
  notes, activity, collaborators. Rebuilding it is the classic time-sink. Integrate; don't replace.
- **A custom analytics/attribution dashboard before ad spend** — GA4 + FUB suffice until there's
  volume; the higher-value move is the **offline-conversion loop back to Ads**, not a dashboard.
- **Any customer-facing SMS/email automation without explicit approval + a consent framework**
  (Joe's standing rule + compliance C-2).
- **Multi-tenant / multi-dealer SaaS architecture** — explicitly out of scope (D-HP-001). Keep the
  data model clean enough to add later; don't pay the tax now.


<div style="page-break-before: always;"></div>

---

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


<div style="page-break-before: always;"></div>

---

# Compliance / Risk Review Flags

*Prepared by an engineer acting as a compliance-risk reviewer — **NOT legal advice.**
Every item is **flagged for a human reviewer** (legal / lender / broker / dealer-licensing),
not a directive to change copy. "CONFIRMED" = verbatim from code; interpretation labeled.
Confirmed 2026-07-09.*

## P0 — Address before / at launch

### C-1 · No Privacy Policy or Terms page exists — **P0**
CONFIRMED: no `privacy`/`terms`/`legal`/`cookie`/`disclaimer` route in `src/app` or `public`
(grep-verified). Footer has only a copyright + "Homes shown are representative" line
(`site-footer.tsx:136-140`). Meanwhile the site collects name/phone/email/address/free-text
(`api/lead/route.ts:50-60`), forwards to Follow Up Boss + Resend, captures UTM/gclid/fbclid/
referrer (`route.ts:37-48`, `attribution.ts`), and runs GA4 on every page. **Why it matters:**
a lead-gen site collecting PII + running analytics with no published privacy policy / data-use
disclosure / cookie notice is a baseline gap (state privacy statutes, Google Ads policy,
CAN-SPAM). **Reviewer: legal (privacy).** *(Also blocks Google Ads — Ads requires a privacy policy.)*

### C-2 · Contact consent is fine-print only — no TCPA/SMS consent — **P0**
CONFIRMED: contact + want-this-house forms carry one sentence, "By submitting, you agree to be
contacted by Home Placer about your inquiry." (`contact-form.tsx:112`, `want-this-house-form.tsx:112`).
The **financing form has no consent line** ("No credit pull… We'll call…" only,
`financing-form.tsx:110`); **email-capture** has only "No spam — unsubscribe anytime."
(`email-capture.tsx:37`). Phone is **required** on 4 forms and CTAs say "Call or text (843)
849-HOME" (`page.tsx:164`). **Why it matters:** for autodialed/prerecorded calls or texts, the
passive fine print lacks a checkbox, express written consent, "msg & data rates / reply STOP"
language, and a policy link — classic TCPA/SMS exposure, and entirely absent on financing +
subscribe. **Reviewer: legal (TCPA/telemarketing).** (Overlaps lead-flow-audit consent table.)

## P1 — Review before / soon after launch

### C-3 · Financing "$0 down" / USDA / VA / FHA program claims — **P1**
CONFIRMED: "$0-down options…" (`financing/page.tsx:10`), "$0 down for veterans" (`:22`), "As low
as 3.5% down" (`:27`), "A lot of Horry County qualifies for USDA $0-down" (`:69`). **Mitigant
(good):** bottom disclaimer "Home Placer is not a lender; we connect buyers with third-party
lenders. All financing subject to credit approval." (`:107-111`), and most claims are hedged.
**Why it matters:** headline chips read unconditional next to the program name; qualifiers sit in
body copy. Advertising specific financing terms can implicate Reg Z / MLO-advertising rules even
for a non-lender referrer. **Reviewer: lender / mortgage-compliance.**

### C-4 · Warranty page contradicts every other page (1-yr vs "2-10") — **P1**
CONFIRMED: `/warranty` claims "Every Home Placer home is covered: a full 1-year warranty… plus a
2-10 Home Buyers Warranty backing your systems for 2 years and structure for 10." (`warranty/page.tsx:9-11,26-34`).
Every other surface advertises **only 1 year** — `site.ts:91` "A limited one-year warranty plus a
30-day walk-through", homepage chip "1-year warranty" (`page.tsx:68`). **Why it matters:** "Every…
home is covered" + specific 2/10-yr figures tied to a **named third-party product** are firm
guarantee representations. Verify (a) HP actually enrolls every home in 2-10 HBW, (b) the durations
& systems/structure scope match the real policy, (c) who backs each layer. **Reconcile the
1-yr-vs-2-10 inconsistency.** **Reviewer: dealer / legal (warranty).**

### C-5 · "Licensed" claims — no license number; SC **and** NC asserted — **P1**
CONFIRMED: footer "Licensed manufactured-home dealer, Horry County, SC." (`site-footer.tsx:138`);
homepage "Licensed in SC & NC" (`page.tsx:68,154`); metadata claims Brunswick & Columbus NC
(`layout.tsx:20-21`); `site.ts:94-95` "Licensed SC dealer… not a broker." **No license number
appears anywhere.** **Why it matters:** licensure claimed repeatedly (incl. NC, a separate regime)
with no number; SC/NC dealer-advertising rules can require the number on ads. Confirm SC **and** NC
licenses are active and whether the number must be shown. Verify "dealer" (not "broker") is accurate
for all activity incl. land. **Reviewer: dealer-licensing (SC + NC).** (Overlaps website-audit P1 claim + NC-"SC" bug.)

### C-6 · "Recently Placed" presents MLS closed sales as HP's own placed/sold homes — **P1**
CONFIRMED: "{n} homes Home Placer has placed and sold…" (`recently-placed/page.tsx:29-34`); footer
"Closed sales across the Coastal Carolinas MLS. Photos are of real Home Placer homes." (`:105-107`);
per-home "Closed sale · Coastal Carolinas MLS" + **street address + sold price** (`[slug]:114,121-127`);
JSON-LD publishes each address+geo as "placed and sold by Home Placer" (`jsonld.tsx:178-282`); the
case-study blog lists specific closed prices/dates. Source = Coastal Carolinas MLS/Paragon
(`sold-homes.json`, `paragon-sold.csv`). **Why it matters:** (a) **accuracy** — every home labeled
"placed and sold" by HP must be an actual HP transaction, not just an MLS record HP can see;
(b) **MLS/IDX data-use & attribution** — republishing closed-sale addresses/prices/photos may need
specific MLS permission/attribution. **Reviewer: broker / MLS compliance + dealer.**

### C-7 · "7 Google reviews" advertised, only 3 on site — **P1**
CONFIRMED: `site.ts:40-44` `reviewCount 7, rating 5.0` but `reviews.ts` has **3** review objects.
UI renders "5.0 · 7 Google reviews" with only 3 cards, each "Verified Google review"
(`testimonials.tsx:31-52`); footer "★ 5.0 on Google (7 reviews)" (`site-footer.tsx:48`); JSON-LD
asserts `reviewCount:7` to search engines while embedding 3 (`jsonld.tsx:77-89`). **Why it matters:**
the 7-vs-3 gap and the aggregateRating must match the **live GBP** at all times or the claims are
unsubstantiated (FTC review-substantiation + schema-accuracy). `reviews.ts` correctly uses verbatim/
attributed reviews ("never invent testimonials") — keep count+rating synced to live GBP.
**Reviewer: legal / marketing-compliance.** (Also website-audit P2 + technical B6.)

## P2 — Review when practical

- **C-8 · Estimated-monthly-payment offers** in lead flows ("See your price & monthly payment",
  `page.tsx:142-148`; land-packages `:238`; home detail `:281-283`; want-this-house auto-message
  `:35`). No numeric APR/payment published (lower risk), but quoting payments — even privately — can
  pull specific figures into Reg Z trigger-term / MLO territory for a non-lender. **Reviewer: lender/Reg Z.**
- **C-9 · "Apply for financing"** button/heading (`financing-form.tsx:107`, `financing/page.tsx:80`)
  on a form that (per its own comment) collects **no** SSN/income/credit. Calling it "apply" could be
  read as taking a credit application (ECOA/Reg B). Consider a softer verb. **Reviewer: lender/legal.**
- **C-10 · "Every… home… qualifies"** (`financing/page.tsx:49-54`) blurs *property* qualification
  (titled real property) with *borrower* qualification (still program-dependent). Matches Joe's
  standing position; a lender may want a "borrower/loan approval separate" hedge. **Reviewer: lender.**
- **C-11 · Fair Housing** — concentration of "family"/"family-first" selling frames in town copy
  (`locations.ts:181,128`) + a testimonial citing "the perfect neighborhood" (`reviews.ts:16`). Most
  are neutral place/product descriptions; worth a Fair-Housing pass on town copy + testimonial choice
  (familial-status steering is what reviewers scan for). **Reviewer: legal (Fair Housing).**
- **C-12 · GA4 with no consent gate** (`layout.tsx:67`, `analytics.tsx`) — ties to C-1. `anonymize_ip`
  is a partial (and in GA4, no-op) mitigant; no cookie/consent mechanism or disclosure. **Reviewer: legal (privacy).**
- **C-13 · RESPA / affiliated business** — dealer routes homebuyers to sister KW brokerage "The
  Forturro Group" via UTM referral (`site.ts:51-59`, `forturro-land-search.tsx`). No fee evident in
  code, but the affiliation is explicit; if any value flows for the referral, affiliated-business-
  arrangement / RESPA disclosure may apply. **Reviewer: broker / legal (RESPA).** (P2/P3.)

## Looks FINE (verified — no action)

- **Wall-finish wording is correct** — "pre-finished gypsum panels" (`manufactured-home-drywall-vs-wall-strips/page.tsx:18,73`, `home-types.ts:10`); no interior finish called "vinyl/VOG." (The "Vinyl" strings in `models.json` are *exterior siding colors*.) Matches Joe's standing correction.
- **"Not a lender" disclaimer** present on financing page, 2 FAQs, and financing blog posts (though **not on the financing form itself** — see C-2/C-9).
- **Mobile-vs-manufactured HUD/legal distinction accurate** (pre/post-June-15-1976, HUD code). Minor nit: homepage still markets "mobile home dealer" as SEO bait while content says you can't buy a new mobile home (accuracy nit, P3).
- **Pricing consistently hedged** ("from the low $200s" paired with "varies by model, size, lot"; footer "Pricing and availability subject to change").
- **Family-land / heirs'-property blog handles legal boundaries well** ("We can't give you legal advice… It's a legal question, not a sales question").
- **No rental / property-management / landlord-services wording anywhere** (grep-confirmed) — only the Forturro land *search* (C-13). Tenant/renter compliance risk is effectively nil.

## Suggested triage order

1. **C-1 (privacy/terms) + C-2 (TCPA consent)** — foundational; touch every form + visitor; also gate Google Ads.
2. **C-4 (warranty 1-yr vs 2-10), C-5 (license #/NC), C-6 (MLS "placed & sold" accuracy), C-7 (7-vs-3 reviews)** — concrete, verifiable factual claims.
3. **C-3 / C-8–C-10** — financing-advertising language, batched for the lender/Reg Z reviewer.
4. **C-11–C-13** — Fair Housing pass, analytics consent, RESPA affiliation.

*Nothing above is legal advice — each item is for the indicated reviewer to confirm.*


<div style="page-break-before: always;"></div>

---

# Business / Opportunity Review

*Direct opinion on what Home Placer is missing, based on the actual business. Blunt by
request — if something's a bad idea, it says so. Opinion throughout, grounded in the audit.*

## The honest one-paragraph read

Home Placer already has the thing most manufactured-home dealers never build: a genuinely
good website that educates a nervous first-time buyer and captures the lead cleanly. The
engineering is above the bar for this industry. **The company is not held back by its website
code — it's held back by three business inputs that only Joe can supply: prices, a privacy/
consent layer, and a decision about the landowner/seller line.** Fix those and the existing
site will convert materially better. Everything else is optimization.

## What's actually blocking conversion right now

1. **No prices.** Every one of 93 homes says "Call for pricing" (`setup-pricing.json`/
   `home-pricing.json` = `{}`). The price sort/filter is built and dormant. This is the single
   biggest conversion drag — buyers self-select out when they can't gauge affordability. The
   machinery is ready; it needs numbers. **NEEDS JOE.**
2. **No privacy policy / consistent consent.** Beyond the legal exposure (compliance C-1/C-2),
   this **blocks Google Ads** (Ads requires a privacy policy) — so the paid-traffic lever is
   locked until it's fixed. **P0.**
3. **The landowner/seller line doesn't exist.** The business says it wants these leads; the site
   has no page, form, or route for them, and they'd currently land as generic buyer leads. It's a
   cheap build (a page + form + FUB tag) **once Joe decides the offer.** **NEEDS JOE.**

## What buyers need explained before they call (and how the site does)

The site is strong here — this is its best asset. Covered well: manufactured vs modular vs
site-built vs mobile, drywall vs strips, FHA/VA/USDA/conventional on owned land, septic/well/
permits, the 6-step timeline, "no HOA / own the land." **Gaps:** a single **first-time-buyer
"start here" hub** (the education is excellent but scattered across footer links), and a
**browsable "what's available now"** (everything routes to a call).

## The objections that stop people from becoming leads — and whether the site answers them

| Buyer objection | Answered? | Where / gap |
|---|---|---|
| "Is a manufactured home cheap/temporary junk?" | ✅ Strong | comparison + drywall + brand pages |
| "Will it hold value / can I really finance it?" | ✅ Strong | financing page ("real property… same loans") |
| "What will it actually cost me?" | ❌ **No** | "Call for pricing" everywhere — the big gap |
| "Can I afford the monthly payment?" | ⚠️ Partial | promised after a call; no on-site estimator (Phase 2) |
| "What about land, septic, permits — is this a nightmare?" | ✅ Good | FAQ + land-packages + per-county facts |
| "Are these guys legit / licensed?" | ⚠️ Partial | says "licensed" but shows no license #, only 3 reviews shown, one off-message |
| "How long does it take?" | ✅ Good | `/process` |

## What would make Home Placer look more trustworthy (cheap wins)

- **Show the dealer license number(s)** in the footer/About (NEEDS JOE for the number). "Licensed"
  with no number is weaker than "SC MH Dealer Lic. #XXXX."
- **Show all real Google reviews, not 3 of 7,** and lead with product-relevant ones (drop the
  Realtor-sounding testimonial). Then **run a review-request workflow** to grow past 7 — review
  count is the real local-pack lever, and 7 is thin.
- **Reconcile the warranty story** (1-year everywhere vs "2-10" on `/warranty`) — a contradiction a
  sharp buyer will notice, and a substantiation risk (C-4).

## What staff probably waste time explaining repeatedly (→ automate later)

- **Financing eligibility** ("can I get FHA/VA/USDA on this?") → a Phase-2 **financing estimator**
  (education, not advice) qualifies and pre-answers.
- **"What's my all-in price?"** → publish pricing now; **Package Builder** later.
- **Status of an in-flight deal** (permit, septic, delivery, closing) → Phase-3/4 trackers +
  customer portal cut the "where are we?" calls.
- **Septic/permit/timeline basics** → already offloaded to content (good); keep feeding the blog.

## What would help close more deals

- Prices on-site (self-qualification) · a real "available now" list (urgency) · click-to-text for a
  text-first audience · an autoresponder that sets expectations after a form (needs approval) ·
  offline-conversion export so ad dollars optimize on closings, not form-fills.

## What should NOT be built (distractions)

- **A second CRM / lead dashboard in-app** — FUB already does it. (See backend-opportunities.)
- **A custom attribution/reporting dashboard before there's ad spend + volume.**
- **Customer-facing SMS/email automation without approval + a consent framework.**
- **Multi-dealer SaaS** — out of scope (D-HP-001); don't architect for it now.
- **A tenant/renter search or any rental workflow** — off-strategy; the site correctly repels this
  audience today. Don't add it. (Only watch item: the Forturro "Browse all listings" link — see
  lead-flow-audit / questions-for-joe.)
- **Chasing the "mobile home" SEO term into rent/park intent** — the current approach (capture the
  high-volume term, pivot the page to ownership) is right; don't build rent-oriented pages for it.

## Roadmap opinion (agree / adjust)

The locked roadmap (Phase 0 harden → Phase 1 DB/Auth/API/Admin → Phase 2 sales tools → Phase 3–4 ops
+ lifecycle) is **sound and correctly sequenced.** Two adjustments:

1. **Don't start Phase 1 on a calendar — start it on data.** Per D-HP-002, let live pricing + real
   traffic prove demand first. The temptation to build the platform before validating conversion is
   the main risk to guard against.
2. **Pull two cheap, high-value items forward out of "Phase 1+":** the **landowner intake** (a form,
   not a platform) and the **privacy/consent layer** (unblocks Ads). Both are days of work and
   unlock disproportionate value.

## Bottom line

The build quality is not the problem. The company's growth is currently gated by **business
inputs (pricing, consent/privacy, the seller-line decision)** far more than by features. Ship those,
show the license number and real reviews, and let the resulting traffic tell you whether the
platform build is worth starting. Resist building a backend that duplicates Follow Up Boss.


<div style="page-break-before: always;"></div>

---

# Approved Build Queue

> ⛔ **NOTHING HERE IS APPROVED YET.** Per the audit's operating rules, this file stays a
> **candidate** list until Joe explicitly moves an item into "Approved." A rough idea in this
> folder is **not** a build task. No feature work starts until Joe says go.

**How an item graduates:** Joe reviews the candidates below (and `questions-for-joe.md`),
answers any gating question, and changes an item's **Status** from `PROPOSED` to `APPROVED —
<date>`. A future Claude build session should build **only** `APPROVED` rows, top of the list first.

## Candidate queue (PROPOSED — recommended order)

Each row is scoped to be build-ready. Full detail lives in the linked audit doc.

| # | Item | Sev | Status | Gated by | Source |
|---|---|---|---|---|---|
| 1 | **Wire an alert to `CRITICAL LEAD_NOT_DELIVERED`** (Logpush/Tail → email/Slack, or a Worker Queue outbox) | P0 | PROPOSED | A1 (Cloudflare) | lead-flow L1 |
| 2 | **Privacy Policy + Terms pages + standardized form consent** (drafted w/ legal; link from footer + all 5 forms) | P0 | PROPOSED | J10 + legal | compliance C-1/C-2 |
| 3 | **Fix NC towns labeled ", SC"** — `getCounty(loc.countyKey)?.stateAbbr` at `locations/[slug]:77,175`, `site-footer:128`, `land-packages:105` | P1 | PROPOSED | J3 (confirm NC scope) | website P1 / SEO-1 |
| 4 | **Resolve the "Licensed in SC & NC" claim** — verify NC license; show license number(s); reconcile copy | P1 | PROPOSED | J3, J4 | website P1 / compliance C-5 |
| 5 | **Reconcile the warranty story** (1-yr vs 2-10) across all pages to the verified truth | P1 | PROPOSED | J5 | compliance C-4 |
| 6 | **Add `onError` placeholder fallback to all hotlinked `<img>`** | P1 | PROPOSED | — | technical B2 |
| 7 | **Sync reviews** — show all real GBP reviews; make `reviewCount`/rating match live GBP; drop off-message testimonial | P1 | PROPOSED | J6 | compliance C-7 / website |
| 8 | **Add a honeypot + light rate-limit to `/api/lead`** (spam protection) | P1 | PROPOSED | — | lead-flow L2 |
| 9 | **Landowner/seller intake page + form + distinct FUB tag/routing** | P1 | PROPOSED | J2 (define offer) | website P1 / SEO / lead-flow |
| 10 | **Rewrite `DEPLOY.md` + `README.md` for Cloudflare** (currently describe Vercel) | P2 | PROPOSED | — | technical D2 |
| 11 | **Fix the `http://` model image → `https://`** (`dutch-elite-1676-01`) | P2 | PROPOSED | — | technical B1 |
| 12 | **Add `FAQPage` schema to `/land-packages`; `ItemList` to `/homes`** | P2 | PROPOSED | — | SEO-2/SEO-4 |
| 13 | **Nav: surface education + locations; add a sticky "Get your price" CTA** | P2 | PROPOSED | — | website P2 |
| 14 | **Internal-link pass** — Loris/Longs/Aynor into footer; location↔money-page + blog↔topical links | P2 | PROPOSED | — | SEO internal-linking |
| 15 | **Add click-to-text (`sms:`)** next to click-to-call | P2 | PROPOSED | J7 | website P3 / lead-flow |
| 16 | **Sitemap `lastModified` from content; purge stale GH-Pages/Vercel comments + dead `BASE_PATH`** | P2/P3 | PROPOSED | — | technical B5/D1 |
| 17 | **Mirror ~950 hotlinked manufacturer images to R2/`public`** (unlocks CSP tightening + perf) | P1 (large) | PROPOSED | — | technical R1 |
| 18 | **Self-host Leaflet** (drop unpkg runtime script) | P1 | PROPOSED | — | technical R2 |
| 19 | **Form polish** — double-submit guard + phone `pattern` on all 5; 44px hamburger; `aria-pressed` on brand/width tabs; gate GA to prod | P3 | PROPOSED | — | technical B3/B4/A1/A2/S4 |

## Approved (empty)

*(No rows yet. Joe moves items here.)*

---

*Backend/platform items (D1, Auth, API, Admin UI, Package Builder, trackers, portal) are **not**
in this queue — they're Phase 1+ and gated on validated demand (D-HP-002). See
`backend-opportunities.md` and `parking-lot.md`.*


<div style="page-break-before: always;"></div>

---

# Parking Lot — Not Now

*Ideas that are real but deliberately deferred. Kept here so they're not lost and not
mistaken for approved work. Each notes *why* it's parked and *what would un-park it*.*

| Idea | Why parked | Un-parks when |
|---|---|---|
| **Customer-facing SMS/email autoresponder** (confirmation after a form) | Standing rule: customer messaging needs explicit approval; TCPA/consent gate (C-2) | Joe approves + consent framework + privacy policy exist |
| **Review-request workflow** (grow past 7 GBP reviews) | Needs approval; light but customer-facing | Joe approves; GBP access |
| **Package Builder** (guided land→home→payment→proposal) | Phase 2 flagship; requires the Phase 1 platform (D1/Auth/API) first | Phase 1 shipped + traffic validates demand |
| **Financing estimator** (FHA/VA/USDA education, not advice) | Phase 2; needs API + a compliance pass on payment/rate language | Phase 1 + legal review of C-3/C-8 |
| **Construction / permit / septic / delivery / inspection / closing trackers** | Phase 3–4 operational depth; multi-party workflow | Core platform exists; volume justifies it |
| **Document checklist + storage; customer portal** | Phase 4; requires Auth + trackers | Phase 1–3 shipped |
| **Custom reporting / attribution dashboard** | GA4 + FUB reports suffice until there's volume + ad spend | Real ad spend + data volume |
| **Offline-conversion export to Google Ads / Meta** (optimize on closings) | High-value, but only matters once paid campaigns run | Paid ads live + FUB→Ads pipeline |
| **Last-touch / multi-touch attribution** | First-touch is enough today | Paid channels scale and need it |
| **Modulars catalog** | Deferred by Joe (education page done, inventory not built — HANDOFF §5) | Joe reactivates |
| **Self-hosted / SLA map tiles** (replace direct OSM) | Fine at current traffic (technical R4) | Traffic grows enough to matter |
| **Multi-tenant / multi-dealer SaaS** | Explicitly out of scope (D-HP-001) | HP decides to sell the platform to other dealers |
| **Promote CSP Report-Only → enforcing** | Blocked on mirroring hotlinked images + self-hosting Leaflet first (R1/R2) | Those two land + a few days of clean violation reports |

*Nothing here is scheduled. Moving an item off the parking lot is Joe's call.*


<div style="page-break-before: always;"></div>

---

# Questions for Joe

*Decisions and access blockers that gate the work. Grouped: business decisions (NEEDS JOE),
access blockers (NEEDS ACCESS), and external human reviewers (legal/lender/broker).*

## NEEDS JOE — business decisions

| # | Question | Why it matters / what it unblocks |
|---|---|---|
| J1 | **Send pricing numbers** (setup-price + optional home-only price per model). | Every home shows "Call for pricing"; the price sort/filter is built and dormant. **Biggest single conversion unlock.** Loader is hardened — drop numbers into `data/setup-pricing.json`. |
| J2 | **Landowner/seller offer — what is it?** Buy land outright? JV/develop? List it via Forturro? | Determines whether/how to build the `/sell-your-land` page, its form, and FUB routing. The lead type you say you want has **zero** path today. |
| J3 | **Are you licensed in NC (Brunswick/Columbus)?** | Homepage claims "Licensed in SC & NC" but the source of truth says SC only. If not licensed in NC → downgrade the copy (compliance C-5). If yes → provide the number. |
| J4 | **SC (and NC) dealer license number(s) to display.** | "Licensed" with no number is a weaker trust signal and may be required by dealer-advertising rules. |
| J5 | **Warranty reality: 1-year, or the "2-10 Home Buyers Warranty" (2yr systems / 10yr structure)?** | `/warranty` claims 2-10; every other page says 1-year. Contradiction + substantiation risk (C-4). Need the accurate scope + who backs each layer. |
| J6 | **Provide the remaining real Google reviews** (site shows 3 of 7) + confirm live GBP rating/count. OK to drop the Realtor-sounding testimonial? | UI + schema advertise "7 reviews / 5.0★" with only 3 shown (C-7). Keep claims synced to live GBP; lead with product-relevant reviews. |
| J7 | **Is the sales line (843) 849-HOME SMS-capable?** | If yes, add real click-to-text (0 `sms:` links today; CTAs say "call or text" but all dial). Manufactured-home buyers skew text-first. |
| J8 | **Confirm every "Recently Placed" home is an actual HP transaction**, and that republishing MLS closed addresses/prices/photos is permitted. | Data comes from Coastal Carolinas MLS/Paragon; "placed and sold by Home Placer" is a firm claim + an MLS data-use question (C-6). |
| J9 | **Forturro "Browse all listings" — does that search show rentals?** Should it be for-sale-only? | The unfiltered cross-over link could expose HP visitors to rentals (off-message; possible bad-lead on the Forturro side). The land-only deep link is safe. |
| J10 | **Approve building the privacy/consent layer** (privacy policy + terms + standardized form consent, drafted with legal). | Legal exposure (C-1/C-2) **and** it's a hard requirement for Google Ads — paid traffic is locked until this exists. |
| J11 | **Later: approve customer-facing SMS/email autoresponder + review-request workflow?** | Parked pending explicit approval (your standing rule) + consent framework. |
| J12 | **Confirm the trigger to start Phase 1 backend = real traffic/conversion data** (not a date). | Matches D-HP-002. Guards against building the platform before validating conversion. |

## NEEDS ACCESS — blocked by missing credentials/admin

| # | Access | Needed for |
|---|---|---|
| A1 | **Cloudflare account** (Home Placer) | Wire missed-lead alerting (Logpush/Tail or a Queue outbox); set/verify Worker secrets (`FUB_API_KEY` etc.); promote CSP; HSTS. **The alerting is the top ops item.** |
| A2 | **Follow Up Boss** | Verify Lead Flow automations exist for every source/tag (`hplacer.com`, `Home Placer Warranty`, `subscribe`) so no lead lands silently on a timeline. |
| A3 | **Google Search Console + GA4** (carolina@hplacer.com) | Validate which town/blog pages actually rank; find query gaps; confirm the NC-"SC" pages aren't already suppressed. |
| A4 | **Google Business Profile** | Confirm categories ("Manufactured home dealer") + NC service-area; grow the review count (the real local-pack lever). |
| A5 | **MLS / IDX (CCAR RESO) feed** | Build a real "available now" inventory page — the current `mlsCollabUrl` is a static collab share, not a feed. |
| A6 | **Bing Places PIN / Apple Business Connect** | Finish the local listings (per HANDOFF — your items). |
| A7 | **Domain registrar** (Priced Right Domains) | Finish hplacer.com → Cloudflare Registrar transfer, then enable HSTS preload. |

## External reviewers (route the compliance flags)

Not access — human dependencies. See `compliance-review-flags.md` for the full list.

- **Legal (privacy/TCPA/Fair Housing):** privacy policy + terms, standardized consent (C-1, C-2, C-11, C-12).
- **Lender / mortgage-compliance:** financing-ad language, "$0 down" chips, "apply", payment estimates (C-3, C-8, C-9, C-10).
- **Dealer-licensing (SC + NC):** license claims + numbers (C-5), warranty substantiation (C-4).
- **Broker / MLS + RESPA:** "placed & sold" accuracy + MLS data use (C-6); Forturro affiliated-business referral (C-13).
