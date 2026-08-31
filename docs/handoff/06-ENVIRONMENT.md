# Environment

Home Placer's deployment environment, required software, services, secrets, and API integrations for a complete setup on a fresh machine.

## Required Software

| Software | Version | Details |
|----------|---------|---------|
| **Node.js** | 26.0.0 (current; minimum: 18.x) | No `.nvmrc` file — package-lock.json v3 indicates Node 18+ required. Install via nvm or direct download. |
| **npm** | 11.12.1 (lockfile v3) | Package manager; use `npm install` to bootstrap dependencies. |
| **Python** | 3.9.6 (Python 3.x) | Optional — used only for build scripts (`scripts/*.mjs` that invoke child Node processes; no direct Python scripts in use). |
| **Git** | Any recent version | Repo is `github.com/homeplacer/hplacer-website` (GitHub org `homeplacer`). |
| **Wrangler CLI** | ^4.104.0 (npm dev dependency) | Cloudflare Workers deployment tool; already in package-lock.json. Requires fresh auth to Home Placer Cloudflare account on new machine. |
| **Docker** | None required | This is a serverless Cloudflare Workers deployment — no Docker image, no local database, no services to run locally. |

## Node & Package Manager

- **Node version:** Use the version supported by the current Next.js 16.3.3/OpenNext toolchain; package-lock.json v3 is authoritative for dependencies.
- **No `.nvmrc` file** — add one if you prefer explicit node version pinning (`18.17.0` or later is safe; 26+ is current).
- **Package manager:** npm only (no Yarn, pnpm, Bun). Always use `npm install` to restore dependencies from package-lock.json.
- **Lock strategy:** package-lock.json v3 is committed and is the source of truth — never delete it or run npm install without it.

## Cloudflare Workers & OpenNext Adapter

Home Placer deploys as a **serverless application on Cloudflare Workers**, not traditional hosting. No containers, no servers to manage, no PostgreSQL — only the edge.

| Component | Value | Notes |
|-----------|-------|-------|
| **Worker name** | `hplacer-app` | Set in `wrangler.jsonc:name`. Deploys to hplacer-app.homeplacer.workers.dev by default. |
| **Account ID** | `6caa351d57b30bd04cec8a08e4330ffd` | Home Placer's Cloudflare account. Set in `wrangler.jsonc:account_id`. |
| **Build adapter** | `@opennextjs/cloudflare` ^1.19.11 | Transforms Next.js app into a Cloudflare Worker. Part of npm dependencies. |
| **Worker entry** | `.open-next/worker.js` (post-build) | Compiled from Next.js by the adapter; not in version control (in `.gitignore`). |
| **Assets binding** | `ASSETS` | Binds to `.open-next/assets/` for static files. Allows workerd runtime to serve CSS, JS, images. |
| **Custom domains** | `hplacer.com`, `www.hplacer.com` | Both custom domains routed in `wrangler.jsonc:routes`. DNS is via Cloudflare nameservers (already set). |
| **Compatibility date** | 2024-12-30 | Set in `wrangler.jsonc`; gates which Cloudflare/workerd APIs are available. |
| **Compatibility flags** | `nodejs_compat`, `global_fetch_strictly_public` | Enables Node.js polyfills (Buffer, etc.) and strict fetch (no loopback). |

**Build & deploy pipeline:**
- `npm run build`: Runs `next build` → outputs to `.next/`
- `npm run preview`: Runs `build-manifests.mjs && opennextjs-cloudflare build && opennextjs-cloudflare preview` (local preview on :8787)
- `npm run deploy`: Runs `build-manifests.mjs && opennextjs-cloudflare build && opennextjs-cloudflare deploy` (live push to Cloudflare)

**Note:** Deploy builds from the **working tree**, not from git HEAD. Uncommitted changes are deployed. This is intentional per HANDOFF.md — the site is production-ready.

### Wrangler Authentication

Before deploying on a new machine:
```bash
wrangler login  # Opens browser to authenticate to Home Placer's Cloudflare account
npm run deploy  # Now succeeds with valid auth
```

⚠️ **Critical:** Wrangler only allows one Cloudflare account login at a time. If you're logged into a different account (e.g., Forturro's account), you must log out first or use `wrangler logout && wrangler login`.

## Environment Variables & Secrets

