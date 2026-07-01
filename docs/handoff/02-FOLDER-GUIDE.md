# 02-FOLDER-GUIDE.md

## Folder Structure & Purpose

This is a **Next.js 16** (App Router) + **React 19** + **Tailwind v4** site deployed to **Cloudflare Workers via OpenNext**. The build produces static HTML + edge-runnable JS. Filesystem access is unavailable at runtime, so manifests are pre-generated during build.

### Repo Tree (top level, excluding `node_modules/.next/.open-next/out`)

```
hplacer/
├── src/                          # Source code (Next.js App Router)
│   ├── app/                       # Route groups + layout + special files
│   ├── components/                # Shared UI components
│   └── lib/                        # Utilities, data loaders, type defs
├── data/                          # Content: models, homes, blog, locations
├── public/                        # Static assets + generated manifests
│   ├── models/                    # ~30 model photo folders
│   ├── gallery/                   # Homepage gallery images
│   ├── locations/                 # Place detail images (6 towns)
│   ├── recently-placed/           # Sold homes by town + galleries
│   ├── team/                      # Staff headshots
│   ├── *.svg / *.png              # Logos, icons
│   └── *.txt                      # IndexNow ownership token
├── scripts/                       # Build & deploy helpers
├── gbp-bank/                      # Google Business Profile data (separate project)
├── HANDOFF.md                     # Session context + status (READ THIS FIRST)
├── package.json / next.config.ts  # Build config
├── open-next.config.ts            # Cloudflare Workers config
└── .wrangler/, .env.example       # Wrangler auth + secrets template
```

---

## `src/app/` — Routes & Layout

**Purpose:** Next.js App Router filesystem—every `.tsx` / `route.ts` file is a page or API endpoint.

### Root layout + special files

| File | Purpose | Notes |
|------|---------|-------|
| `layout.tsx` | Global wrapper + `<html>`, `<body>`, metadata | Imports SiteHeader, SiteFooter, EmailCapture, Analytics, JSON-LD. Metadata base-URL = site URL; keywords for manufactured-home SEO. |
| `page.tsx` | Homepage (`/`) | Hero, testimonials, gallery, featured models, Forturro land cross-link. |
| `opengraph-image.tsx` | Link-preview card (1200×630 PNG) | Renders hero home photo (inlined base64 from `og-hero.ts`) + brand lockup. **MUST NOT use `fs`** — workerd has no filesystem. |
| `og-hero.ts` | **GENERATED — DO NOT EDIT** | Base64-encoded hero photo (~276KB). Regenerate if hero photo changes: `sips resize 1200w q62 && base64 > og-hero.ts`. |
| `robots.ts` | `/robots.txt` | Allows all crawlers, including AI (GPTBot, ClaudeBot, PerplexityBot). |
| `sitemap.ts` | `/sitemap.xml` (dynamic) | Lists all ~130+ static + dynamic pages (homes, placed-homes, locations, blog). Last-modified = 2026-06-21. Includes geotagged images for placed-homes. |
| `llms.txt/route.ts` | `/llms.txt` (plain text) | Markdown manifest for LLM crawlers + Claude artifacts. Brand info, inventory stats, recent blog titles, key URLs. |

### Route groups (feature-driven folders)

