# 03-DEVELOPMENT-STANDARDS.md

## Naming & File Organization

### File Naming Conventions
- **Components:** PascalCase (e.g., `SiteHeader.tsx`, `HomeCard.tsx`)
- **Utilities & helpers:** camelCase (e.g., `home-types.ts`, `attribution.ts`)
- **API routes:** kebab-case with directory-based routing (e.g., `/src/app/api/lead/route.ts`)
- **Data files:** kebab-case (e.g., `models.json`, `blog-posts.json`, `placed-homes.json`)
- **Scripts:** kebab-case with `.mjs` extension (e.g., `build-models.mjs`, `build-manifests.mjs`)

### Folder Structure

```
src/
├── app/                          # Next.js 16 App Router
│   ├── (pages)                   # Marketing/public pages
│   ├── api/                      # Route handlers
│   │   └── lead/route.ts         # Lead capture endpoint
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Homepage
│   ├── robots.ts                 # SEO robots.txt
│   ├── sitemap.ts                # Dynamic XML sitemap
│   ├── opengraph-image.tsx       # OG preview image
│   ├── og-hero.ts                # Base64-inlined OG hero photo
│   └── llms.txt/route.ts         # AI crawler policy
├── components/                   # React components
│   ├── home-card.tsx             # Server components (no "use client")
│   ├── homes-browser.tsx         # Client components ("use client")
│   ├── site-header.tsx
│   ├── site-footer.tsx
│   └── ... (23 total)
├── lib/                          # Pure helpers & data loaders
│   ├── home-types.ts             # Types + pure helpers (client-safe)
│   ├── homes.ts                  # Server-only data loader
│   ├── blog.ts                   # Blog loader + scheduling
│   ├── lead.ts                   # Lead submission helper
│   ├── site.ts                   # Business facts (single source of truth)
│   ├── jsonld.tsx                # JSON-LD schema generation
│   ├── attribution.ts            # First-touch attribution
│   ├── analytics.ts              # GA4 event tracking
│   └── ... (18 total)
└── middleware.ts                 # Next.js edge middleware (HTTPS force)

data/                             # Static data (imported, not fs-read at runtime)
├── models.json                   # 93 manufactured homes
├── blog-posts.json               # 36 posts (with date-based scheduling)
├── placed-homes.json             # 73 recently-placed homes
├── setup-pricing.json            # Full-setup pricing (empty {} until finalized)
├── home-pricing.json             # Home-only pricing (empty {} until finalized)
├── gallery-manifest.json         # Gallery image filenames
├── locations-manifest.json       # Location page image directories
└── ... (more manifests + raw extracts)

public/                           # Static assets (images, icons, etc.)
├── logo.png
├── gallery/                      # Gallery images
├── locations/                    # Location-specific images
├── models/                       # Home model photos
└── ...

scripts/                          # Build & deploy automation
├── build-manifests.mjs           # Bundles file lists for no-fs runtime
├── build-models.mjs              # Merges extraction workflow → models.json
├── build-blog.mjs
├── indexnow.mjs                  # Pings IndexNow on publish
└── ...
```

---

## TypeScript Standards

### Strict Mode Enabled
`tsconfig.json` sets `"strict": true`, requiring:
- Explicit types on function parameters and returns
- No implicit `any`
- Null/undefined checks
- Module-level isolation

### Type Organization

**`src/lib/home-types.ts`** (client-safe)
- Type definitions used by client components (no Node imports).
- Pure helper functions that compute derived data.
- **Rule: NO `import fs`, `import path`, or any Node API** — this module bundles into client bundles.

Example types:
```typescript
export type Brand = "Clayton" | "Cavco" | "Champion";
export type WallFinish = "drywall" | "drywall-optional" | "strips";

export interface Home {
  id: number;
  slug: string;
  brand: Brand;
  // ... 18 fields total
}

// Pure helpers live here — no side effects, no data loading
export function isFullDrywall(h: Home): boolean { ... }
export function displayPrice(h: Home): number | undefined { ... }
```

**`src/lib/homes.ts`** (server-only)
- Static import of JSON data (no `fs.readFileSync` at runtime).
- Server-side loaders and caching logic.
- Re-exports public types from `home-types.ts`.