All secrets are **Cloudflare Worker environment variables** — never stored in the repo.

### Development (Local)

- **File:** `.dev.vars` (git-ignored, never committed)
- **Scope:** Applies only to `npm run preview` (local dev via `opennextjs-cloudflare preview`)
- **Content:**
  ```
  NEXTJS_ENV=development
  # FUB_API_KEY=         (commented out so leads self-log locally)
  ```
- **Usage:** Leave `FUB_API_KEY` unset locally — form submissions are logged server-side but don't ping Follow Up Boss until the key is set in production.

### Production (Cloudflare Worker Secrets)

These are set via Wrangler or the Cloudflare dashboard (**Settings → Variables**) and are **not in the repo**. New machine setup requires re-entering these.

| Variable | Purpose | Required? | Source/Notes |
|----------|---------|-----------|--------------|
| **FUB_API_KEY** | Follow Up Boss lead delivery | ✅ **YES** | Get from FUB → Admin → API Keys. Enables `/api/lead` to create events/persons in FUB and assign to warranty team. Without it, leads are logged but don't reach the CRM. |
| **FUB_WARRANTY_USER_ID** | Default owner for new service leads | ❌ (optional) | Default: `39` (Brett). Set as Cloudflare variable in wrangler/dashboard. See `src/app/api/lead/route.ts:104–107` for defaults. |
| **FUB_WARRANTY_COLLABORATORS** | Collaborators on new service leads (CSV) | ❌ (optional) | Default: `1,35` (Joe, Tara). Set as a Cloudflare secret or variable. |
| **RESEND_API_KEY** | Resend email delivery (optional team email backup) | ❌ (no) | Get from resend.com → API Keys. If set, sends each lead to `LEADS_TO` email. Currently **not configured**; FUB is the primary delivery. |
| **LEADS_TO** | Recipient email for Resend lead copy | ❌ (no) | Default: `leads@hplacer.com`. Only used if `RESEND_API_KEY` is set. |
| **LEADS_FROM** | Sender email for Resend (display name + address) | ❌ (no) | Default: `Home Placer <leads@hplacer.com>`. |
| **WARRANTY_LEADS_TO** | Separate recipient for service/warranty email copies | ❌ (no) | Falls back to `LEADS_TO` if unset. Optional for routing warranty leads to a different inbox. |

### Client-Side Environment Variables

These use the `NEXT_PUBLIC_` prefix and are baked into the build artifact (visible in browser).

| Variable | Value | Purpose |
|----------|-------|---------|
| **NEXT_PUBLIC_BASE_PATH** | (unset in production; used only for GitHub Pages static export) | Path prefix for assets when exporting to GitHub Pages (`PAGES_BUILD=1`). Normally empty for Cloudflare deployment. Set via `.dev.vars` only if testing static export. |
| **NEXTJS_ENV** | `development` (locally) | Internal Next.js environment marker. Not exposed to client. |

**Example local .dev.vars (after first setup):**
```
NEXTJS_ENV=development
```

## Analytics & SEO

| Service | Measurement ID / Key | Account | Purpose |
|---------|---------------------|---------|---------|
| **Google Analytics 4 (GA4)** | `G-0T71PWYQSQ` | carolina@hplacer.com | Live on all pages via `GoogleAnalytics` component. Hardcoded in `src/lib/site.ts:31`. Event tracking for form submissions, page views, and custom actions. |
| **Google Search Console** | (verified under carolina@hplacer.com) | carolina@hplacer.com | Sitemap submitted; indexing monitored. URL: `search.google.com/search-console`. |
| **Bing Webmaster Tools** | (imported, no credential needed in code) | carolina@hplacer.com | Sitemap monitoring; search insights. URL: `bing.com/webmasters`. |
| **IndexNow** | Key: `e0e445eaf75d61f3faee17b699eca3b9` | Hosted at `/e0e445eaf75d61f3faee17b699eca3b9.txt` (in `public/`). Run `node scripts/indexnow.mjs` after deploy to ping Bing/Yandex/DuckDuckGo instantly. |

**GA4 setup:**
- Rendered by `src/components/analytics.tsx` → loads gtag script from `googletagmanager.com/gtag/js?id=G-0T71PWYQSQ`.
- Client-side event tracking via `src/lib/analytics.ts:track()` function (safe no-op if gtag unavailable).
- Property owner: carolina@hplacer.com (real Home Placer Google account, not Forturro).

