# 01-OVERVIEW.md

## Executive Summary

**Home Placer** is a licensed manufactured-home and land dealer in Horry County, South Carolina, serving the Grand Strand and southeastern North Carolina (Horry & Georgetown counties, SC; Brunswick & Columbus counties, NC). The website (hplacer.com) is a Next.js 16 App Router application deployed to Cloudflare Workers via OpenNext, serving as the primary marketing and lead-capture vehicle for a business that pairs brand-new Clayton, Cavco, and Champion manufactured homes with land into single packages, priced from the low $200s.

**Current stage:** Production-live with full feature set deployed. The site is SEO-optimized for "manufactured homes in [city/county]," integrates with Follow Up Boss for lead routing, publishes blog content on a fixed 2×/week cadence via automation, and includes 93 model inventory pages, 73 recently-placed home detail pages with Leaflet map integration, 36 published blog posts (queue through ~Aug 6), full drywall filter/badge, real Google reviews, OG link-preview with home photo, and cross-referral to sister company's land-search tool (Ylopo MLS integration).

**Major completed milestones:**
- Full Next.js 16 SSG+SSR build on Cloudflare Workers + custom domains (hplacer.com, www)
- 93 model detail pages (Clayton, Cavco, Champion) with gallery, floor plans, virtual tours
- 73 recently-placed homes + geotagged Leaflet map with click-through detail pages
- 27 city/town landing pages (all four counties) with county-specific financing & permitting facts
- 36 SEO blog posts with date-gated publishing (queue drips at 2/week via scheduled task + deploy)
- Lead capture → Follow Up Boss (FUB /v1/events) + first-touch attribution tracking
- Search infrastructure: Google Search Console (verified), Bing Webmaster, IndexNow (live)
- Real Google Business Profile reviews (5.0★, 7 reviews) in homepage testimonials + JSON-LD
- Drywall badge + filter (51 full-drywall models identified in series mappings)
- OG link-preview image (real placed home photo, base64-inlined for Workers runtime)
- Forturro cross-over (homepage + land-packages + footer links to Ylopo land search, deep-linked)

