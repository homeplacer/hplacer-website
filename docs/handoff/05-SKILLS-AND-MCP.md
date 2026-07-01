# 05 — Installed Skills & MCP Servers — Home Placer Website

This document catalogs the tools, skills, scheduled tasks, and MCP servers that power the hplacer.com development and deployment workflow. It covers: the deploy pipeline (Cloudflare Workers via OpenNext), the Claude Preview dev server, scheduled blog publishing, SEO automation via Gemini, and the browser-automation infrastructure.

---

## A. Deploy Pipeline: `npm run deploy` (Cloudflare Workers + OpenNext)

### Purpose & Architecture
The site runs as a **Next.js 16 full app** (SSR + SSG) hosted on **Cloudflare Workers** via the **OpenNext adapter** (`@opennextjs/cloudflare`). There is no `wrangler.toml` file in the repo (config is minimal and embedded in `open-next.config.ts`); Wrangler reads its auth and account ID from the logged-in user's local Cloudflare CLI state (`~/.wrangler/`).

**Stack trace:**
- Deploy script: `/Users/spencer/projects/hplacer/package.json` line 14
- OpenNext config: `/Users/spencer/projects/hplacer/open-next.config.ts` — uses the default Cloudflare adapter with optional R2 incremental cache (currently commented out).
- Build manifests: `/Users/spencer/projects/hplacer/scripts/build-manifests.mjs` — pre-deploy step that bundles static image metadata (gallery + locations) into JSON so the Workers runtime avoids filesystem I/O.

### When to Use
- Every time you commit code that changes the site. The repo's working tree is the source of truth, not git HEAD — deploy builds directly from the working directory.
- After publishing new blog posts (via the `hplacer-blog-publish` scheduled task, which runs deploy as part of its workflow).
- For manual fixes that don't warrant a git commit.

### Key Configuration & Secrets
Secrets are **NEVER in git**. They live in Cloudflare Worker secrets (production) and `.dev.vars` (local preview, git-ignored):
- **Cloudflare API Token**: Machine-level (`~/.wrangler/`), set via `wrangler login`
- **FUB_API_KEY**: Follow Up Boss integration; set via `wrangler secret put FUB_API_KEY` or CF dashboard
- **RESEND_API_KEY**: Optional email backups; same as above
- **FUB_WARRANTY_USER_ID** / **FUB_WARRANTY_COLLABORATORS**: Environment variables for service lead routing

### How to Deploy
```bash
cd /Users/spencer/projects/hplacer
npm run deploy
```

On first run after cloning to a new machine:
```bash
wrangler login
npm run deploy
```

### Common Gotchas
1. **Wrangler not logged in** → `npm run deploy` fails with "no token found" or 401. Solution: `wrangler login`.
2. **Cloudflare account mismatch** — Wrangler is logged in to Forturro's account instead of Home Placer's. Solution: `wrangler logout` → `wrangler login` to Home Placer account.
3. **No filesystem at runtime** — Never use `fs.readFileSync()` in production code. Gallery + locations images are bundled at build time via `/scripts/build-manifests.mjs`; OG hero photo is inlined as base64 in `/src/app/og-hero.ts`.
4. **Secrets don't appear in preview** — Until you run `wrangler secret put` or set them in the CF dashboard, the dev server won't have them. Leads will log but not deliver.

---

## B. Preview Dev Server: `hplacer` (Claude Preview @ localhost:3000)

### Purpose
Local Next.js development server for live editing + testing.

### Configuration
**Location:** `/Users/spencer/projects/hplacer/.claude/launch.json` (project-local)

Runs `npm run dev` on port 3000 with hot reload.

### How to Run
In Claude Code, invoke the preview tool via the preview toolbar or by typing "preview" / "run dev" in chat. Command-line equivalent: `npm run dev`.

### Limitations
- No Cloudflare Workers runtime (runs full Node.js). Some edge-specific code behaves differently — for real testing, use `npm run preview` (local Cloudflare simulation) or deploy to staging.
- Lead capture logs to stdout; doesn't hit FUB/Resend unless secrets are in `.dev.vars`.

---

## C. Scheduled Task: `hplacer-blog-publish` (2x/week Auto-Publishing)

