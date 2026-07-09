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