**Note:** All search infra (GSC, Bing, GA4) must stay under **carolina@hplacer.com**, never joe@forturro.com or info@forturro.com. This is a hard rule per HANDOFF.md § 6.

## Build Scripts

All scripts use Node.js (no Python runtime needed; `python3` is optional).

| Script | Entry | Purpose | Manual/Auto? |
|--------|-------|---------|--------------|
| **build-manifests.mjs** | `scripts/build-manifests.mjs` | Runs before every build/preview/deploy (via npm pre-hooks). Generates `.next/public/cache-manifest.json` and other metadata for OpenNext adapter. |  Pre-hook (auto) |
| **build-models.mjs** | `scripts/build-models.mjs` | ⚠️ **DO NOT RUN** — reads `data/_models-raw.json` and outputs to `data/models.json`. **NEVER re-run this** — it omits hand-finalized fields (floorPlans, tourUrl, pricing). Edit `models.json` directly instead. | Never (disabled) |
| **build-cavco.mjs** | `scripts/build-cavco.mjs` | One-time Cavco catalog builder (already run; output in `data/models.json`). | One-time (done) |
| **build-champion-exteriors.mjs** | `scripts/build-champion-exteriors.mjs` | One-time Champion exterior options extractor (already run). | One-time (done) |
| **build-blog.mjs** | `scripts/build-blog.mjs` | Generates blog metadata from `data/blog-posts.json` (minimal usage; posts load directly from JSON at runtime). | One-time or manual |
| **indexnow.mjs** | `scripts/indexnow.mjs` | Submits all live URLs (from sitemap.xml) to IndexNow API (Bing/Yandex/DuckDuckGo). Automatically run after each deploy via `hplacer-blog-publish` scheduled task. Can also run manually: `node scripts/indexnow.mjs` or `node scripts/indexnow.mjs <url> ...` | Auto (blog publish task) + manual |

**Critical rule:** Never run `npm run build-models` or manually invoke `scripts/build-models.mjs`. The models.json is hand-curated and includes fields (floorPlans, tourUrl, pricing notes) that the raw script omits. See HANDOFF.md § 2.

## APIs & Third-Party Integrations

| Service | API Endpoint | Credentials | Purpose |
|---------|--------------|-------------|---------|
| **Follow Up Boss (FUB)** | `api.followupboss.com/v1/{events,people,tasks}` | FUB_API_KEY (Worker secret) | Lead delivery: creates person/event, assigns to warranty team, opens task. Endpoints: POST `/events` (create lead), PUT `/people/{id}` (assign), POST `/tasks` (open task). Auth: Basic auth (API key in header). See `src/app/api/lead/route.ts:119–284` for full integration logic. |
| **Resend** | `api.resend.com/emails` | RESEND_API_KEY (Worker secret, optional) | Email lead copies to team inbox. Currently **disabled**; FUB is primary. If enabled, sends HTML-formatted lead summaries. See `src/app/api/lead/route.ts:286–323`. |
| **Cloudflare API** | (not used in app code) | Implicit via wrangler auth | Used only for deployment (wrangler handles auth). |
| **Google Analytics** | `googletagmanager.com/gtag/js` | GA4 ID: G-0T71PWYQSQ | Client-side event tracking. Loaded via next/script in `src/components/analytics.tsx`. |
| **Paragon (CCAR MLS)** | `zsvc.paragon.ice.com/s/goto/KZzKDmEi-e_` | None (public link) | "Collaboration Center" listing share. Not a data integration — just a branded link on `/homes` page. See `src/lib/site.ts:37`. |

## Required Accounts & Logins

**⚠️ STRICT RULE:** All Home Placer accounts must use **carolina@hplacer.com**, NEVER joe@forturro.com or info@forturro.com.