| Folder | Pages | Purpose |
|--------|-------|---------|
| `homes/` | `/homes`, `/homes/[slug]` (93 dynamic pages) | Inventory browser (filters: brand, width, beds, sqft, price, drywall), detail pages with gallery, floor plans, specs, "call for pricing" fallback. |
| `recently-placed/` | `/recently-placed`, `/recently-placed/[slug]` (73 dynamic pages) | Sold homes index + individual detail pages; includes Leaflet map, photo galleries, MLS link, financing info. |
| `locations/` | `/locations`, `/locations/[slug]` (27 dynamic pages) | Geographic hubs (Conway, Loris, Longs, Aynor, Myrtle Beach, etc.); shows homes in that town, map, local photos. Canonical city assignments in HANDOFF.md. |
| `blog/` | `/blog`, `/blog/[slug]` (36 dynamic, date-gated posts) | Markdown-rendered articles; future-dated posts hidden until their date (scheduled publishing). `bodyMarkdown` has no H1; title renders separately. |
| `brands/` | `/brands` | Clayton / Cavco / Champion overview. |
| `land-packages/` | `/land-packages` | USDA/FHA/VA financing + land costs; cross-link to Forturro land search. |
| `financing/` | `/financing` | FHA vs. VA vs. conventional; lender directory. |
| `process/` | `/process` | 6-step home buying workflow. |
| `warranty/` | `/warranty` | 1-year warranty details. |
| `faq/` | `/faq` (23 Q&As) | FAQ page; data from `src/lib/faqs.ts`. |
| `gallery/` | `/gallery` | Image carousel (interior/exterior, development, lifestyle). |
| `glossary/` | `/glossary` | Terms (drywall, wall strips, chattel loan, etc.). |
| Educational pages | `/manufactured-vs-site-built`, `/mobile-home-vs-manufactured-home`, `/modular-vs-manufactured-homes`, `/manufactured-home-drywall-vs-wall-strips` | SEO content + buyer education. |
| `about/`, `team/`, `contact/`, `service-request/` | Admin pages | About Home Placer, staff bios, contact form, service request. |

### API routes

| Route | Purpose |
|-------|---------|
| `api/lead/route.ts` | Webhook for form submissions → Follow Up Boss (FUB) + optional Resend email backup. Headers: FUB_API_KEY (Worker secret), FUB_WARRANTY_USER_ID, etc. |

---

## `src/components/` — Reusable UI

**Purpose:** Shared React components used across pages. All are client components (`"use client"` or default).

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `site-header.tsx` | Navigation bar (`<header>`) | Sticky, mobile-responsive; logo, menu, phone CTA. |
| `site-footer.tsx` | Page footer | Address, phone, hours, links, social. |
| `page-hero.tsx` | Section hero (title + subtitle + CTA) | Reused on `/homes`, `/locations`, `/financing`, etc. |
| `home-card.tsx` | Model/home listing card | Image, beds/baths/sqft, price (or "Call"), drywall badge. |
| `home-gallery.tsx` | Image carousel (w/ lightbox) | Multiple photo arrays, zoom-on-click. |
| `homes-browser.tsx` | Filterable/sortable inventory grid | Filters: brand, width, beds, sqft, price, "full drywall". Search, sort. Large client component. |
| `placed-homes.tsx` | Recently-placed grid | Filters: town, price. |
| `placements-map.tsx` | Leaflet map of sold homes | Clustered markers, popup cards, lat/lon from `placements.json`. |
| `contact-form.tsx` | Contact form (email, message, phone) | Posts to `/api/lead`; validation. |
| `service-request-form.tsx` | Service/warranty request form | Brand, issue, description; posts to `/api/lead` with `source: "Home Placer Warranty"`. |
| `want-this-house-form.tsx` | "Want this home?" CTA on placed-home detail | Quick form to express interest. |
| `financing-form.tsx` | Financing pre-qualifier | Loan type, credit range, down payment; client-side calc. |
| `email-capture.tsx` | Newsletter signup modal (sticky) | Email → Resend mailing list (optional). |
| `floor-plan-section.tsx` | Display floor-plan PDFs/images | Fetches from model's `floorPlans` array. |
| `forturro-land-search.tsx` | Cross-link widget to sister company | search.forturro.com deep-link (land-only search). |
| `testimonials.tsx` | Google reviews carousel | Hard-coded 5-star + 7 reviews (5.0★ JSON-LD). |
| `analytics.tsx` | Google Analytics 4 injection | GA4 tracking ID `G-0T71PWYQSQ` (under carolina@hplacer.com account). |
| `analytics-events.tsx` | Event tracking (form submits, etc.) | Sends GA4 events. |
| `attribution-tracker.tsx` | First-touch attribution layer | Logs query params to localStorage for lead routing. |
| `width-context.tsx` / `width-selector.tsx` | Double-wide selector toggle | Shows/hides single-wide homes on `/homes` browser. |
| `zoom-image-modal.tsx` | Lightbox modal (click image to zoom) | Full-screen image viewer. |
| `icons.tsx` | SVG icon system | Reusable icon components (checkmark, arrow, beds, baths, etc.). |
| `jsonld.tsx` | JSON-LD structured data | LocalBusiness, Product (homes), Review, BreadcrumbList. |