```typescript
import rawModels from "../../data/models.json";
// Static import → bundled into the server build, available at runtime.

let cache: Home[] | null = null;

export function getAllHomes(): Home[] {
  if (cache) return cache;
  // transform rawModels...
  cache = homes;
  return homes;
}
```

### Interfaces vs Types
- **Interfaces** for object shapes that will be extended or implemented (e.g., `LeadBody`, `Attribution`).
- **Types** for unions, primitives, and fixed records (e.g., `Brand`, `LeadType`, `WallFinish`).
- **Record<K, V>** for dynamic maps (e.g., pricing lookups, flat field maps).

---

## React Patterns

### Server vs Client Components

**Default: Server Components**
- Pages, layouts, and leaf components are server components unless they need interactivity.
- Fetch data on the server; pass serialized props to clients.
- No "use client" = smaller JS bundle, faster TTFB.

**Client Components ("use client")**
- Add `"use client";` at the top of components needing:
  - `useState`, `useContext`, `useEffect`, `useRef`
  - Event handlers (form submits, click handlers, etc.)
  - localStorage access
  - Client-side analytics

Current client components: `homes-browser.tsx` (filters/search), `financing-form.tsx`, `email-capture.tsx`, `site-header.tsx` (mobile menu), `zoom-image-modal.tsx`, `placements-map.tsx` (Leaflet), and 17 others (see `/src/components/` for the full list).

### Styling

- **Tailwind v4** with custom CSS variables for the slate color ramp + pink accents.
- **Dark mode** not used; light backgrounds only.
- Custom classes in `src/app/globals.css` for brand colors and spacing.

### Props & Destructuring

```typescript
// ✅ OK: component takes a single typed prop object
export function HomeCard({ home }: { home: Home }) { ... }

// ✅ Preferred: import the type
import type { Home } from "@/lib/home-types";
export function HomeCard({ home }: { home: Home }) { ... }

// ✗ Avoid: no implicit props
function Foo(props) { ... }
```

### Whitespace in JSX

**⚠️ GOTCHA:** Inline closing tags strip trailing whitespace.

```typescript
// ✗ WRONG — no space between </strong> and "text"
<strong>Name</strong>text here  // renders "Nametext"

// ✅ RIGHT — use {" "} after closing tag
<strong>Name</strong>{" "}text here  // renders "Name text"
```

This applies to any closing tag followed by text on the same line.

---

## Backend / Route Handler Patterns

### `/api/lead` — Unified Lead Intake

**Location:** `src/app/api/lead/route.ts` (392 lines)

**Contract:**
```typescript
interface LeadBody {
  type?: "contact" | "financing" | "service" | "subscribe";
  name?: string;
  phone?: string;
  email?: string;
  home?: string;
  hasLand?: string;
  address?: string;
  message?: string;
  attribution?: Attribution;  // first-touch data from browser
}

// Response: { ok: true } on success, 4xx/5xx on validation error
```

**Delivery Pipeline (no provider is required; all optional):**

1. **Validation:** Name + phone for contact/financing/service; email for subscribe.
2. **Follow Up Boss (FUB):** If `FUB_API_KEY` is set, creates/matches a person + event.
   - Phone normalized to E.164 (`+1XXXXXXXXXX` for US).
   - Service requests: assign brand-new contacts to `FUB_WARRANTY_USER_ID` (default 39 = Brett); existing contacts are NEVER reassigned.
   - Always opens a task for the warranty owner (even if existing contact).
3. **Resend Email:** If `RESEND_API_KEY` is set, emails the team (default: `leads@hplacer.com`; service leads can go to `WARRANTY_LEADS_TO`).
4. **Server Logs:** Always logged as `[hplacer] lead (type): {...}` — the fallback safety net.

**Error Handling:**
- `Promise.allSettled()` fires both FUB + Resend in parallel; neither failure breaks the user's submission.
- Server catches errors and logs them; user always gets `{ ok: true }` if validation passed.
- No CORS (same-origin only).

### Error Handling Strategy

- **Validation errors:** Return 4xx with `{ error: "message" }`.
- **Service errors (FUB, Resend):** Log to console, don't throw — user still gets success.
- **Async operations:** Use `Promise.allSettled()` to fire independent operations and collect results without crashing on a single failure.