### Purpose
Automated blog publication every **Monday & Thursday at 6:10 AM**. The site uses **date-gated publishing** (posts hidden until their scheduled date; gate evaluated at build time). The task rebuilds + redeploys the site on each publish date, surfacing any newly-due posts.

### Location & Metadata
- **SKILL playbook**: `~/.claude/scheduled-tasks/hplacer-blog-publish/SKILL.md` (full steps, verification, error handling)
- **Post queue**: `data/blog-posts.json` (36 posts as of 2026-07-01, auto-publishing through ~Aug 6)
- **Date-gate logic**: `src/lib/blog.ts` lines 19–34 (`getAllPosts()` filters to `p.date <= TODAY`)

### How It Works
1. Cron trigger fires 2x/week (Mon & Thu, 6:10 AM)
2. Script checks `data/blog-posts.json` for posts due today or overdue
3. If posts are due, runs `npm run deploy` (rebuilds with today's date, surfacing newly-due posts)
4. Verifies posts are live via HTTP 200 to `/blog/<slug>`
5. Runs `node scripts/indexnow.mjs` to ping Bing/Yandex/DuckDuckGo for rapid indexing
6. Reports which posts went live and total blog count

### Queue Status & Refill Timeline
- **As of 2026-07-01:** 36 posts scheduled, auto-publishing 2x/week. Queue empties ~Aug 6.
- **TODO:** Around Aug 6, write ~12 more posts to hit Gemini's 90-day cadence (refresh `data/blog-posts.json` with future dates spread over next 90 days).

### Monitoring & Troubleshooting
Check the queue:
```bash
cd /Users/spencer/projects/hplacer
python3 -c "import json,datetime; d=json.load(open('data/blog-posts.json')); t=datetime.date.today().isoformat(); due=[p['slug'] for p in d if p['date']==t]; fut=[p['slug'] for p in d if p['date']>t]; print('due today:',due); print('future remaining:',len(fut))"
```

Manually trigger: If the task failed (e.g., wrangler auth issue), re-run from the scheduled-tasks UI or invoke the SKILL.md prompt directly in a Claude Code session.

Deploy failures: The task checks `npm run deploy` exit code. If it fails, the task reports the error and stops (does NOT retry).

---

## D. IndexNow Ping Script

### Purpose
Instantly notify Bing, Yandex, DuckDuckGo, and the shared IndexNow network of live URLs so new/changed pages are crawled in hours instead of weeks.

### Location & Usage
- **Script**: `/Users/spencer/projects/hplacer/scripts/indexnow.mjs`
- **Ownership key**: `e0e445eaf75d61f3faee17b699eca3b9` (public; key file at `public/e0e445eaf75d61f3faee17b699eca3b9.txt` for domain verification)

### How to Run
```bash
# Submit every URL from the sitemap
node /Users/spencer/projects/hplacer/scripts/indexnow.mjs

# Submit specific URLs
node /Users/spencer/projects/hplacer/scripts/indexnow.mjs https://hplacer.com/blog/new-post
```

### Response Codes
- 200/202: Success; crawled within hours
- 403 "SiteVerificationNotCompleted": Key not verified yet; re-run after 24 hours (expected on first submission)
- 422: URL didn't match host; check format
- ≥400 (other): Report to user; do not retry immediately

### Integration with Blog Publishing
The `hplacer-blog-publish` task calls this after a successful deploy. No manual intervention needed.

---

## E. SEO & Geographic Optimization Workflow (Gemini-Driven)

### Purpose & Rule
**Standing rule (Joe, 2026-06-29):** Every page buildout on hplacer.com (and Forturro properties) **must include an SEO + geo (local) pass via Gemini** before finalizing. This ensures Google-aligned content strategy and deep local relevance (Horry County / Grand Strand / SC+NC service area).

### How It Works
1. **Open Gemini** in the session Chrome (`gemini.google.com`; Joe stays logged in as `joe@forturro.com`)
2. **Prompt as a top Google Search engineer** with the page's URL/title/current draft and ask for:
   - Optimal title tag (50–60 chars, keyword + local)
   - Meta description (155–160 chars, compelling + geographic)
   - H1/H2 structure (clear hierarchy; keywords naturally distributed)
   - Target keywords + local/geo terms (e.g., "manufactured homes Horry County SC")
   - Schema.org / structured-data types (LocalBusiness, FAQPage, BreadcrumbList)
   - Internal linking suggestions
3. **Cross-check** Gemini's output with your own SEO knowledge (don't blindly apply)
4. **Apply** the guidance to the page's JSX + metadata + schema