---

## `src/lib/` — Data Loaders & Utilities

**Purpose:** Pure functions, type definitions, and data access. No React components here.

| Module | Exports | Purpose |
|--------|---------|---------|
| `homes.ts` | `getAllHomes()`, `getHome(slug)`, `bestSellerHomes()`, `formatPrice()`, `priceLabel()` | Loads `data/models.json` + pricing overrides; merges drywall badge status. |
| `home-types.ts` | Types: `Home`, `Brand`, `FloorPlan`, `WallFinish` | Shared types for models (so client components can import without the loader). |
| `placed-homes.ts` | `getAllPlacedHomes()`, `getPlacedHome(slug)`, `byTown()` | Loads `data/placed-homes.json` (73 sold homes). |
| `locations.ts` | `locations[]`, `counties{}`, `getLocation()` | Loads location data (27 geographic hubs: Conway, Loris, etc.). |
| `blog.ts` | `getAllPosts()`, `getPost(slug)`, `getScheduledPosts()`, `renderMarkdown()` | Date-gated blog; future-dated posts hidden until deploy date. Uses `marked` for MD→HTML. |
| `gallery.ts` | `getGalleryImages()` | Loads `data/gallery-manifest.json` (list of `/public/gallery/*.jpg`). |
| `asset.ts` | `asset(path)` | Prefixes asset paths (e.g., `/models/foo/01.jpg`). Used for image imports. |
| `reviews.ts` | Hard-coded 5-star reviews (7 reviews, 5.0★) | Google Business Profile reviews snapshot. |
| `team.ts` | Team member data (name, title, bio, photo) | Staff for `/team` page. |
| `faqs.ts` | FAQ entries (23 Q&As) | Questions for `/faq`. |
| `glossary.ts` | Glossary terms | Manufactured home terminology for `/glossary`. |
| `lead.ts` | `submitLead()` | Posts form data to `/api/lead`; FUB + Resend integration. |
| `analytics.ts` | GA4 event helpers | `trackEvent()`, `trackPageView()`. |
| `attribution.ts` | Attribution helpers | First-touch attribution from URL query params. |
| `jsonld.tsx` | `localBusinessLd()`, `productLd()`, `reviewsLd()` | JSON-LD schema generators (for `<head>`). |
| `site.ts` | `site` (config object) | Centralized site config: name, URL, phone, address, geo, tagline, email (carolina@hplacer.com). |

---

## `data/` — Content & Inventory

**Purpose:** JSON/CSV source files. **Edit directly** (except `_*.json` and manifests — those are generated).

### Primary data files (hand-edited)