```typescript
const results = await Promise.allSettled([deliverToFub(lead), deliverByEmail(emailLead, type)]);
results.forEach((r, i) => {
  if (r.status === "rejected") {
    console.error(`[hplacer] lead delivery ${i} failed:`, r.reason);
  } else if (!r.value.ok && !r.value.skipped) {
    console.error(`[hplacer] lead delivery ${i} non-ok:`, r.value);
  }
});
```

### Logging Conventions

- **Prefix:** `[hplacer]` for all logs, making them easy to grep in Cloudflare logs.
- **Level:** Use `console.log()` for success, `console.error()` for failures.
- **Content:** Always include operation, lead type, and relevant IDs (person, status code, etc.).

```typescript
console.log(`[hplacer] lead (${type}):`, { ...lead, at: new Date().toISOString() });
console.error(`[hplacer] FUB /events ${eventRes.status} for ${lead.type} lead:`, errBody.slice(0, 500));
```

---

## Data Layer Patterns

### Static Imports (No Runtime FS)

**Rule:** Cloudflare Workers runtime has NO filesystem at request time. Everything must be:
1. Static-imported JSON (`import data from "../../data/file.json"`), or
2. Inlined as base64 (e.g., OG hero image)

**✗ WRONG:**
```typescript
import fs from "fs";
const data = fs.readFileSync("data/models.json", "utf8");  // 500 at runtime
```

**✅ RIGHT:**
```typescript
import rawModels from "../../data/models.json";
// Bundled at build time; available at request time.
```

### Data Loaders & Caching

Use a module-level `let cache` singleton to avoid re-parsing on every request:

```typescript
let cache: Home[] | null = null;

export function getAllHomes(): Home[] {
  if (cache) return cache;
  const models = rawModels as unknown as RawModel[];
  const homes = models.map((m, i) => ({ id: i + 1, ...transform(m) }));
  cache = homes;
  return homes;
}
```

### Data Files (Edit Directly, Never Re-run Build Scripts)

| File | Purpose | Editing Rule |
|------|---------|--------------|
| `data/models.json` | 93 manufactured homes | ✅ **Edit by hand** — never re-run `build-models.mjs` (would lose floorPlans, tourUrl, and hand-finalized drywall tags). |
| `data/blog-posts.json` | 36 posts with date gating | ✅ Edit by hand; future dates hide posts until deploy day. |
| `data/placed-homes.json` | 73 recently placed | ✅ Edit by hand. |
| `data/setup-pricing.json` | Full-setup pricing by slug | ✅ Edit by hand; currently empty `{}`. |
| `data/home-pricing.json` | Home-only pricing by slug | ✅ Edit by hand; currently empty `{}`. |
| `data/gallery-manifest.json` | Gallery image filenames | ❌ Auto-generated by `build-manifests.mjs` on every build. |
| `data/locations-manifest.json` | Location image directories | ❌ Auto-generated by `build-manifests.mjs` on every build. |

**Why not re-run `build-models.mjs`:**
- It extracts from raw workflow outputs, losing hand-curated data.
- Fields like `floorPlans`, `tourUrl`, `wallFinish` (drywall badges), and `bestSellerRank` are manually added post-extraction.
- Re-running would overwrite all of that with blanks.

### Blog Scheduling

Blog posts use **date-gated publishing** evaluated at BUILD TIME:

```typescript
const TODAY = new Date().toISOString().slice(0, 10);  // Captured at deploy time

export function getAllPosts(): Post[] {
  return getScheduledPosts().filter((p) => p.date <= TODAY);
}
```

- Posts with `date` ≤ today's deploy date are published.
- Future-dated posts hide until a redeploy on/after their date.
- No database, no scheduled job — just re-deploy to surface scheduled posts.

**Note:** `hplacer-blog-publish` scheduled task auto-deploys Mon & Thu through ~Aug 6 (36 posts planned; queue empties then).

---

## OG (Open Graph) Image Generation

**⚠️ CRITICAL GOTCHA:** Workerd has no filesystem.

**Location:** `src/app/opengraph-image.tsx` + `src/app/og-hero.ts`

The hero photo must be **inlined as base64** in `og-hero.ts`:

```typescript
// src/app/og-hero.ts
export const heroBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABA..."  // full base64

// src/app/opengraph-image.tsx
import { heroBase64 } from "./og-hero";
// Use heroBase64 directly in JSX or Satori rendering
```

