# Active Work and Recovery Guide

## Section 11: Active Files & Current State

### Current Branch & Commits

| Item | Value |
|------|-------|
| **Active branch** | `first-touch-attribution` |
| **Last commit** | `e553c4b` (2026-07-01 session end) |
| **Commit message** | "Session checkpoint: blog engine, search infra, listings, OG image, cross-over" |
| **Working tree** | ✅ **Clean** — all changes committed |
| **Uncommitted files** | **0** — safe to move to new machine |

### Most Recent Commits (Last 5)

1. **e553c4b** — Session checkpoint: blog engine, search infra, listings, OG image, cross-over
2. **dea6f72** — Add first-touch attribution capture → forward to FUB
3. **cb1bc9b** — Add 4 Cavco Douglas/Fleetwood models from floorplan PDFs + fix Sebastian
4. **2db175a** — Fix FUB person-id extraction (events returns id at top level)
5. **983e002** — FUB: open a warranty task on every service request

### Intermediate / Working Data (Under `/data`)

The following are **intermediate build artifacts** and **raw data extracts** — NOT primary source:

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `_models-raw.json` | 3104 | Raw manufacturer catalog (Clayton, Cavco, Champion lines scraped/parsed) | Development only; `build-models.mjs` transforms → models.json |
| `_clayton-new.json` | 404 | Fresh Clayton models from build-clayton (pending merge check) | Latest extraction |
| `_cavco-extra.json` | 133 | Cavco models + floorplan data (Douglas, Fleetwood) | Recently added (commit cb1bc9b) |
| `_new-homes-raw.json` | 0 | Empty placeholder for recently-placed homes staging | Unused |

**⚠️ WARNING:** Do **NOT** re-run `scripts/build-models.mjs` — it would overwrite hand-finalized fields in `data/models.json` (floorPlans, tourUrl, pricing). These raw files are for reference only.

### Primary Data (Source of Truth)

| File | Count | Purpose |
|------|-------|---------|
| `data/models.json` | 93 models | All manufactured homes in inventory (edit by hand; live on site) |
| `data/placed-homes.json` | 73 placed homes | Recently-installed homes with photos; map + /recently-placed pages |
| `data/blog-posts.json` | **36 posts** | Blog queue (date-gated publishing; 2×/week Mon & Thu until ~Aug 6) |
| `data/placements.json` | Map coordinates | Lat/lon for each placed home (used by Leaflet map component) |

### Build Manifests (Auto-Generated, Run Before Deploy)

These are **generated fresh on each build** by `scripts/build-manifests.mjs` (wired into `predev`/`prebuild`/`deploy` hooks):

- `data/gallery-manifest.json` — list of gallery image filenames under `public/gallery/`
- `data/locations-manifest.json` — map of town slugs → image arrays under `public/locations/{slug}/`

### Source Code Organization

72 TypeScript/TSX files across the Next.js 16 app:

| Directory | File Count | Key Files |
|-----------|-----------|-----------|
| `src/app/` (routes) | 32 | homepage, /homes, /recently-placed, /blog, /locations, /brands, /financing, /process, /warranty, /faq, /gallery, /land-packages, education pages (manufactured-vs-site-built, etc.), /api/lead (form intake) |
| `src/components/` | 24 | homes-browser, placements-map, home-card, blog rendering, forms (contact, financing, service-request), attribution-tracker, testimonials, site-header, site-footer |
| `src/lib/` | 15 | blog (date-gate logic), homes (model loaders), placed-homes, locations, analytics, attribution (first-touch capture), lead (form submit fallback), site (constants), reviews, faqs, gallery, glossary |
| `src/middleware.ts` | 1 | HTTPS 308 redirect (edge, loop-safe) |

**Full file tree:** All 72 files in `/Users/spencer/projects/hplacer/src/**/*.{ts,tsx}`.

### Assets & Config