| File | Format | Purpose | Size | Editable? |
|------|--------|---------|------|-----------|
| `models.json` | JSON array (93 items) | 🔑 **Inventory source**. Hand-refined: model specs, images, brands, drywall status, wall-finish, best-seller ranking. `wallFinish` = `"drywall"` \| `"drywall-optional"` \| `"strips"`. Series field encodes drywall eligibility. | ~3,880 lines | ✅ **YES** — never re-run build-models.mjs |
| `placed-homes.json` | JSON array (73 items) | Recently sold homes. Address, MLS, price, lat/lon, photos (10–24 per home), town slug. | ~3,344 lines | ✅ **YES** |
| `blog-posts.json` | JSON array (36 items) | Published blog articles. Slug, title, description, date (ISO), readMinutes, tags, bodyMarkdown. No H1 in markdown (title renders separately). | ~608 lines | ✅ **YES** (via `scripts/build-blog.mjs`) |
| `home-pricing.json` | JSON object | `{ "model-slug": price, ... }` override for home prices. Empty `{}` until Joe provides pricing. Drives price sort & filters on `/homes`. | 1 line | ✅ **YES** |
| `setup-pricing.json` | JSON object | `{ "model-slug": setup-cost, ... }` override (land + foundation + utilities). Empty `{}` for now. | 1 line | ✅ **YES** |
| `community.json` | JSON (small) | Hard-coded community/park data (if selling in communities; currently unused). | ~37 lines | ✅ Might edit |

### Generated files (DO NOT EDIT MANUALLY)

| File | Generator | Purpose | Regenerate when |
|------|-----------|---------|-----------------|
| `gallery-manifest.json` | `scripts/build-manifests.mjs` | JSON: `["dev-01.jpg", "dev-02.jpg", ...]` — list of files in `public/gallery/`. Used because workerd has no fs. | Images added to `public/gallery/` |
| `locations-manifest.json` | `scripts/build-manifests.mjs` | JSON: `{ "conway": ["01.jpg", ...], "loris": [...], ... }` — map of `public/locations/<town>/*.jpg` | Images added to `public/locations/<town>/` |
| `recently-placed-manifest.json` | (parsed from `placed-homes.json` schema) | Metadata about placed homes (for sitemap geotagging). | When placed homes updated |
| `gallery-manifest.json`, `locations-manifest.json` | Run `npm run manifests` or automatically pre-build | These are bundled so data loaders use static imports (no runtime fs). | After adding images to `public/` |

### Intermediate/backup files (for tooling only)

| File | Purpose | Edit? |
|------|---------|-------|
| `_models-raw.json` | Backup of all extraction sources before filtering. Preserve for reference. | ❌ NO |
| `_clayton-new.json` | Extraction task output (Clayton models). Used by build-models.mjs to merge. | ❌ NO |
| `_cavco-extra.json` | Hand-captured Cavco models not in workflow. Merged by build-models.mjs. | ❌ NO (unless adding Cavco) |
| `_new-homes-raw.json` | Empty placeholder for new-homes extraction (unused currently). | ❌ NO |
| `galleries-raw.json` | Empty placeholder (gallery images come from `public/gallery/`). | ❌ NO |

### Supporting files

| File | Format | Purpose |
|------|--------|---------|
| `galleries.json` | JSON | Image metadata (galleries keyed by slug). |
| `mls-listings-active.json` | JSON | Paragon MLS export (active listings for agent board; not used on site currently). |
| `paragon-sold.csv` | CSV | MLS transaction history (for extracting sold homes). |
| `placements.json` | JSON | Map dots for `/recently-placed` Leaflet map. Lat/lon, address, model, price, city, photo URL. **City must match placed-homes.json exactly** (see §7 gotcha in HANDOFF). |
| `sold-homes.json` | JSON | Sold homes archive (historical data). |

### Floor plan details

| Location | Purpose | Format |
|----------|---------|--------|
| `data/plans/` | Per-model floor plans (PDFs, images) | Subfolders named `{MODEL_ID}_{model-slug}.json` (e.g., `6804112_impact-giles.json`). Each contains floor-plan metadata + URLs. |
| `data/plans/_index.json` | Master floor-plan index | Maps model slug → floor plan folder. |

---

## `public/` — Static Assets

**Purpose:** Everything served as-is; no processing. Images, icons, verification tokens.

### Structure