### Memory Reference
- **File**: `~/.claude/projects/-Users-spencer/memory/feedback_seo_geo_gemini.md` (last updated 2 days ago)
- **Workflow name**: `seo-geo-gemini-rule`

### Browser Setup & Tools
- **Browser**: Session Chrome (desktop app), logged in as Joe
- **MCP to use**: `Claude-in-Chrome` (tools named `mcp__claude-in-chrome__*`) — DOM-aware, more reliable than desktop app
- **No automation script**: This is a manual workflow per page. Gemini's guidance is treated as advice, not hard rules.

### Examples from Repo
Recent pages that went through SEO+geo pass: `/homes` (inventory browser), `/locations` (27 city-specific pages), `/financing` (FHA/VA/USDA messaging), `/process` (buyer timeline), blog posts (title + description + H1).

---

## F. Browser Automation Infrastructure & Techniques

### MCP Servers in Use

#### 1. Claude-in-Chrome (Browser Automation)
**Purpose**: Automate web interactions: navigate pages, fill forms, scrape data, take screenshots. DOM-aware (reads/clicks actual elements, not pixels).

**Tools**: `navigate`, `fill`, `click`, `screenshot`, `read_page`, `get_page_text`, `find`, `javascript_tool`

**Installation**: Chrome extension on the user's desktop; must be running to connect.

**Verify connection**: Call `mcp__claude-in-chrome__list_connected_browsers`. If empty, user must open Chrome and install/enable the extension.

**Setup for hplacer**: Joe is logged into Gemini (joe@forturro.com), GBP (Google Business Profile), Google Search Console (carolina@hplacer.com), Bing Webmaster (carolina@hplacer.com).

#### 2. Claude Preview (Dev Server MCP)
**Purpose**: Launch and manage the local preview server. Reads `.claude/launch.json` configurations and runs `npm run dev`.

**Configuration**: `/Users/spencer/projects/hplacer/.claude/launch.json`

**Reconnection**: Automatic on session startup; if the dev server dies, click "restart" in the preview toolbar.

#### 3. Computer-use (macOS Desktop Control)
**Purpose**: Control native desktop: screenshot, click, type, scroll. Used for tools/apps outside the browser.

**Tools**: `mcp__computer-use__*`

**When needed**: Viewing the desktop state, opening native apps, or controlling apps without dedicated MCPs.

**Permissions**: User must grant access per app tier (read, click, full). Browsers default to "read" (visible but clicks blocked).

**Link safety**: NEVER click web links with computer-use tools; use Claude-in-Chrome instead.

#### 4. ccd (Claude Code Session / Memory)
**Purpose**: Session management, memory search, transcript management. Allows scheduling routines, persisting context across sessions, searching past transcripts.

**Tools**: `mcp__ccd_session_mgmt__*` (list_sessions, search_session_transcripts, send_message, archive_session)

**Memory file path**: `~/.claude/projects/-Users-spencer/memory/` (local to old machine; copy to new machine or recreate from git log + HANDOFF.md)

### Project-Local MCP Setup
No additional MCPs are configured in the project `.claude/` directory beyond `launch.json`. All other MCPs (Chrome, computer-use, ccd) are **machine-level and session-wide**, not project-specific.

---

## G. Browser Login Sessions & Account Rules

### Critical Rule: Home Placer Accounts
**⚠️ RULE (HANDOFF.md §6):** Keep Home Placer's accounts under **`carolina@hplacer.com`** ("Home Placer Carolina"), **NEVER Joe's Forturro email** (`info@forturro.com` / `joe@forturro.com`). Learned the hard way — Bing was mistakenly put under `info@forturro.com` and had to be moved.

### Logins in Session Chrome