| Account | URL | Email | Purpose | Re-auth on new machine? |
|---------|-----|-------|---------|------------------------|
| **GitHub (homeplacer org)** | github.com/homeplacer/hplacer-website | (SSH key or PAT) | Source repository. If using HTTPS, cache credentials or use PAT. | ✅ Yes (SSH key or personal access token) |
| **Cloudflare (Home Placer account)** | app.cloudflare.com | Log in to Home Placer zone (hplacer.com) | Nameservers (barbara/gabriel.ns.cloudflare.com), Worker secrets, SSL/TLS settings. | ✅ Yes (wrangler login) |
| **Google Search Console** | search.google.com/search-console | carolina@hplacer.com | Sitemap, indexing, crawl errors. | ✅ Yes (browser login) |
| **Google Analytics 4 (GA4)** | analytics.google.com | carolina@hplacer.com | Property G-0T71PWYQSQ, real-time events, conversions. | ✅ Yes (browser login) |
| **Google Business Profile (GBP)** | business.google.com | carolina@hplacer.com | Home Placer listing, reviews (5★, 7 reviews live), Q&A, posts. CID: 3461988553332431879. | ✅ Yes (browser login) |
| **Bing Webmaster** | bing.com/webmasters | carolina@hplacer.com | Indexing monitoring, sitemaps, crawl insights. | ✅ Yes (browser login) |
| **Bing Places for Business** | bing.com/forbusiness | carolina@hplacer.com | Business listing (status: CLAIMED, awaiting PIN verification from phone). | ✅ Yes + phone PIN verify |
| **Priced Right Domains (registrar)** | dcc.secureserver.net (GoDaddy reseller) | carolina@hplacer.com | Domain registration (hplacer.com). Currently in process of transfer to Cloudflare Registrar (PAUSED 2026-07-01). | ✅ Yes (re-login for transfer) |
| **Follow Up Boss** | followupboss.com | (API key: separate from UI login; UI login = Joe's personal account) | CRM; lead events/persons. Site integration uses FUB_API_KEY (no UI login needed in deploy). | ❌ No (API key only, static) |
| **Cloudflare Registrar** | (part of app.cloudflare.com) | Login via Cloudflare account | Destination for domain transfer (target: hplacer.com registration). | ✅ Yes (after wrangler login) |

## Git Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| **Repository** | https://github.com/homeplacer/hplacer-website.git | HTTPS or SSH (use SSH key if available for passwordless pulls). |
| **Production branch** | `main` | Production source; deploy only a clean, tested commit. |
| **Feature branches** | Task-specific | Merge to `main` only after tests and live-safe review. |
| **Deploy source** | Working tree, not git HEAD | ⚠️ **Critical:** `npm run deploy` builds from uncommitted changes. Always `git status` before deploying to know what's live. |

## Local File Structure

Ignored from version control (see `.gitignore`):

```
/.open-next/             → Compiled Cloudflare Worker (generated by opennextjs-cloudflare build)
/.wrangler/              → Wrangler cache/state
/.next/                  → Next.js build output (dev & build)
.dev.vars                → Local-only secrets (leave FUB_API_KEY unset for local testing)
node_modules/            → npm dependencies
cloudflare-env.d.ts      → TypeScript types for Cloudflare env (generated by `npm run cf-typegen`)
*.tsbuildinfo            → TypeScript incremental build cache
.DS_Store                → macOS system files
.vercel/                 → Vercel cache (legacy, not used)
gbp-bank/                → Google Business Profile photo bank (marketing asset, not part of site)
```

## Next.js & Framework Configuration

| File | Purpose | Key settings |
|------|---------|--------------|
| **next.config.ts** | Next.js build configuration | `turbopack.root`: pins project root for monorepo clarity. `PAGES_BUILD=1` enables GitHub Pages static export (with `output: "export"`, basePath support, unoptimized images). Default production build is serverless (Cloudflare). |
| **tsconfig.json** | TypeScript compiler options | `"paths": { "@/*": ["./src/*"] }` for `@/` imports; `"strict": true` for type safety. Target: ES2017. No Node.js polyfills in tsconfig (handled by Wrangler compatibility flags). |
| **tailwind.config.\*** | Tailwind CSS config | Not explicitly shown; uses Tailwind v4 (per package.json). Brand color ramp: slate with pink accents (per HANDOFF.md). |
| **postcss.config.mjs** | PostCSS configuration | Minimal; Tailwind v4 is the main plugin. |
| **eslint.config.mjs** | ESLint ruleset | Extends `eslint-config-next/{core-web-vitals,typescript}`. Ignores `.next/`, `out/`, `build/`, `next-env.d.ts`. |

## Data Files (Git-Committed)

All JSON in `/data/` is committed and is the source of truth for the site. **Edit directly; never regenerate from scripts.**

| File | Size | Purpose | Edit policy |
|------|------|---------|-------------|
| **models.json** | 3,880 lines | 93 home models (Clayton, Cavco, Champion). Fields: modelName, brand, series (plant→drywall mapping), width, beds, sqft, wallFinish, floorPlans (array), tourUrl, images. | ✅ **Edit directly.** Never run build-models.mjs; it omits floorPlans/tourUrl/pricing. |
| **placed-homes.json** | 3,344 lines | 73 recently-placed homes (sold homes with real photos & testimonials). Fields: address, city, beds, sqft, price, photo, testimonial, etc. | ✅ **Edit directly.** Update after each sale. |
| **blog-posts.json** | 608 lines | 36 published + scheduled blog posts. Fields: id, title, date, author, bodyMarkdown, tags. Date-gated: future-dated posts hidden until deploy on/after date. | ✅ **Edit directly.** Add new posts, update dates for scheduling. See `/src/lib/blog.ts` for date-gating logic. |
| **placements.json** | 784 lines | Geographic metadata for placed homes (lat/lng for Leaflet map on `/recently-placed`). Synced with placed-homes.json. | ✅ **Edit directly.** Update when city reassignments change (e.g., Rabbit Ln → Conway). |
| **galleries.json** | 1,884 lines | Photo gallery manifest (home interiors, exteriors per model). Photo URLs and gallery metadata. | ✅ **Edit directly.** Generated once; updated manually when adding photos. |
| **locations-manifest.json** | 25 lines | Index of 27 location pages (cities across Horry/Georgetown SC, Brunswick/Columbus NC). | Auto-generated; rarely touched. |
| **recently-placed-manifest.json** | 127 lines | Index for `/recently-placed` listings (pagination, filters). | Auto-generated from placed-homes.json. |
| **_models-raw.json** | 3,104 lines | ⚠️ **Raw catalog export** (do NOT use). Output of build-models.mjs; lacks hand-finalized fields. Kept as reference only. | ❌ **Ignore.** Never run build-models.mjs. |
| **community.json** | 37 lines | Minimal; may contain community data (currently sparse). | Rarely updated. |
| **setup-pricing.json**, **home-pricing.json** | 1 line each (empty {}) | ⚠️ **Pricing data (currently unpopulated).** When Joe provides pricing, these will be filled in; price filters/sort will light up. | ⚠️ **TODO:** Fill in when Joe provides pricing. |

## Monitoring & Deployment Status

- **Current live state:** Full site deployed at hplacer.com + www.hplacer.com.
- **Blog auto-publish:** Scheduled task `hplacer-blog-publish` runs 2×/week (Mon & Thu) via `npm run deploy && node scripts/indexnow.mjs`. Runs until ~Aug 6, 2026 (36-post queue); needs refill then.
- **Domain transfer:** Paused (HANDOFF.md § 4A). Lock OFF; awaiting auth code from Priced Right Domains + Cloudflare Registrar transfer.
- **Logs:** Server logs available via Cloudflare dashboard (Workers → hplacer-app → Real-time Logs). Lead submissions and FUB errors appear here.

## Troubleshooting Checklist for New Machine Setup

1. **Clone repo:** `git clone https://github.com/homeplacer/hplacer-website.git && cd hplacer-website`
2. **Install dependencies:** `npm install` (no flags needed; respects package-lock.json)
3. **Set up Cloudflare:** `wrangler login` (authenticates to Home Placer account; may prompt for 2FA)
4. **Test locally:** `npm run dev` (starts Next.js dev server on :3000) or `npm run preview` (tests OpenNext locally on :8787)
5. **Deploy:** `npm run deploy` (builds, compiles to Worker, uploads to Cloudflare)
6. **Verify:** Check hplacer.com in browser; confirm GA events in Google Analytics console; check Cloudflare dashboard for any deploy warnings.

If deploy fails:
- Check `wrangler whoami` to confirm you're logged into Home Placer account, not another.
- Check `.dev.vars` is git-ignored (never committed).
- Check account_id in `wrangler.jsonc` matches the logged-in account.

---

This document is complete and ready for handoff. All environment variables, APIs, accounts, and build configuration are documented with cross-references to actual file paths and line numbers where relevant.