```
public/
├── models/              (30 folders)    # Model photos: /models/{slug}/01.jpg, 02.jpg, ...
├── gallery/             (19 images)     # Homepage gallery: dev-*.jpg (7), home-*.jpg (10)
├── locations/           (7 folders)     # Town photos: /locations/{town}/01.jpg, 02.jpg, 03.jpg
│   ├── aynor/
│   ├── conway/
│   ├── longs/
│   ├── loris/
│   ├── myrtle-beach/
│   └── ...
├── recently-placed/     (5 folders)     # Sold home photos by town
│   ├── aynor/           # Town folder with MLS ID photos (e.g., 2407324.jpg)
│   ├── conway/
│   ├── galleries/       # Subfolder: sold-home detail galleries (2407324/01.jpg, etc.)
│   ├── longs/
│   ├── loris/
│   └── myrtle-beach/
├── team/                (10+ images)    # Staff headshots: {name}.jpg
├── logo.png             (~125 KB)       # Home Placer lockup
├── file.svg, globe.svg  (icons)         # Page icons
├── google856...html     (verification) # Google Search Console verification file
├── e0e445...txt         (verification) # IndexNow API ownership token (32-char hex)
└── next.svg, vercel.svg (legacy)       # Old Next/Vercel icons (unused)
```

### Key points

| Folder | Count | Notes |
|--------|-------|-------|
| `models/` | ~30 folders | One per model (Clayton/Cavco/Champion). Each folder: multiple JPGs (10–20 per model). Naming: `01.jpg`, `02.jpg`, etc. (leading zeros). Automatically ranked by `build-models.mjs`: exteriors lead, floor plans trail. Paths stored in `data/models.json` `imageUrls` array. |
| `gallery/` | 19 images | Flat list (no subfolders). Dev photos + lifestyle photos. Loaded dynamically by `src/lib/gallery.ts` via `data/gallery-manifest.json`. |
| `locations/` | 7 town folders | Photos for place pages (`/locations/conway`, etc.). Each town: 2–3 images (dev site + local shots). Manifest generated by `scripts/build-manifests.mjs` → `data/locations-manifest.json`. |
| `recently-placed/` | ~6 town folders + `galleries/` subfolder | Town folders (`conway/`, `loris/`) hold the hero photo for each sold home (named by MLS ID, e.g., `2407324.jpg`). Subfolder `galleries/` holds detail galleries: `2407324/01.jpg`, `2407324/02.jpg`, etc. (up to 24 images per home). |
| `team/` | 10+ images | Staff headshots, named by slug (e.g., `joe-scaturro.jpg`). |
| Verification tokens | 2 files | `google856...html` (Google Search Console), `e0e445...txt` (IndexNow API key). DO NOT rename or delete. |

### Important: no fs at runtime

- **workerd (Cloudflare Workers runtime) has no filesystem access.** Image URLs must be static paths (e.g., `/models/ultra-flex-28-52/01.jpg`) or imported constants.
- **next/og (opengraph-image.tsx) cannot use `fs.readFileSync`.** The hero photo is inlined as base64 in `src/app/og-hero.ts`.
- **Manifests (gallery-manifest.json, locations-manifest.json) are pre-generated** so data loaders can use static imports instead of runtime directory listings.

---

## `scripts/` — Build & Deployment Helpers

**Purpose:** Node.js utilities for pre-build, data transformation, and deployment.