**Major unfinished work:**
- **Pricing:** all 93 models show "Call for pricing" — `data/home-pricing.json` and `data/setup-pricing.json` are empty `{}`. When Joe provides pricing, sort/filter UI (already built) activates.
- **Domain registration transfer** (PAUSED): hplacer.com registration moving from Priced Right Domains → Cloudflare Registrar (DNS already Cloudflare; no site disruption). Auth code + domain privacy toggle pending.
- **Bing Places PIN verification** (PAUSED): claimed under carolina@hplacer.com; Joe to verify via SMS to unlock fields.
- **Apple Business Connect** (PARKED): awaiting Joe's Apple ID recovery.
- **Blog queue refill:** ~12 more posts needed by Aug 6 to maintain 90-day cadence (Gemini's plan = 36 posts total).
- **Modulars catalog** (deferred): educational page live; inventory/models not built.

---

## Project Overview

### Every Application & Page Route

The site is built around a hierarchical route structure under `src/app` with both static pages and dynamic slug-based detail pages:

| Route | Type | Purpose | Source File |
|-------|------|---------|-------------|
| `/` | Page | Homepage (hero, value props, featured homes, testimonials, CTA) | `src/app/page.tsx` |
| `/homes` | Page | Filterable browser (brand, width, beds, sqft, price, drywall toggle) + search | `src/app/homes/page.tsx` |
| `/homes/[slug]` | Dynamic | 93 model detail pages (spec, gallery, floor plan, tour URL, description) | `src/app/homes/[slug]/page.tsx` |
| `/brands` | Page | Brand comparison (Clayton, Cavco, Champion) with series breakdowns | `src/app/brands/page.tsx` |
| `/land-packages` | Page | Land-buying explainer + Forturro cross-over link | `src/app/land-packages/page.tsx` |
| `/recently-placed` | Page | 73 placed homes + Leaflet map with interactive markers | `src/app/recently-placed/page.tsx` |
| `/recently-placed/[slug]` | Dynamic | Detail page per placed home (price, photos, geotagged gallery, story) | `src/app/recently-placed/[slug]/page.tsx` |
| `/locations` | Page | All 27 city/town landing pages listed + search | `src/app/locations/page.tsx` |
| `/locations/[slug]` | Dynamic | 27 city pages (intro, county facts: wind/utilities/permits/USDA, highlighted homes) | `src/app/locations/[slug]/page.tsx` |
| `/financing` | Page | FHA / VA / Conventional loan explainer (requirements, down payment, mortgage insurance) | `src/app/financing/page.tsx` |
| `/process` | Page | How it works (home selection → financing → delivery → closing) | `src/app/process/page.tsx` |
| `/warranty` | Page | 1-year manufacturer warranty + Home Buyers Warranty info + service request form | `src/app/warranty/page.tsx` |
| `/faq` | Page | 23 Q&As (manufactured vs site-built, financing, delivery, land, permitting, warranty) | `src/app/faq/page.tsx` |
| `/gallery` | Page | Photo gallery (19 full-color images in hero layout, all homes on display) | `src/app/gallery/page.tsx` |
| `/glossary` | Page | 30+ term definitions (HUD code, USDA loan, drywall, manufactured home, chattel, etc.) | `src/app/glossary/page.tsx` |
| `/blog` | Page | Blog index + search (36 posts, newest first, tag filters) | `src/app/blog/page.tsx` |
| `/blog/[slug]` | Dynamic | 36 published blog posts (date-gated; future-dated posts hidden until publish date) | `src/app/blog/[slug]/page.tsx` |
| `/manufactured-vs-site-built` | Page | Educational (construction, codes, financing, resale, durability comparison) | `src/app/manufactured-vs-site-built/page.tsx` |
| `/modular-vs-manufactured-homes` | Page | Educational (code, customization, timeline, cost breakdown) | `src/app/modular-vs-manufactured-homes/page.tsx` |
| `/mobile-home-vs-manufactured-home` | Page | Educational (terminology, regulations, financing, modern standards) | `src/app/mobile-home-vs-manufactured-home/page.tsx` |
| `/manufactured-home-drywall-vs-wall-strips` | Page | Educational (interior wall finish types, cost, durability, aesthetics) | `src/app/manufactured-home-drywall-vs-wall-strips/page.tsx` |
| `/about` | Page | Company story (15+ years, licensed dealer, multi-county service area) | `src/app/about/page.tsx` |
| `/team` | Page | 6-person team (photos, roles: Joe/ownership, Brett/warranty, sales reps, admin) | `src/app/team/page.tsx` |
| `/contact` | Page | Contact form + office hours + map (lead type: general inquiry) | `src/app/contact/page.tsx` |
| `/service-request` | Page | Service/warranty form for existing homeowners (lead type: service; routed to warranty team) | `src/app/service-request/page.tsx` |

**Special routes:**
- `/api/lead` — POST endpoint for unified lead intake (contact, financing, subscribe, service) → FUB + Resend email
- `/llms.txt/route.ts` — Markdown manifest for LLM tools (site summary, inventory counts, featured posts)
- `/robots.ts` — Allows all crawlers (explicitly welcomes AI bots: GPTBot, ClaudeBot, PerplexityBot)
- `/sitemap.ts` — Dynamic XML sitemap (all static pages + 93 models + 73 placed homes + 27 locations + 36 posts)

---

### Every Service & Backend Handler

| Service / Handler | Purpose | Location | Tech |
|---|---|---|---|
| **Lead Intake API** | Unified form backend for website leads (contact, financing, subscribe, service) | `src/app/api/lead/route.ts` (POST) | Next.js Route Handler, Node runtime |
| **Follow Up Boss Integration** | Lead delivery via FUB /v1/events API (auto-person merge by email/phone); service routing + task creation | `src/app/api/lead/route.ts` | HTTP POST to `https://api.followupboss.com/v1/events` & `/v1/people/{id}` & `/v1/tasks` |
| **Resend Email Backup** | Optional lead email delivery (team notification) | `src/app/api/lead/route.ts` | HTTP POST to `https://api.resend.com/emails` (optional, no key = skipped) |
| **Google Analytics 4** | Traffic tracking (GA4 Measurement ID `G-0T71PWYQSQ`, owned by carolina@hplacer.com) | `src/components/analytics.tsx` | gtag / Gtag global |
| **IndexNow Submission** | Auto-notification to Bing/Yandex/DuckDuckGo of live URLs (runs post-deploy, especially for blog) | `scripts/indexnow.mjs` | HTTP POST to `https://api.indexnow.org/indexnow` |
| **Build Manifests** | Pre-build script generating JSON file lists (galleries, location images) for static import | `scripts/build-manifests.mjs` | Node.js fs, writes to `data/gallery-manifest.json` & `data/locations-manifest.json` |
| **Cloudflare Workers Runtime** | Full Next.js 16 App Router SSR + SSG via OpenNext | Deployed via `npm run deploy` | Wrangler + OpenNext, custom domains |

---

### Every Frontend Surface & Page Component

**Core layout:**
- `src/components/site-header.tsx` — Navigation bar (10 main links), logo, mobile menu
- `src/components/site-footer.tsx` — Footer (resource links, social icons, address, hours, warranty phone, Forturro cross-over link)

**Homepage sections:**
- Page hero with tagline, phone CTA, featured homes carousel
- 4 value props (No HOA, bundled package, 1-year warranty, licensed dealer)
- Real Google reviews testimonials (5.0★ from 3 named customers)
- Email capture form (lead type: "subscribe")

**Home pages:**
- `src/components/homes-browser.tsx` — Interactive filterable interface (filters: brand, width, beds, sqft, price range, drywall toggle; search box; sort by name/sqft; displays cards per filter)
- `src/components/home-card.tsx` — Single model card (thumb, name, brand, beds/baths, sqft, price CTA)
- `src/components/home-gallery.tsx` — Model detail gallery (carousel, lightbox zoom, floor plan section)
- `src/components/floor-plan-section.tsx` — Embedded floor plan image + link
- `/homes/[slug]/page.tsx` uses gallery component + virtual tour embed (Momento360)

**Recently-placed:**
- `src/components/placed-homes.tsx` — Card list of 73 sold homes (thumb, address, beds/baths, price, MLS, "View home" CTA)
- `src/components/placements-map.tsx` — Leaflet map (OSM tiles, geotagged markers for all 73 homes, click → detail page)
- `/recently-placed/[slug]/page.tsx` detail page (full gallery, geotagged photos, address, price, MLS, layout spec)

**Forms (all route to `/api/lead`):**
- `src/components/contact-form.tsx` — Name, phone, email, message; lead type: "contact"
- `src/components/email-capture.tsx` — Email only; lead type: "subscribe"
- `src/components/financing-form.tsx` — Name, phone, email, interested-home dropdown, has-land toggle, address, message; lead type: "financing"
- `src/components/service-request-form.tsx` — Name, phone, email, issue description, address; lead type: "service"
- `src/components/want-this-house-form.tsx` — Quick "I want this home" popup (name, phone, email, interested-home preselected); lead type: "contact"

**Other:**
- `src/components/analytics-events.tsx` — GA4 event dispatcher (page views, form submits, outbound clicks)
- `src/components/attribution-tracker.tsx` — Captures first-touch UTMs/referrer/gclid to localStorage; forwarded to `/api/lead`
- `src/components/forturro-land-search.tsx` — Embeds or links to Forturro's Ylopo land search (deep-linked, Horry County land-only)
- `src/components/testimonials.tsx` — Renders real Google reviews with stars + author
- `src/components/zoom-image-modal.tsx` — Lightbox for gallery images

---

### Every API (Internal & External Integrations)

| API | Endpoint | Purpose | Auth | Headers / Notes |
|---|---|---|---|---|
| **Website lead intake** (internal) | `POST /api/lead` | Captures forms (contact, financing, subscribe, service) + validates + routes to FUB & Resend | None (same-origin forms) | JSON body: name, phone, email, type, attribution |
| **Follow Up Boss /events** | `POST https://api.followupboss.com/v1/events` | Creates/merges person + event in FUB; auto-merge by email or E.164 phone | `Basic ${base64(key:)}` | Env var: `FUB_API_KEY` (Cloudflare Worker secret) |
| **Follow Up Boss /people/{id}** | `PUT https://api.followupboss.com/v1/people/{id}` | Assigns new service/warranty contacts to warranty owner + collaborators (safe: never reassigns existing owners) | Basic auth | Only on 201 (new person); 200 (existing) is left untouched |
| **Follow Up Boss /tasks** | `POST https://api.followupboss.com/v1/tasks` | Creates warranty task on every service request (guarantees follow-up regardless of ownership) | Basic auth | Warranty owner: 39 (Brett, configurable); collaborators: 1,35,46 (Joe, Tara, Wade) |
| **Resend email delivery** | `POST https://api.resend.com/emails` | Optional team email backup (if `RESEND_API_KEY` set) | Bearer `${key}` | Env var: `RESEND_API_KEY` (optional); sends to `leads@hplacer.com` (configurable) |
| **IndexNow ping** | `POST https://api.indexnow.org/indexnow` | Notifies Bing/Yandex/DuckDuckGo of live URLs; runs post-deploy & on blog publish | Key file + POST body | Host: hplacer.com, key: e0e445eaf75d61f3faee17b699eca3b9 (file: `public/e0e445eaf75d61f3faee17b699eca3b9.txt`) |
| **Google Search Console** | Web UI at search.google.com | Verified domain + submitted sitemap; owned by carolina@hplacer.com | OAuth (carolina@hplacer.com) | Tracks impressions, clicks, CTR; identifies indexing issues |
| **Bing Webmaster Tools** | Web UI at bing.com/webmaster | Imported hplacer.com; monitors Bing crawl health | OAuth (carolina@hplacer.com) | Parallel to GSC for Bing's view |
| **Leaflet / OpenStreetMap** | Tile API via CDN | Map tiles for recently-placed homes (read-only, no auth needed) | None | Library: leaflet.js + leaflet-css; tiles: {s}.tile.openstreetmap.org |
| **Momento360 virtual tours** | Embedded iframes | 3D walkthroughs of select models (Momento360 urls stored in models.json .tourUrl) | None (embedded) | URLs like `https://momento360.com/e/uc/[id]?...` |
| **Google Business Profile** | Web UI + JSON-LD embed | Real reviews (5.0★, 7 reviews) + location card; CID 3461988553332431879 | Owned by carolina@hplacer.com | JSON-LD fed into opengraph-image + homepage testimonials |
| **Forturro Ylopo search** | Deep-linked redirect | Cross-company lead funnel for land-only buyers (returns them as Ylopo captures on Forturro's side) | UTM tracking | Deep link: `search.forturro.com/search/map?s[propertyTypes][0]=land&s[locations][0][county]=Horry&s[locations][0][state]=SC` |

---

### Every Database & Data Store

All data is **static JSON**, edited by hand, compiled at build time into the server bundle. No database, no CMS, no incremental build revalidation (yet).

| File | Lines | Records | Schema | Used By |
|---|---|---|---|---|
| `data/models.json` | 3,880 | 93 models | slug, brand, series, name, modelCode, widthFt, lengthFt, sqft, beds, baths, description, imageUrls, tourUrl, floorPlans, wallFinish, bestSeller, sourceUrl, aka | `/homes` browser, `/homes/[slug]` detail, sitemap, llms.txt; **manually edited** (never re-run build-models.mjs) |
| `data/placed-homes.json` | 3,344 | 73 homes | slug, mls, address, town, townSlug, beds, baths, style, withLand, price, lat, lon, photo, photos[] | `/recently-placed` browser, `/recently-placed/[slug]` detail, placements map, sitemap |
| `data/placements.json` | 784 | ~73 entries | slug, lat, lon | Leaflet map markers (recently-placed page); generated from placed-homes.json via script |
| `data/blog-posts.json` | 608 | 36 posts | slug, title, description, date (ISO yyyy-mm-dd), readMinutes, tags, bodyMarkdown | `/blog` index, `/blog/[slug]` detail, date-gating (future posts hidden), sitemap, llms.txt |
| `data/home-pricing.json` | 1 | empty `{}` | `{ [slug]: price }` | Price display on `/homes/[slug]`, card CTAs (empty = "Call for pricing") **TODO: fill when Joe provides** |
| `data/setup-pricing.json` | 1 | empty `{}` | `{ [slug]: setupPrice }` | Setup/installation cost (separate from home price); merge shown in total | **TODO: fill** |
| `data/gallery-manifest.json` | 19 | image filenames | `["01.jpg", "02.jpg", ...]` | `/gallery` page (imported at build, no runtime fs) |
| `data/locations-manifest.json` | 25 | slug → filenames map | `{ [slug]: ["01.jpg", ...] }` | Location detail pages (hero images per town) |
| `data/galleries.json` | 1,884 | Mixed (models + placed) | slug → { photos[], allUrls[] } | Gallery rendering (model detail pages, recently-placed detail) |
| `data/mls-listings-active.json` | 18 | MLS listings | Paragon CCAR export (active homes) | Collaborator share link only; not yet feed-integrated |
| `data/community.json` | 37 | Metadata | siteUrl, analytics, company address | Dev config (mostly unused) |
| `data/sold-homes.json` | 919 | Historical sales | slug, price, date | Archive/reporting only (not displayed on site) |
| `data/_models-raw.json` | 3,104 | Raw extraction | Unprocessed Clayton/Cavco/Champion data | **Source:** build scripts read this; never edit directly |
| `data/_cavco-extra.json` | 133 | Extra Cavco specs | Supplement to raw data | Merged during build-models.mjs (deferred, don't run) |
| `data/_clayton-new.json` | 404 | Recent Clayton adds | Supplement | Same |
| `data/_new-homes-raw.json` | 0 | Empty | Placeholder | Reserved for future feeds |
| `data/galleries-raw.json` | 0 | Empty | Placeholder | Reserved for future photo workflows |

**Important constraints:**
- `models.json` is hand-edited and **production critical.** Never re-run `scripts/build-models.mjs` — it omits tourUrl, floorPlans, and other hand-finalized fields. Edit the JSON directly.
- Pricing files stay empty (`{}`) in dev/staging; Joe fills them when pricing is finalized. Site gracefully shows "Call for pricing" until then.
- Blog date-gating is evaluated at **build time:** future-dated posts are included in the bundle but hidden via `lib/blog.ts` getter. A redeploy after the publish date surfaces them.

---

### Every External Integration & Third-Party Service

| Service | Account | Purpose | Status | Notes |
|---|---|---|---|---|
| **Cloudflare** | Home Placer (account_id: 6caa351d57b30bd04cec8a08e4330ffd) | DNS, Workers (app host), R2 (reserved), Page Rules, Edge Certificates | Live | Nameservers: barbara/gabriel.ns.cloudflare.com; custom domains: hplacer.com + www |
| **Cloudflare Registrar** | Home Placer | Domain registration (future) | PAUSED | hplacer.com registration transfer in progress (currently at Priced Right Domains / GoDaddy reseller) |
| **Priced Right Domains** | carolina@hplacer.com | Current registrar | Live | Wild West Domains / GoDaddy reseller; portal: dcc.secureserver.net; lock OFF, ready for transfer |
| **Follow Up Boss** | Team account | CRM + lead routing + task management | Live | FUB_API_KEY stored as Cloudflare Worker secret; warranty routing rules configured in FUB (Brett = owner 39, Joe/Tara/Wade = collaborators 1,35,46) |
| **Resend** | Optional | Email delivery for lead backups | Not configured | RESEND_API_KEY not set (optional, skipped if missing); could send leads to leads@hplacer.com |
| **Google Analytics 4** | Property G-0T71PWYQSQ | Traffic metrics, conversion tracking | Live | Account: carolina@hplacer.com; GA4 tag embedded in `src/components/analytics.tsx`; tracks page views + form submissions + outbound clicks |
| **Google Search Console** | hplacer.com property | Indexing + SEO monitoring | Live | Domain verified; sitemap submitted; Bing clicks imported; owned by carolina@hplacer.com |
| **Bing Webmaster Tools** | hplacer.com property | Bing crawl health, indexing | Live (partial) | Imported; Bing Places claimed but awaiting SMS PIN verify (carolina@hplacer.com) |
| **Bing Places for Business** | carolina@hplacer.com | Local listing card (Bing Search, Maps) | Claimed, awaiting PIN verify | Status: "Verify now" email sent; Joe to enter SMS PIN (843) 849-4663 to unlock fields |
| **Apple Business Connect** | Not yet | Local listing (Apple Maps place card) | Parked | Needs Apple ID sign-in; Joe currently locked out; redirects to business.apple.com |
| **Gemini (Google AI)** | joe@forturro.com | SEO/geo review pass (top engineer prompt) | Ad-hoc | Used when building new pages; Gemini session logged in browser; feedback stored in memory (feedback_seo_geo_gemini.md) |
| **Ylopo search** | Forturro (sister company) | Land-only MLS search cross-over | Live | Deep-linked from hplacer.com (homepage, /land-packages, footer); Ylopo captures lead on Forturro's side; UTM tracking keeps attribution clean |
| **Momento360** | Embedded iframes | Virtual home tours | Live | URLs stored in models.json (.tourUrl); embedded on `/homes/[slug]` detail pages; read-only, no auth |
| **OpenStreetMap + Leaflet.js** | Public tiles | Map rendering for placed homes | Live | Open-source, no auth needed; Leaflet library + OSM {s}.tile.openstreetmap.org tiles |
| **GitHub** | homeplacer/hplacer-website | Source control | Live | Working branch: `first-touch-attribution`; deploys build from working tree (not git HEAD); ~60 uncommitted files as of 2026-07-01 |
| **IndexNow network** | hplacer.com key | Search engine URL submissions (Bing, Yandex, DuckDuckGo, Seznam) | Live | Key: e0e445eaf75d61f3faee17b699eca3b9; ownership file: `public/e0e445eaf75d61f3faee17b699eca3b9.txt`; runs post-deploy + on blog publish via `scripts/indexnow.mjs` |

---

### Every Automation (Recurring Tasks)

| Task | Trigger | Action | Frequency | Status | Env |
|---|---|---|---|---|---|
| **Blog auto-publish** | Scheduled (Claude scheduled task `hplacer-blog-publish`) | (1) Redeploy via `npm run deploy`; (2) Ping IndexNow via `scripts/indexnow.mjs`; surfaces any date-gated posts whose date has arrived | **Mon & Thu @ 6 AM** (2/week) | Live through ~Aug 6 | ~/.claude/scheduled-tasks/ (must recreate on new machine) |
| **IndexNow URL submission** | Manual post-deploy OR automated on blog publish | POST all live URLs (from sitemap.xml) to IndexNow API | After any deploy or blog publish | Live | scripts/indexnow.mjs (can run standalone: `node scripts/indexnow.mjs`) |
| **Build manifests** | Pre-build (wired into `predev`, `prebuild`, `deploy` scripts) | Scans `public/gallery/` and `public/locations/` for image files; writes `data/gallery-manifest.json` and `data/locations-manifest.json` | Every dev/build/deploy | Live | scripts/build-manifests.mjs |
| **GA4 page tracking** | Browser (client-side) | Logs page view + UTM params to GA4 | Every page load | Live | `src/components/analytics.tsx` + gtag global |
| **Attribution capture** | Browser (client-side) | Captures first-touch UTMs/referrer/gclid to localStorage; persists across session | Every landing page visit | Live | `src/lib/attribution.ts` + `src/components/attribution-tracker.tsx` |
| **Form submissions → FUB** | User submits form (contact, financing, subscribe, service) | POST to `/api/lead`, which delivers to FUB /v1/events (person merge, tags, warranty routing) + optional Resend email | On demand | Live | `src/app/api/lead/route.ts` |
| **Warranty task creation** | Service request form submitted | FUB POST to /v1/tasks; warranty owner (39) + collaborators (1,35,46) notified | On demand (service requests) | Live | `src/app/api/lead/route.ts` lines 218–281 |

---

### Development & Deployment Flow

**Local dev:**
```bash
npm install
npm run dev              # Runs Next.js dev server on :3000, auto-rebuilds on file change
```

**Build & preview (local simulation of prod):**
```bash
npm run preview          # Builds for Cloudflare Workers (OpenNext), runs local preview on :3000
```

**Deploy to Cloudflare Workers:**
```bash
npm run deploy           # Runs build-manifests.mjs → opennextjs-cloudflare build → opennextjs-cloudflare deploy
                         # Deploys .open-next/worker.js + .open-next/assets/ to Cloudflare account
```

**Key build mechanics:**
- `scripts/build-manifests.mjs` runs as a `prebuild` hook, generating image manifest JSONs before Next.js build
- `next.config.ts` conditionally enables static-export mode only when `PAGES_BUILD=1` env var is set (used for GitHub Pages fallback, not primary deployment)
- `open-next.config.ts` defines OpenNext behavior (pure SSR + SSG, no ISR/on-demand revalidation yet)
- `wrangler.jsonc` sets Cloudflare account, custom domains, assets binding (no env vars injected here; `FUB_API_KEY`, `RESEND_API_KEY` are set as Worker secrets in the Cloudflare console, not in repo)

**Deployment source of truth:** The working tree files, not git HEAD. After deploy, the built-manifest `.open-next/worker.js` is what runs on Cloudflare; git commits confirm changes but don't trigger deploys.

---

## Tech Stack & Infrastructure

| Layer | Tech | Version | Notes |
|---|---|---|---|
| **Framework** | Next.js | 16.2.9 | App Router (not Pages Router); breaking changes per AGENTS.md |
| **Runtime** | React | 19.2.4 | Client components default; server components for data loaders |
| **Styling** | Tailwind CSS | v4 | Brand = slate ramp, pink accents; @tailwindcss/postcss |
| **Deployment** | Cloudflare Workers | Current | Via @opennextjs/cloudflare v1.19.11 (no ISR/on-demand revalidation) |
| **Hosting** | Cloudflare | Current | Zone: hplacer.com (bbara/gabriel.ns.cloudflare.com); custom domains + Workers |
| **DNS** | Cloudflare | Current | Full Cloudflare setup; domain registration pending transfer from Priced Right Domains |
| **Type checking** | TypeScript | 5 | Strict mode; eslint v9 |
| **Markdown** | marked | 18.0.5 | Blog post rendering (no H1, use ##; no fs.readFileSync) |
| **Maps** | Leaflet.js | Latest CDN | OpenStreetMap tiles for placed homes |
| **Automation** | Claude scheduled tasks | Custom | hplacer-blog-publish runs Mon/Thu 6 AM (must recreate on new machine) |
| **Package manager** | npm | Current | package-lock.json checked in |

---

## Crucial Constraints & Gotchas

**See HANDOFF.md §7 for the full list; key highlights:**

1. **Cloudflare Workers have no runtime filesystem.** `fs.readFileSync` → HTTP 500 in prod + missing og:image. All file assets (OG hero, galleries, locations) must be statically imported or inlined as base64. The OG hero is inlined in `src/app/og-hero.ts`; build manifests are pre-generated.

2. **Never re-run `scripts/build-models.mjs`.** It omits hand-finalized fields (tourUrl, floorPlans, pricing adjustments, wallFinish corrections). Edit `data/models.json` directly instead.

3. **Blog date-gating is build-time.** A post with a future date is bundled but hidden until that date. A redeploy after the date surfaces it. The scheduled task exploits this for drip-feed publishing.

4. **JSX whitespace gotcha:** `</tag>text` strips the space. Use `{" "}after the closing tag if needed.

5. **City reassignments are canonical and must sync.** Rabbit Ln + Hwy 139 = Conway; Pint Circle = Longs. Both `data/placed-homes.json` (cards) and `data/placements.json` (map markers) must match on city changes.

6. **Domain privacy may block transfer.** Priced Right Domains has Domains By Proxy enabled; may need to toggle OFF before EPP code generation.

7. **Cloudflare throttles rapid concurrent crawls.** Transient 503s are not real errors; retry sequentially.

8. **Wall finish wording is strict:** wall strips = "pre-finished gypsum panels with a printed, wallpaper-like coating + batten strips" — NOT "vinyl" or "VOG". "Rock-vinyl skirting" on the gallery is correct.

9. **Financing line for all homes:** Every home sold WITH LAND qualifies for **FHA / VA / USDA / conventional** (real property, not chattel). Use this everywhere.

10. **Account rule for Home Placer:** All accounts live under `carolina@hplacer.com` (Google, Bing, Cloudflare registrar, etc.), NEVER Joe's Forturro `info@/joe@`. Learned the hard way when Bing was misattributed.

---

## Current Live State (Deployed & Active Features)

- ✅ Full site live (93 models, 73 placed homes, 27 city pages, 36 blog posts, 23 FAQs)
- ✅ Lead capture → FUB + first-touch attribution + warranty routing
- ✅ Blog auto-publish 2×/week (Mon/Thu) through ~Aug 6
- ✅ Google reviews (5.0★, 7 reviews) in homepage testimonials + JSON-LD
- ✅ Drywall badge + filter (51 models)
- ✅ OG link-preview (real home photo, base64-inlined)
- ✅ Forturro land-search cross-over (deep-linked, UTM-tracked)
- ✅ IndexNow live (pings on deploy + blog publish)
- ✅ SEO setup: GSC verified, Bing Webmaster imported, llms.txt, robots.txt, sitemap.xml
- ✅ HTTPS forced via middleware
- ✅ Leaflet map on /recently-placed (geotagged photos, detail pages)
- ⏳ Pricing (models show "Call for pricing"; filters dormant) — waiting for Joe
- ⏳ Domain transfer (PAUSED) — Priced Right → Cloudflare Registrar
- ⏳ Bing Places PIN verify (PAUSED) — SMS verification pending
- ⏳ Blog queue refill ~Aug 6 — need ~12 more posts for 90-day plan

---

This overview covers the complete, production-ready hplacer.com website as of 2026-07-01. For detailed session logs and feature evolution, see the memory files (`project_hplacer_rebuild.md`, `feedback_seo_geo_gemini.md`); for next-step actions, see HANDOFF.md §3–5.