| Service | Email | Purpose |
|---|---|---|
| Gemini (Google AI) | `joe@forturro.com` | SEO brainstorm + page drafting |
| Google Search Console | `carolina@hplacer.com` | Sitemap submissions; search analytics |
| Google Analytics 4 | `carolina@hplacer.com` | Traffic + user behavior data |
| Google Business Profile | `carolina@hplacer.com` | Reviews, hours, NAP consistency |
| Bing Webmaster Tools | `carolina@hplacer.com` | Sitemap submissions; crawler insights |
| Bing Places for Business | `carolina@hplacer.com` | Business listing (needs PIN verify by Joe) |
| Cloudflare | Home Placer account | DNS, SSL/TLS, Workers secrets |
| Registrar (Priced Right Domains) | `carolina@hplacer.com` | Renewal, transfer-in (PAUSED at transfer step) |
| Follow Up Boss | API-only (FUB_API_KEY) | Lead CRM integration |

### Migration Checklist (New Machine)
These logins **do NOT transfer** — re-auth on the new machine:
1. **Cloudflare CLI**: `wrangler login` (redirects to browser)
2. **Session Chrome**: Open `gemini.google.com`, `google.com/search?q=Home+Placer`, `bing.com/webmasters`, `cloudflare.com` and sign in as respective emails (passwords browser-saved if 2FA disabled)
3. **Scheduled task env**: If recreating `hplacer-blog-publish`, the task is location-independent; no additional auth needed once wrangler is logged in

---

## H. Data Loaders & Static Manifests (Workers Runtime Compatibility)

### Why Manifests Exist
Cloudflare Workers runtime has **no readable filesystem at request time**. The site solves this by bundling static metadata at build time:

| Manifest File | Content | Generated By | Used By |
|---|---|---|---|
| `data/gallery-manifest.json` | List of image filenames in `public/gallery/` | `/scripts/build-manifests.mjs` | `/src/lib/gallery.ts` (gallery page) |
| `data/locations-manifest.json` | Town slug → image filenames in `public/locations/[town]/` | Same | `/src/lib/locations.ts` (per-city galleries) |
| `og-hero.ts` | Base64-encoded hero photo (1200w × 630h, q62) | Manual (sips + base64) | `/src/app/opengraph-image.tsx` (OG image generation) |

### Build Workflow
1. **Pre-deploy**: `npm run deploy` includes `node scripts/build-manifests.mjs` as first step (package.json line 14)
2. **Generates**: `data/gallery-manifest.json` and `data/locations-manifest.json` from disk
3. **No fs in production**: Next.js build bundles these JSON files as static imports; Workers runtime never calls `fs.readFileSync()`

### If You Add New Images
- Gallery images → `public/gallery/`; re-run `npm run manifests` or `npm run deploy`
- Town-specific images → `public/locations/[town]/`; same
- OG hero photo → `/src/app/og-hero.ts` (resize to 1200×630, q62, base64 inline)

---

## I. Blog Generation Workflow Pattern

### High-Level Flow
1. **Brainstorm + draft**: Gemini (browser) + human editing
2. **Bulk-add to JSON**: Edit `data/blog-posts.json` manually, adding objects with slug, title, description, date, readMinutes, tags, bodyMarkdown
3. **Schedule dates**: Spread posts over next 90 days at 2/week cadence (Mon/Thu publish dates)
4. **Deploy manually or wait for cron**: Commit + `npm run deploy`, or wait for `hplacer-blog-publish` task to auto-publish on scheduled date

### Key Rules
- **No H1 in bodyMarkdown** — the title renders separately via the page layout. Start with `##` (H2) for section headings.
- **Parse date at build time** — the gate (TODAY) is evaluated when `npm run build` runs. A post dated 2026-07-05 goes live only after a build/deploy on or after that date.

---

## J. Summary: Skills & MCPs at a Glance