| Script | Input | Output | When to run | Editable? |
|--------|-------|--------|-------------|-----------|
| `build-manifests.mjs` | `public/gallery/`, `public/locations/` (file system) | `data/gallery-manifest.json`, `data/locations-manifest.json` | **AUTO** (wired to predev/prebuild) | ❌ Core logic; modify only for new manifest types |
| `build-models.mjs` | Task outputs (3 JSON files: Clayton, Cavco extraction + `data/_cavco-extra.json`) | `data/models.json`, `data/_models-raw.json` backup | When new model extraction arrives (⚠️ **NEVER re-run lightly** — omits hand-finalized fields like tourUrl, floorPlans) | ❌ Only run with care; see HANDOFF §2 |
| `build-blog.mjs` | Workflow task output JSON | `data/blog-posts.json` | When new blog posts written (scheduled publishing task calls this) | ✅ Can adjust date-spacing logic if needed |
| `build-cavco.mjs` | Cavco extraction (internal workflow) | Merged into `_cavco-extra.json` | Manual Cavco intake | ✅ Utilities for Cavco extraction |
| `build-champion-exteriors.mjs` | Champion model extraction | Champion model photos | When Champion inventory refreshed | ✅ Champion photo pulling |
| `indexnow.mjs` | Live sitemap (fetched) or explicit URL list | HTTP POST to IndexNow API | After deploy (`npm run deploy` auto-runs; also manual if new content) | ✅ Safe to run anytime; notifies search engines |
| `deploy-pages.sh` | (unused in current workflow) | Static export to GitHub Pages | Legacy; superseded by Cloudflare Workers deploy | ❌ Archived |
| `gen-placed-homes.py` | Paragon MLS CSV export | Merged into `data/placed-homes.json` | When MLS transaction history imported | ✅ Python script for MLS parsing |
| `scrape-clayton-lines.py` | Clayton website | Clayton model extraction | Model refresh from manufacturer | ✅ Scraper script (use with care; may need updates if site changes) |

### Key warnings

- **`build-models.mjs` is destructive.** It overwrites `data/models.json`. If you re-run it after hand-refining models (adding floorPlans, tourUrl, wallFinish tweaks, drywall mapping), those edits are LOST. Only re-run with a fresh extraction file, and verify the output before committing.
- **`npm run prebuild` runs `build-manifests.mjs`** automatically before each dev/build/deploy. Safe to run multiple times.
- **`npm run deploy` is the production path:** `build-manifests.mjs && opennextjs-cloudflare build && opennextjs-cloudflare deploy`. Do this from the Home Placer Cloudflare account (wrangler auth).

---

## Build Outputs & Cache (DO NOT COMMIT)

| Folder | Source | Purpose | Recreated? | Commit? |
|--------|--------|---------|------------|---------|
| `.next/` | Next.js build | Type routes, compiled routes, assets. | Yes (on build) | ❌ NO |
| `.open-next/` | OpenNext build | Pre-rendered HTML + serverless bundles for Cloudflare. | Yes (on build) | ❌ NO |
| `out/` | Static export (GitHub Pages mode) | Generated when PAGES_BUILD=1. | Yes | ❌ NO |
| `.wrangler/` | Wrangler cache | Auth, deployments, previews. | Auto-managed | ❌ NO |

All are gitignored. **Commit `data/`, `public/`, `scripts/`, `src/` only.**

---

## Special Generated Files (DO NOT EDIT)

| File | Generator | Purpose | Why not edit | Regenerate how |
|------|-----------|---------|--------------|-----------------|
| `next-env.d.ts` | Next.js build | TypeScript definitions for routes + image types | Auto-generated; your edits are overwritten | Run `next build` |
| `src/app/og-hero.ts` | Manual script (sips + base64) | Base64-inlined hero photo for OG link preview | 276 KB base64 string; not a source file | Change hero photo → resize to 1200w, compress q62 → base64 → paste in og-hero.ts |
| `data/gallery-manifest.json` | `scripts/build-manifests.mjs` | Static list of gallery images (avoids fs.readdirSync) | Dynamically generated from filesystem | `npm run manifests` |
| `data/locations-manifest.json` | `scripts/build-manifests.mjs` | Map of town folders to image lists | Dynamically generated from filesystem | `npm run manifests` |

---

## Cross-references to sibling handoff docs