**To update the OG photo:**
1. Resize to 1200×630px @ 62% quality using `sips` or ImageMagick.
2. Base64-encode the JPG.
3. Replace the string in `og-hero.ts`.
4. Deploy; the new image renders on link previews.

**Why not `fs.readFileSync`:**
- Cloudflare Workers can't read files at request time → HTTP 500 + missing og:image tag on social.

---

## API Conventions

### `/api/lead` Request Shape

```typescript
{
  type: "contact" | "financing" | "service" | "subscribe",
  name: string,
  phone: string,
  email: string,
  home: string,           // e.g. "Ultra Flex 28×52"
  hasLand: string,        // e.g. "Yes" / "No"
  address: string,        // Existing home address (for service)
  message: string,
  attribution: {
    utm_source?: string,
    utm_medium?: string,
    utm_campaign?: string,
    utm_content?: string,
    utm_term?: string,
    gclid?: string,
    fbclid?: string,
    referrer?: string,
    landing_page?: string,
    captured_at?: string  // ISO timestamp
  }
}
```

### Sanitization & Normalization

- **Phone:** Normalized to E.164 (`+1XXXXXXXXXX`).
- **Strings:** Trimmed, max 500 chars for attribution fields.
- **Attribution keys:** Whitelisted (unknown keys dropped).

---

## First-Touch Attribution

**Browser-side capture:** `src/lib/attribution.ts`
- Runs on first page load; stores once in localStorage (survives multi-page browsing).
- Captures: UTM params, gclid, fbclid, referrer, landing page, timestamp.
- Readonly after first capture (first-touch wins).
- Fails gracefully if storage is blocked (private mode).

**Form submission:** `src/lib/lead.ts`
- Reads attribution from localStorage before submitting.
- Forwards it to `/api/lead` as the `attribution` field.
- Logged on FUB timeline as a human-readable attribution block.

---

## Testing Standards

**Current state:** Minimal formal test coverage.
- No Jest or Vitest setup.
- Manual testing is the norm (dev preview, staging deploy, live verification).

**Recommended practices (not yet enforced):**
- Unit tests for pure helpers (`home-types.ts` functions, formatting, price logic).
- Integration tests for data loaders (call `getAllHomes()`, verify cache, check pricing merge).
- E2E tests for lead submission (mock FUB, verify request shape, check server logs).

**To add testing:**
```bash
npm install --save-dev vitest @testing-library/react
# Create tests/ folder parallel to src/
```

---

## Commit & Version Control

### Commit Message Style

**Format:** Imperative present tense, focused on the "why."

```
Add first-touch attribution capture → forward to FUB

Captures utm/gclid/referrer on first page load, survives multi-page browsing,
and attaches to every form submission for accurate lead source tracking in FUB.
```

**Convention:** Commits include `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` footer when generated by Claude.

**Recent commits:**
```
e553c4b Session checkpoint: blog engine, search infra, listings, OG image, cross-over
dea6f72 Add first-touch attribution capture → forward to FUB
cb1bc9b Add 4 Cavco Douglas/Fleetwood models from floorplan PDFs + fix Sebastian
983e002 FUB: open a warranty task on every service request
97e0275 Force HTTPS via middleware (loop-safe http->https 308)
```

### Branch & Deploy

- **Working branch:** `first-touch-attribution` (current).
- **Deploy model:** Builds from working tree, NOT git HEAD — uncommitted files are source of truth.
- **⚠️ Migration note:** ~60 uncommitted files as of 2026-07-01. Must commit + push to ensure new clone has all site files.

---

## Environment Variables & Secrets

### Cloudflare Worker Secrets

Set via `wrangler secret put` or Cloudflare Dashboard (Settings → Variables):

| Variable | Purpose | Required? | Default |
|----------|---------|-----------|---------|
| `FUB_API_KEY` | Follow Up Boss event creation | No | None; skips FUB delivery if missing |
| `RESEND_API_KEY` | Email lead copies | No | None; skips email if missing |
| `FUB_WARRANTY_USER_ID` | Owner for new service leads | No | 39 (Brett) |
| `FUB_WARRANTY_COLLABORATORS` | CSV of collaborator IDs | No | `1,35,46` (Joe, Tara, Wade) |
| `LEADS_TO` | Email recipient for leads | No | `leads@hplacer.com` |
| `LEADS_FROM` | Email sender | No | `Home Placer <leads@hplacer.com>` |
| `WARRANTY_LEADS_TO` | Optional separate service email | No | Falls back to `LEADS_TO` |