| Item | Location | Purpose |
|------|----------|---------|
| **OG hero image** | `src/app/og-hero.ts` | Base64-inlined 1200×630 photo (home #1 best-seller, compressed q62) for link previews; regenerate if photo changes (sips resize → base64) |
| **Favicon** | `public/favicon.ico` | Home Placer logo (house emblem) |
| **Gallery images** | `public/gallery/*.jpg` | Home interior/exterior photos (manifest built on each deploy) |
| **Location images** | `public/locations/{slug}/*.jpg` | Town/area photos organized by city slug (Conway, Longs, etc.) |
| **IndexNow key** | `public/e0e445eaf75d61f3faee17b699eca3b9.txt` | Domain verification for instant search-engine indexing (contains the key string) |

### Configuration Files

| File | Purpose | Notes |
|------|---------|-------|
| `wrangler.jsonc` | Cloudflare Workers deployment config | Account ID `6caa351d57b30bd04cec8a08e4330ffd`, routes for hplacer.com + www, uses `.open-next/worker.js` as the entry point |
| `.env.example` | Template for Worker secrets | `FUB_API_KEY`, `RESEND_API_KEY`, `LEADS_TO`, etc. — secrets are set via `wrangler secret put`, not in the repo |
| `.dev.vars` | Local development env (gitignored) | `NEXTJS_ENV=development`; `FUB_API_KEY` commented out so local form submissions just log |
| `.gitignore` | Standard Node/Next exclusions | `.env`, `.wrangler/`, `.next/`, `.open-next/`, `node_modules/`, `out/` (static export) |

### Deployment Infrastructure

- **Host:** Cloudflare Workers (via OpenNext adapter).
- **Custom domains:** `hplacer.com` + `www.hplacer.com` (configured in `wrangler.jsonc` routes).
- **DNS:** Cloudflare nameservers (barbara/gabriel.ns.cloudflare.com); registrar transfer to CF in progress (see HANDOFF.md §4A).
- **Build command:** `npm run deploy` = `build-manifests.mjs && opennextjs-cloudflare build && opennextjs-cloudflare deploy`.
- **Preview command:** `npm run preview` (local development mode for testing on Cloudflare).

### Paused / In-Progress Work (External, Not Code)

1. **Domain registration transfer** (hplacer.com, Priced Right → Cloudflare Registrar)
   - ✅ Lock turned OFF
   - ▶️ NEXT: Get EPP code from Priced Right Domains portal (dcc.secureserver.net, carolina@hplacer.com). Approval email → joe@forturro.com.
   - Then initiate transfer at Cloudflare Home Placer account; ~$10.44/yr.
   - Blocked: Cloudflare only allows one account login at a time.

2. **Bing Places for Business** (claimed, pending verification)
   - Status: Listing claimed under carolina@hplacer.com (correct NAP, "Mobile home dealer", hours).
   - ▶️ NEXT: Joe must complete phone/SMS PIN verification (843) 849-4663 at bing.com/forbusiness.

3. **Apple Business Connect** (parked)
   - Joe's Apple ID currently locked out; redirect now goes to unified business.apple.com.
   - Resume when Joe recovers access.

4. **Blog queue refill** (~Aug 6)
   - Current queue: 36 posts total, publishing 2×/week Mon & Thu.
   - Timeline: ~Aug 6 queue empties; Gemini's plan = 90 days at 2/wk cadence → write ~12 more posts to extend.

---

## Section 13: Recovery Guide for Fresh Machine

A complete, step-by-step walk-through to set up hplacer.com on a new machine from zero.

### Step 1: Clone the Repo and Verify the Current Build

```bash
# Clone
git clone https://github.com/homeplacer/hplacer-website.git /path/to/hplacer
cd /path/to/hplacer

# Verify you're on the right branch and commit
git rev-parse --abbrev-ref HEAD
# Expected: first-touch-attribution

git log -1 --oneline
# Expected: e553c4b Session checkpoint: ...

# Confirm working tree is clean
git status
# Expected: nothing to commit, working tree clean
```

### Step 2: Install Node Dependencies

```bash
# Ensure Node 18+ and npm 9+ installed
node --version
npm --version

# Install project dependencies (no special flags needed)
npm install

# Verify key packages
npm ls next react wrangler
# Expected: next@16.2.9, react@19.2.4, @opennextjs/cloudflare@1.19.11, wrangler@4.104.0+
```

### Step 3: Set Up Local Development

#### Generate Build Manifests

```bash
# Generates data/gallery-manifest.json and data/locations-manifest.json
# from public/gallery and public/locations dir trees. Safe to run anytime.
npm run manifests
# Output: "[manifests] gallery: <N> images; locations: <M> towns"
```

#### Verify Local Dev Works (No Secrets Needed)

```bash
# Start the dev server (Next.js on :3000)
npm run dev

# Output should be:
#   ▲ Next.js 16.2.9
#   - Local:        http://localhost:3000
#   - Environments: .env.local, .dev.vars
# 
# Open http://localhost:3000 in a browser → should see home page with full site.
```

#### Optional: Preview the Cloudflare Workers Build

```bash
# Simulates the production Workers build locally (includes static export constraints).
# Requires wrangler auth to the Home Placer account (see Step 4 before trying).
npm run preview

# Runs on localhost:8786 (or specified in wrangler output); use to test edge-only features.
```

### Step 4: Authenticate Wrangler to Cloudflare

The Next.js app runs on Cloudflare Workers in production. Wrangler is the CLI that deploys to Workers. Authenticate it to the **Home Placer** Cloudflare account:

```bash
# Trigger the OAuth flow to authorize your machine
wrangler auth

# You will be prompted to:
#   1. Open a browser to Cloudflare's login page
#   2. Sign in (or create an account)
#   3. Grant Claude Code permission to access your Cloudflare account
#   4. Confirm the oauth token is saved locally (~/.wrangler/config.toml or per-project .wrangler/*)

# Once authorized, verify:
wrangler whoami
# Expected: Shows the Cloudflare account email / account_id
# (should match the Home Placer account, NOT a personal one)
```

**⚠️ RULE:** Log in to Cloudflare **ONLY the Home Placer account** (zone hplacer.com, account ID `6caa351d57b30bd04cec8a08e4330ffd`). Do NOT mix with personal or Forturro accounts — a single browser login is active at a time, and the wrong account will break deployment.

### Step 5: Set Up Cloudflare Worker Secrets (Required for Forms)

Without these secrets, forms still work but leads are NOT delivered to Follow Up Boss or Resend email.

#### FUB API Key (Lead Intake)

```bash
# FUB_API_KEY enables the /api/lead route to create events + persons in Follow Up Boss.
# Get the key from: FUB Admin → API → copy the key.

wrangler secret put FUB_API_KEY
# Paste the key and press Enter. Wrangler will prompt; follow it.
# Confirmation: "✅ Uploaded secret FUB_API_KEY"
```

#### FUB Warranty Routing (Optional, Defaults Baked In)

```bash
# FUB_WARRANTY_USER_ID = default owner for NEW service-request leads.
# Default: 39 (Brett). Only set if you want to override.
wrangler secret put FUB_WARRANTY_USER_ID
# Enter: 39

# FUB_WARRANTY_COLLABORATORS = CSV of collaborator user IDs to add to service tasks.
# Default: 1,35,46 (Joe, Tara, Wade). Only set if you want to override.
wrangler secret put FUB_WARRANTY_COLLABORATORS
# Enter: 1,35,46
```

#### Resend Email API (Optional, Backup Email Delivery)

```bash
# RESEND_API_KEY enables email copies of leads to the team (optional if FUB is enough).
# Get from: resend.com → API Keys → create a key for hplacer.com.

wrangler secret put RESEND_API_KEY
# Paste the key.

# LEADS_TO = recipient email for lead copies (default: leads@hplacer.com).
wrangler secret put LEADS_TO
# Enter: leads@hplacer.com

# LEADS_FROM = sender email (must be Resend-verified domain).
wrangler secret put LEADS_FROM
# Enter: Home Placer <leads@hplacer.com>

# WARRANTY_LEADS_TO = optional separate recipient for service-request copies (falls back to LEADS_TO).
# Usually not needed; skip unless explicitly configured.
```

**Verification:** After setting secrets, check the Cloudflare dashboard:
- **Home Placer account** → **Workers & Pages** → **hplacer-app** → **Settings** → **Variables & Secrets**
- You should see `FUB_API_KEY` listed (value hidden).

### Step 6: Test the Dev Server with Mock Form

```bash
# The dev server is running (from Step 3).
# Fill out a contact form at http://localhost:3000/contact.

# Expected behavior:
#   - .dev.vars has FUB_API_KEY commented out, so the form:
#     1. Logs the submission server-side (console output in the terminal)
#     2. Returns JSON: { ok: true, skipped: "no FUB_API_KEY" }
#   - The form confirms "We'll be in touch" (no error).

# Check the terminal — you should see a log line like:
#   [api/lead] form=contact name=... email=... → skipped (no FUB_API_KEY)
```

### Step 7: Deploy to Production (Cloudflare Workers)

Once you've verified local dev works and secrets are set, deploy:

```bash
# Build the Next.js app for Cloudflare Workers + deploy
npm run deploy

# This runs (in order):
#   1. scripts/build-manifests.mjs (generates gallery + location manifests)
#   2. opennextjs-cloudflare build (compiles Next.js for Workers; outputs to .open-next/)
#   3. opennextjs-cloudflare deploy (pushes to Cloudflare)

# Expected output:
#   ✨ Success! Deployed hplacer-app to Cloudflare Workers
#   📦 Uploading... [████████████████████████████] 100%
#   🔗 Preview: https://hplacer-app.<account>.workers.dev
#   ✅ Custom domains: hplacer.com, www.hplacer.com

# Typical deploy time: 1–3 min.
```

### Step 8: Verify the Production Deploy

```bash
# Check the homepage loads
curl -s https://hplacer.com/ | head -20
# Expected: HTML with <title>Home Placer...</title>

# Check a model detail page
curl -s https://hplacer.com/homes/clayton-evolution-3268 | grep -o '<h1>.*</h1>'
# Expected: <h1>Clayton Evolution 3268</h1> (or similar)

# Check blog indexing
curl -s https://hplacer.com/blog | grep -o 'href="/blog/[a-z0-9-]*"' | wc -l
# Expected: 36 (all published posts; future-dated ones hidden)

# Check a specific blog post (any from data/blog-posts.json with today's date or earlier)
curl -s -o /dev/null -w "%{http_code}" https://hplacer.com/blog/manufactured-home-land-package-cost-horry-county
# Expected: 200

# Check the OG image (link preview)
curl -s -I https://hplacer.com/opengraph-image | grep -i content-type
# Expected: content-type: image/jpeg

# Check sitemap (for SEO)
curl -s https://hplacer.com/sitemap.xml | grep -c '<loc>'
# Expected: ~200+ (all pages + models + blog posts)

# Check IndexNow key (search-engine pinging)
curl -s https://hplacer.com/e0e445eaf75d61f3faee17b699eca3b9.txt
# Expected: e0e445eaf75d61f3faee17b699eca3b9 (the key itself)
```

### Step 9: Set Up Browser Logins (Re-Establish Access)

**⚠️ Browser logins do NOT transfer** — sign in to each account on the new machine:

#### Google Search Console & Analytics (carolina@hplacer.com)

1. Open https://search.google.com/search-console
2. Sign in as `carolina@hplacer.com`
3. Select the hplacer.com property
4. Verify setup complete (should already be verified; just re-login)

#### Google Analytics (GA4, event tracking)

1. Open https://analytics.google.com
2. Sign in as `carolina@hplacer.com`
3. Select property `G-0T71PWYQSQ` (Home Placer)

#### Bing Webmaster (carolina@hplacer.com)

1. Open https://www.bing.com/webmasters
2. Sign in as `carolina@hplacer.com`
3. Select hplacer.com
4. Verify (should already be verified)

#### Cloudflare Dashboard (Home Placer account)

1. Open https://dash.cloudflare.com
2. Sign in with the Home Placer Cloudflare credentials (email + password OR SSO if set up)
3. Select zone: hplacer.com
4. Navigate to **Workers & Pages** → **hplacer-app** to check deploy status

#### Registrar (Priced Right Domains, carolina@hplacer.com)

For future domain-transfer work:

1. Open https://dcc.secureserver.net (GoDaddy / Priced Right reseller portal)
2. Sign in as `carolina@hplacer.com`
3. Navigate to **Domain Manager** → hplacer.com

#### Follow Up Boss (Optional, for lead follow-up)

1. Open https://www.followupboss.com
2. Sign in with credentials (typically passed via 1Password or team password manager)
3. Verify the FUB_API_KEY is active (Admin → API)

#### Gemini (joe@forturro.com, for SEO/geo passes)

1. Open https://gemini.google.com
2. Sign in as `joe@forturro.com` (or the Joe account; this is for AI-assisted content review)

### Step 10: Recreate the Scheduled Blog-Publish Task

The `hplacer-blog-publish` routine auto-publishes queued blog posts **2×/week (Mon & Thu 6:10 AM)**. It must be recreated on the new machine because scheduled tasks live in `~/.claude/scheduled-tasks/` (local, not in git).

**Option A: Use the Schedule Skill (Recommended)**

```bash
# Create the routine via Claude Code's schedule skill
# (invoke from within Claude Code or via command line)
claude schedule create \
  --name "hplacer-blog-publish" \
  --cron "10 6 * * 1,4" \
  --description "2x/week auto-publish for hplacer.com blog queue (Mon & Thu 6:10am)" \
  --prompt "Auto-publish the queued Home Placer blog posts. [Full prompt from Step 10 in recovery guide]"
```

**Option B: Manual Recreation (If Schedule Skill Unavailable)**

If Claude Code's schedule/routine tools are not available, manually recreate the directory structure in `~/.claude/scheduled-tasks/`:

```bash
# Create the task directory
mkdir -p ~/.claude/scheduled-tasks/hplacer-blog-publish

# Create SKILL.md (the task definition) — use the content from /Users/spencer/.claude/scheduled-tasks/hplacer-blog-publish/SKILL.md
# (Copy the full SKILL.md from the previous machine or the repo if saved)
```

**Verification:**

```bash
# List active scheduled tasks
ls ~/.claude/scheduled-tasks/ | grep hplacer
# Expected: hplacer-blog-publish directory exists
```

---

## Summary: Recovery Checklist

| # | Step | Command / Action | Success Indicator |
|---|------|------------------|-------------------|
| 1 | Clone repo | `git clone https://github.com/homeplacer/hplacer-website.git` | Directory created, `git log` shows e553c4b |
| 2 | Install Node modules | `npm install` | `npm ls next` shows 16.2.9 |
| 3 | Generate manifests | `npm run manifests` | Output: "[manifests] gallery: X images; locations: Y towns" |
| 4 | Verify local dev | `npm run dev` then open http://localhost:3000 | Homepage loads with full site (models, homes browser, blog, etc.) |
| 5 | Auth wrangler | `wrangler auth` | `wrangler whoami` shows Home Placer account email |
| 6 | Set FUB_API_KEY | `wrangler secret put FUB_API_KEY` | Dashboard shows secret listed (value hidden) |
| 7 | Deploy | `npm run deploy` | "✨ Success! Deployed hplacer-app" message; custom domains listed |
| 8 | Verify prod | `curl https://hplacer.com/` | HTTP 200, HTML contains `<title>Home Placer</title>` |
| 9 | Test forms | Fill contact form on https://hplacer.com/contact | Lead appears in Follow Up Boss (or logs server-side if FUB_API_KEY not set) |
| 10 | Recreate schedule | Use schedule skill or manually recreate task directory | Routine runs Mon & Thu 6:10 AM UTC (or intended tz) |

---

## Critical Gotchas to Avoid

1. **Never re-run `build-models.mjs`** — it will erase hand-finalized pricing, floorPlans, and tourUrl fields in models.json. Edit models.json directly instead.

2. **Cloudflare account login is single-session** — log in to **ONLY** the Home Placer account. Switching to a personal account will break the deploy token. If you accidentally switch, re-run `wrangler auth` to re-auth to the correct account.

3. **fs.readFileSync doesn't work on Workers** — the runtime has no filesystem. OG images, galleries, and manifests must use static imports or inlined base64 (see og-hero.ts). Any attempt to fs.read at request time → HTTP 500 + dropped og:image tag.

4. **Build time = publish time for blog** — the date gate (`src/lib/blog.ts`) is evaluated at build time, not request time. A future-dated post only goes live when the site is rebuilt and deployed. The `hplacer-blog-publish` task handles this automatically on Mon/Thu, but manual edits to blog-posts.json require a redeploy to surface them.

5. **JSX whitespace after closing tags** — inline `</strong>` or `</a>` followed by text on the same line strips the space. Use `{" "}` after the closing tag if a space is needed.

6. **City canonical names matter** — Rabbit Ln + Hwy 139 = Conway; Pint Circle = Longs. Both placed-homes.json card locations AND placements.json map dots must match on any city move.

7. **No browsers logins transfer** — sign in fresh to Google, Bing, Cloudflare, registrar, FUB, Gemini on the new machine. Two-factor-auth codes may be needed.

---

## When to Redeploy (Triggers for `npm run deploy`)

Deploy when:

- **Blog posts are due to publish** (2×/week: Mon & Thu via hplacer-blog-publish task)
- **Code or config changes** committed to the branch (HANDOFF.md, env vars, etc.)
- **Data changes** to models.json, placed-homes.json, or blog-posts.json
- **Asset changes** to public/ (gallery, location images, favicon, OG hero)
- **A bug fix or feature is ready** for production

Do **not** deploy if you've only edited intermediate data files (_models-raw.json, etc.) — those don't affect the built site.
```
