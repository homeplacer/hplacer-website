# Home Placer / hplacer.com — OpenNext Cache Audit

**Session:** Home Placer Website Stabilization / OpenNext Cache Audit
**Date:** 2026-07-09
**Mode:** Read-only findings report — no production changes, no deploy.
**Status:** Site is UP for real users. No code changed. Nothing deployed.

---

## TL;DR

`open-next.config.ts` calls `defineCloudflareConfig()` with **no incremental cache**, so
the adapter falls back to the **`"dummy"` (no-op) cache**. Every request to a prerendered
page therefore **re-runs the full React server render inside the Worker**, which causes
`x-nextjs-cache: MISS` on every hit, ~23% cache rate, ~366 ms CPU P90, and the `1102`
"Worker exceeded CPU" errors under load.

**Fix:** switch the incremental cache to the adapter's **`static-assets-incremental-cache`**,
which serves the build-time prerendered pages from the **existing `ASSETS` binding**.
One-file change. No new Cloudflare resources, no new bindings. Fully reversible.

---

## 1. Current architecture summary

| Layer | Detail | Source |
|---|---|---|
| Framework | Next.js **16.2.9**, React 19, App Router | `package.json` |
| Host | Cloudflare **Workers** via **@opennextjs/cloudflare 1.19.11** (OpenNext adapter) | `package.json`, `wrangler.jsonc` |
| Routing | Worker bound to **custom domains** `hplacer.com` + `www.hplacer.com` | `wrangler.jsonc` `routes[].custom_domain` |
| Bindings | **Only `ASSETS`** (static assets). No KV / R2 / D1. | `wrangler.jsonc` |
| Rendering | **100% static (SSG/prerendered)** — 25 `page.tsx`, 2 `route.ts` | repo scan |
| Dynamic APIs | **None** — no `headers()`, `cookies()`, `searchParams`, `draftMode()` in any page | grep |
| Segment config | Only `force-static` on `robots`/`sitemap`/`opengraph-image`/`llms.txt`; `generateStaticParams()` on `/homes/[slug]`, `/blog/[slug]`, `/recently-placed/[slug]`, `/locations/[slug]` | grep |
| ISR / revalidate | **None anywhere** (`revalidate`, `unstable_cache`, `revalidateTag` all absent) | grep |
| Sensitive endpoint | `/api/lead` = **POST-only** route handler → Follow Up Boss / Resend via `fetch` | `src/app/api/lead/route.ts:454` |
| Middleware | Static security headers (CSP/HSTS/X-Frame) + HTTP→HTTPS redirect only; no `Set-Cookie` | `src/middleware.ts` |

**Bottom line:** a fully static marketing site, server-rendered by a Worker. Heaviest pages
are the homepage and `/homes` (renders all ~93 model cards via `HomesBrowser`).

---

## 2. Caching failure diagnosis (root cause)

`open-next.config.ts` today:

```ts
export default defineCloudflareConfig();   // no incrementalCache passed
```

The adapter's resolver defaults to a **no-op cache**:

```js
// node_modules/@opennextjs/cloudflare/dist/api/config.js
function resolveIncrementalCache(value = "dummy") { ... }   // ← default "dummy"
```

The `"dummy"` incremental cache stores nothing and returns nothing. So on every request to a
prerendered page, the Next server looks up the cache → **MISS** → **re-executes the full
React server render in the Worker.** This explains every observation:

- `x-nextjs-cache: MISS` on every hit (dummy cache never returns an entry)
- Cache rate ~23% (only static JS/CSS/images cache; **HTML never does**)
- CPU P90 ~366 ms (full SSR of heavy pages, every request)
- `1102` "Worker exceeded CPU" under load, intermittent `500`

### Why the Cloudflare zone Cache Rule didn't help

A **Workers custom-domain request is handled by the Worker itself** — it never reaches the
zone cache layer (hence no `cf-cache-status` header). Caching for this app must happen
**inside** the Worker, via OpenNext's incremental cache. Right now that cache is the dummy
no-op.

---

## 3. Recommended fix

Switch the incremental cache from `"dummy"` to the adapter's **`static-assets-incremental-cache`**.
Its own doc comment:

> *"This cache uses Workers static assets. It should only be used for applications that do NOT
> want revalidation and ONLY want to serve prerendered data."*

Why it's right here:

- Site is **100% static, no ISR/revalidation** → a read-only, build-populated cache fits perfectly.
- Reads prerendered entries from the **existing `ASSETS` binding** (`env.ASSETS`, path
  `cdn-cgi/_next_cache/…`) → **no new Cloudflare resource, no new binding, no wrangler change.**
- On deploy, `opennextjs-cloudflare deploy` runs `populateStaticAssetsIncrementalCache()`
  automatically, emitting the prerendered cache into the asset bundle.

Result: prerendered pages are served from cache without re-rendering → `x-nextjs-cache: HIT`,
per-request CPU collapses, `1102` errors stop.