### Dev Environment

`.env.example` documents all vars; `.dev.vars` (git-ignored) holds local overrides for `npm run dev`.

### Account Rules

**⚠️ RULE:** Keep Home Placer's accounts under `carolina@hplacer.com`, NEVER Joe's Forturro info@/joe@ addresses.
- Google Search Console, GA4, Google Business Profile → carolina@
- Bing Webmaster, Bing Places → carolina@
- Cloudflare account (hplacer.com zone) → Home Placer account
- Follow Up Boss API → FUB_API_KEY (stored as Worker secret)

---

## Documentation & Comments

### Inline Comments

- **Why, not what:** Comments explain non-obvious intent.
  ```typescript
  // Good: explains decision
  const ATTR_KEYS: (keyof Attribution)[] = [
    "utm_source", "utm_medium", "utm_campaign", // marketing attribution
    "gclid", "fbclid",                          // platform click IDs
    "referrer", "landing_page",                 // organic/direct source
  ];
  
  // Avoid: restates code
  // const ATTR_KEYS = ...  // Declare ATTR_KEYS
  ```

- **Function headers for non-trivial logic:**
  ```typescript
  /**
   * Normalize to E.164 to maximize FUB's email/phone auto-merge match rate.
   * US-centric: 10 digits → +1XXXXXXXXXX; 11 digits starting with 1 → +1...
   */
  function normalizePhone(raw: string | null): string | null { ... }
  ```

### Module Documentation

Each file starts with a brief module comment:

```typescript
// Client-safe types and pure helpers. NO Node (fs/path) imports here, so this
// module can be bundled into client components. The fs-backed data loader lives
// in homes.ts (server-only).
```

### README & Guides

- **HANDOFF.md:** Session handoff + deployment checklist (read first).
- **DEPLOY.md:** Cloudflare Workers + OpenNext build & deploy details.
- **AGENTS.md:** ⚠️ Next.js 16 has breaking changes; see `node_modules/next/dist/docs/`.

---

## Key Gotchas & Rules

| Gotcha | Impact | Solution |
|--------|--------|----------|
| `fs.readFileSync` at runtime | HTTP 500, missing og:image | Static JSON imports + base64 inlining only. |
| Re-running `build-models.mjs` | Wipes floorPlans, tourUrl, drywall tags | Edit `data/models.json` by hand; never rebuild. |
| Whitespace after inline closing tags | Missing spaces in rendered text | Use `{" "}` after `</strong>`, `</a>`, etc. |
| FUB personal property matching | Leads don't auto-merge by email | Normalize phone to E.164; send both email + phone. |
| City reassignments | Map dots ≠ card locations | Update both `placed-homes.json` AND `placements.json` on city moves. |
| Service request routing | Steal existing leads | Only assign brand-new (201) contacts; task for all. |
| Cloudflare 503 transient errors | False build failure | Concurrent rapid crawls → 503. Retry sequentially. |
| Next 16 breaking changes | Silent build/deploy errors | Read AGENTS.md + next/dist/docs before writing code. |
| Pricing updates | Affects sort/filter availability | Fill `setup-pricing.json` + `home-pricing.json` to unlock; currently both `{}`. |
| Blog queue refill | Auto-publish ends ~Aug 6 | 36 posts planned; need ~12 more for 90-day cadence by Aug 6. |
| Domain transfer paused | HSTS & registrar move blocked | Complete transfer to Cloudflare Registrar first. |

---

## Performance & SEO

### Build Time Optimization

- **Static imports only:** No `fs.readFileSync` at build time or runtime.
- **Manifests generated at build:** `scripts/build-manifests.mjs` runs before every build (wired into `prebuild`).
- **Prebuilt OpenNext:** `npm run deploy` runs `opennextjs-cloudflare build && deploy`; no Node runtime needed on Workers.

### SEO & Metadata