| Tool / Skill | Type | When to Use | Status |
|---|---|---|---|
| `npm run deploy` | Script | Every code change; also called by blog-publish task | ✅ **Live** (core) |
| `npm run dev` / Claude Preview | Dev server | During active development | ✅ **Live** |
| `hplacer-blog-publish` | Scheduled task | 2x/week (Mon & Thu 6:10 AM) | ✅ **Live** (refill needed ~Aug 6) |
| IndexNow ping script | Utility | After deploying new/updated pages | ✅ **Live** |
| Gemini SEO workflow | Manual (browser) | Before finalizing any new page | ✅ **Live** (standing rule) |
| Claude-in-Chrome MCP | Browser automation | Automate Gemini, GBP, GSC interactions | ✅ **Depends on extension** |
| Wrangler CLI (Cloudflare) | Auth + deploy | Deploy to Cloudflare; manage secrets | ✅ **Re-auth on new machine** |
| ccd session & memory | Session mgmt | Reference past work; schedule tasks | ✅ **Machine-local**; copy to new machine |

---

## K. New Machine Setup Checklist

### To Resume hplacer Development on a Fresh Mac:

1. **Clone repo**:
   ```bash
   git clone https://github.com/homeplacer/hplacer-website.git /Users/spencer/projects/hplacer
   cd /Users/spencer/projects/hplacer
   npm install
   ```

2. **Wrangler auth (for deploy)**:
   ```bash
   wrangler login
   ```

3. **Dev server**: Use Claude Preview toolbar or `npm run dev`

4. **Browser logins**: Open Chrome → navigate to Gemini, GSC, Bing, Cloudflare and sign in as respective emails

5. **Memory files** (optional; for context):
   ```bash
   # Copy from old machine if available:
   # ~/.claude/projects/-Users-spencer/memory/project_hplacer_rebuild.md (exhaustive log)
   # ~/.claude/projects/-Users-spencer/memory/feedback_seo_geo_gemini.md (SEO rule)
   # Otherwise, rely on this HANDOFF.md + git log
   ```

6. **Scheduled tasks** (optional; if you want auto-publish on new machine): Recreate `hplacer-blog-publish` via Claude Code scheduled-tasks UI using the SKILL.md from old machine as template

---

## L. Gotchas & Debugging

### Deploy Issues
| Problem | Cause | Solution |
|---|---|---|
| `npm run deploy` → "no token found" | Wrangler not logged in | `wrangler login` |
| `npm run deploy` → 401 Unauthorized | Logged into wrong CF account | `wrangler logout` → `wrangler login` to Home Placer account |
| `npm run deploy` → "Workers KV namespace not found" | Cloudflare zone config issue | Check CF dashboard → Home Placer zone → Settings |
| `npm run preview` → localhost:3000 doesn't load | OpenNext build failed | Check terminal output; likely syntax error. Fix + rebuild. |

### Blog Publishing
| Problem | Cause | Solution |
|---|---|---|
| Blog post not live on publish date | Post date is future; or deploy didn't run | Check `data/blog-posts.json`; confirm date ≤ today. Run `npm run deploy` manually. |
| IndexNow returns 403 "SiteVerificationNotCompleted" | Happens on first submission; CF verifying key | Re-run `node scripts/indexnow.mjs` after 24 hours. Not an error. |
| Blog post shows but URL is 404 | Slug mismatch | Verify `/blog/[slug]/page.tsx` resolves by slug. Check data/blog-posts.json slug field. |

### Browser & MCP Issues
| Problem | Cause | Solution |
|---|---|---|
| Gemini workflow stuck (no browser input) | Chrome MCP not connected | Call `mcp__claude-in-chrome__list_connected_browsers`. If empty, user must open Chrome + install extension. |
| Wrangler commands time out or hang | Network issue or CF API down | Check `wrangler version` + `wrangler whoami`. Retry after 1 minute. If persistent, check CF status page. |

---

## M. Cross-References to Other Handoff Files

- **01-OVERVIEW-CHECKLIST.md** — Current project status, open TODOs, account rules
- **02-FOLDER-GUIDE.md** — File structure + key data files (models.json, blog-posts.json, etc.)
- **03-PAGE-TEMPLATES.md** — How to add/edit pages, schema patterns, SEO rules
- **04-DATA-WORKFLOWS.md** — Model extraction, pricing, placed-homes, location data
- **06-...** (other sections as written)

---

**Last updated:** 2026-07-01 (session checkpoint: e553c4b)  
**Next review:** When new skills/MCPs are integrated or scheduled tasks are added.