*Optional phase 2 (not in the minimal patch): `enableCacheInterception: true` short-circuits
cacheable routes before the Next server runs, cutting CPU further. More edge-cases — land the
base fix and measure first.*

---

## 4. Exact patch plan

**One file changes. Nothing else.**

`open-next.config.ts` — full new contents:

```ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Site is 100% static (SSG, no ISR/on-demand revalidation), so we serve the
// build-time prerendered pages from Workers static assets (the existing ASSETS
// binding) instead of re-rendering on every request. Fixes x-nextjs-cache MISS
// loop and the Worker CPU (1102) pressure. Read-only cache — if we ever add ISR,
// switch to r2-incremental-cache + an R2 binding.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
```

- Import path **verified to resolve**:
  `@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache`
  → `dist/api/overrides/incremental-cache/static-assets-incremental-cache.js`
- **No change** to `wrangler.jsonc`, `next.config.ts`, `package.json`, middleware, or any route.
- Takes effect only after a **rebuild + redeploy** (`npm run deploy`) — the build populates the asset cache.

---

## 5. Cloudflare resource / binding requirements

- **New resources required: NONE.** No R2 bucket, no KV namespace, no D1.
- **New bindings required: NONE.** Uses the already-present `ASSETS` binding.
- **Wrangler config changes: NONE.**
- *Fallback (only if ISR is ever added later):* switch to `r2-incremental-cache` and add an R2
  binding named **`NEXT_INC_CACHE_R2_BUCKET`** (plus a bucket). Not needed today.

---

## 6. Safe verification plan (no load testing)

After deploy, single requests only — **no hammering** (high curl volume trips Cloudflare's
per-IP protection):

1. **Homepage loads** — browser, expect 200 + full content.
2. **`/homes` loads** — expect the ~93 cards render.
3. **A detail page loads** — e.g. `/homes/caddie`.
4. **Cache flips to HIT** — request a page twice; the 2nd response should show
   **`x-nextjs-cache: HIT`** (the pass/fail signal for this fix).
5. **Lead form submits** — fill the contact form once; confirm 200 from `/api/lead` and the
   lead lands in Follow Up Boss.
6. **`/api/lead` not cached** — it's POST-only (`route.ts:454`); the incremental cache only
   covers GET page/route renders, so it stays dynamic.
7. **Trends** — watch **Cloudflare → Workers analytics** (server-side truth): CPU P90 should
   drop sharply, cache rate rise, `1102`/`5xx` fall. Needs *no* traffic generation — just read
   the dashboard over a few hours.

---

## 7. Rollback plan

- **Instant, single-file revert:** restore `open-next.config.ts` to
  `export default defineCloudflareConfig();` and redeploy (or `git revert` the commit).
- No data migration, no resource teardown, no binding removal — nothing else was touched.
- Rollback risk: none; returns to exactly today's behavior.

---

## 8. Risk, tradeoffs, blockers

- **Risk level: LOW.** One config line, uses an existing binding, additive caching for content
  that is *already* static, fully reversible.
- **Content-freshness tradeoff: NONE beyond today.** Pages are already static and only change on
  deploy; the asset cache is rebuilt every deploy (new build ID). Freshness is identical to
  current behavior. The blog "drip" already relies on scheduled redeploys — unchanged.
  (Checked for `new Date()` / `Math.random()` in render: the only hits are client-side gtag,
  the POST `/api/lead` handler, and build-time `blog.ts` `TODAY` — none are per-request server
  renders that caching would wrongly freeze.)
- **`/api/lead` confirmed unaffected** — POST route handler, never entered into the incremental
  cache; stays fully dynamic/uncached.

### Blockers / open questions

1. **Deploy auth:** applying this needs a rebuild + `opennextjs-cloudflare deploy`, which
   requires **`wrangler login`** to the Home Placer account — not set up in this environment.
   Code can be prepared now; deploying needs an authenticated machine.
2. **Approve the approach?** Confirm the **static-assets** cache (best for a pure-static site)
   vs. R2 (only worth it if ISR / live-updating data is added later).
3. **Cache interception (phase 2)?** Include `enableCacheInterception: true` now for extra CPU
   headroom, or land the base fix and measure first? **Recommendation: measure first.**

---

## Appendix — evidence commands

```
# rendering mode / dynamic directives
grep -rnE "export const (dynamic|revalidate|fetchCache|runtime)|generateStaticParams|headers\(\)|cookies\(\)|searchParams" src/

# adapter default incremental cache
grep -n "resolveIncrementalCache" node_modules/@opennextjs/cloudflare/dist/api/config.js
# -> function resolveIncrementalCache(value = "dummy") { ... }

# available incremental-cache overrides
ls node_modules/@opennextjs/cloudflare/dist/api/overrides/incremental-cache/
# -> kv / r2 / regional / static-assets

# import path resolves
node -e "console.log(require.resolve('@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'))"
```