- **Root metadata:** Set in `src/app/layout.tsx` (title template, OG, geo tags).
- **Page-level metadata:** Export `generateMetadata()` from each page route.
- **JSON-LD schema:** `src/lib/jsonld.tsx` generates LocalBusiness + Product + Review schemas; injected via `<JsonLd />` component.
- **Sitemap:** `src/app/sitemap.ts` dynamically generates from homes + locations + pages.
- **Robots.txt:** `src/app/robots.ts` allows all crawlers, disallows `/admin` (none exists).
- **IndexNow:** `scripts/indexnow.mjs` pings IndexNow on deploys; token at `public/e0e445eaf75d61f3faee17b699eca3b9.txt`.

### Analytics

- **GA4:** `G-0T71PWYQSQ` (under carolina@hplacer.com).
- **Tracking:** `src/components/analytics.tsx` injects the GA script; `src/lib/analytics.ts` provides `track(event, params)` helper.
- **Events tracked:** `generate_lead` (form type + method: api or mailto).

---

## Scripts & Automation

| Script | Purpose | When to run |
|--------|---------|------------|
| `npm run manifests` | Bundle image file lists (no fs at runtime) | Auto-runs via `predev` + `prebuild` |
| `npm run build` | Next build (static import validation) | Before `npm run deploy` |
| `npm run deploy` | Build + OpenNext → Cloudflare deploy | When ready to go live |
| `npm run preview` | Local preview of Cloudflare build | Test before deploy |
| `scripts/build-models.mjs` | ❌ DO NOT RUN — extracts + overwrites models.json | (Deprecated; edit data/models.json by hand) |
| `scripts/indexnow.mjs` | Ping IndexNow on deploy | Called by scheduled task (Mon/Thu) |

---

## Quick Checklists

### Adding a New Home Model

1. **Find or create** model data (extraction workflow output or manual entry).
2. **Add to `data/models.json`:** slug, brand, series, name, beds/baths, images, description, etc.
3. **Set floorPlans + tourUrl** manually (extraction misses these).
4. **Tag drywall status** in `wallFinish` field ("drywall" / "drywall-optional" / "strips").
5. **Price** (optional): add to `home-pricing.json` and/or `setup-pricing.json` by slug.
6. **Deploy:** `npm run deploy` (site regenerates, model appears on `/homes` + detail page).

### Adding a Blog Post

1. **Write markdown** (no H1; use `##` for subheadings).
2. **Add to `data/blog-posts.json`:** slug, title, description, date (ISO), readMinutes, tags, bodyMarkdown.
3. **Set date to today or future:** future dates hide until that date's deploy.
4. **Deploy:** `npm run deploy` (post appears on `/blog` if date ≤ today).

### Updating Pricing

1. **Edit `data/setup-pricing.json`:** add/update entries by model slug.
2. **Edit `data/home-pricing.json`:** add/update home-only prices by slug.
3. **Deploy:** Rebuilds site; price sort + filters now functional.
4. **Note:** Cards show "Call for pricing" until a price is set.

### SEO Pass (Gemini)

Before deploying a new page:
1. **Log into Gemini** (joe@forturro.com).
2. **Prompt as a top Google engineer:** review for on-page SEO + local geo keywords.
3. **Apply feedback:** title, meta description, H2 structure, local city mentions.
4. **Commit + deploy.**

See memory file `feedback_seo_geo_gemini.md` for the full Gemini prompt + results.

---

## Resource Links

- **HANDOFF.md:** Migration checklist, live state, account rules, gotchas.
- **DEPLOY.md:** Cloudflare Workers setup, custom domains, wrangler auth.
- **AGENTS.md:** ⚠️ Next 16 breaking changes warning.
- **Memory (old Mac):** `~/.claude/projects/-Users-spencer/memory/project_hplacer_rebuild.md` — exhaustive build log.
- **GitHub:** `github.com/homeplacer/hplacer-website` (branch: `first-touch-attribution`).

---

## Building for the Next Engineer

On a fresh machine:
1. `git clone https://github.com/homeplacer/hplacer-website.git && cd hplacer-website`
2. `npm install`
3. Read **HANDOFF.md** + this file (03-DEVELOPMENT-STANDARDS.md).
4. `npm run dev` to start the dev server on `:3000`.
5. For deployment: `wrangler login` (re-auth to Home Placer Cloudflare account), then `npm run deploy`.

All 72 TypeScript files (components, lib, pages, routes) follow the patterns above. Data is 100% JSON-based, no database. The site runs on Cloudflare Workers via OpenNext. No external CDN or reverse proxy — Workers + Cloudflare DNS is the stack.