- **01-CONTEXT.md** (if it exists): High-level overview, stack summary, and deployment instructions.
- **03-DATA-SCHEMA.md** (if it exists): Detailed structure of `data/models.json`, `placed-homes.json`, `blog-posts.json`, and pricing overrides.
- **04-COMPONENTS-API.md** (if it exists): Component prop types and usage patterns.
- **HANDOFF.md** (root): Current LIVE state, blockers, gotchas, and account rules. **READ FIRST.**

---

## Common tasks & where things live

| Task | File(s) |
|------|---------|
| Add a new home model | Edit `data/models.json` manually (never re-run build-models.mjs carelessly) |
| Price a model | Add entry to `data/home-pricing.json` (key = model slug) |
| Add a recently-placed home | Add entry to `data/placed-homes.json` + corresponding photos in `public/recently-placed/{town}/` + `public/recently-placed/galleries/{MLS}/*.jpg` |
| Add a blog post | Add entry to `data/blog-posts.json` with future date to schedule it; deploy once date arrives. |
| Publish new model photos | Add JPGs to `public/models/{slug}/`; re-generate gallery manifests (`npm run manifests`). |
| Change the OG link-preview photo | Resize hero home photo to 1200×630, compress (sips q62), base64 encode, paste into `src/app/og-hero.ts`. |
| Add a location (town) | Create folder `public/locations/{town-slug}/` with 2–3 photos; add data to `src/lib/locations.ts`; run `npm run manifests`. |
| Add a team member | Update `src/lib/team.ts`; add headshot to `public/team/{slug}.jpg`. |
| Refresh the blog queue | Update `data/blog-posts.json` with new posts + dates; deploy once dates are live. |
| Deploy to production | `npm run deploy` (builds manifests, compiles Next.js, uploads to Cloudflare Workers). Must be authed to Home Placer's Cloudflare account via wrangler. |
| Test locally | `npm run dev` (runs dev server on :3000; pre-builds manifests). |

---

## Environment variables & secrets

All secrets are **Cloudflare Worker secrets** (not `.env` files in the repo). Template in `.env.example`:

| Secret | Set where | Used by | Purpose |
|--------|-----------|---------|---------|
| `FUB_API_KEY` | Wrangler (Worker secrets) | `/api/lead` | Follow Up Boss API key; creates lead events + contacts. |
| `FUB_WARRANTY_USER_ID` | Wrangler | `/api/lead` | Assign new service/warranty leads to this FUB user ID (default: 39). |
| `FUB_WARRANTY_COLLABORATORS` | Wrangler | `/api/lead` | Comma-separated FUB user IDs to notify on warranty requests. |
| `RESEND_API_KEY` | Wrangler (optional) | `/api/lead` | Resend email service; sends team a copy of each lead. (Can be omitted if FUB is enough.) |
| `LEADS_TO`, `LEADS_FROM` | `.env.example` | `/api/lead` | Resend email recipients + sender. |
| `WARRANTY_LEADS_TO` | `.env.example` (optional) | `/api/lead` | Separate inbox for warranty leads (falls back to LEADS_TO). |

**Set via:** `wrangler secret put FUB_API_KEY` (prompts for value), or Cloudflare dashboard → Workers → Settings → Variables.

---

## Deployment & build pipeline

```
npm run deploy
  ↓
node scripts/build-manifests.mjs
  (gallery-manifest.json, locations-manifest.json)
  ↓
next build + opennextjs-cloudflare build
  (.next/, .open-next/ → compiled for Cloudflare Workers)
  ↓
opennextjs-cloudflare deploy
  (uploads to Home Placer Cloudflare account)
  ↓
(optional) node scripts/indexnow.mjs
  (notify Bing/Yandex/DuckDuckGo of new URLs)
```

Only `opennextjs-cloudflare deploy` touches the live site. **The working tree is the source of truth** — not a git branch. So uncommitted changes to `data/` or `src/` don't affect the deployed site until you commit + push + redeploy.
