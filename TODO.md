# Home Placer — TODO (Phase 0: Launch Readiness)

*Actionable punch list. Source: production build + 3-way launch-readiness audit
(SEO/routing · leads/CRM · mobile/perf/security), 2026-07-02. Strategy: `ROADMAP.md`.
Legend: ☐ open · ✅ done · 🔧 code (Builder) · 🛠️ ops/deploy (Joe/DevOps).*

## Build baseline ✅
Production build green — 211 routes prerender (93 homes, 73 placed, 27 locations,
16 blog + static), sitemap/robots complete, HTTPS middleware correct, **no broken
internal links**, **no secrets committed**.

## P0 — launch-blockers
- ☐ 🔧 **Security response headers** — none exist (no CSP, X-Frame-Options, HSTS,
  X-Content-Type-Options, Referrer-Policy). Add `public/_headers` (OpenNext serves
  it via ASSETS) with a CSP that allowlists GA + Leaflet(unpkg) + manufacturer image
  CDNs, plus frame/nosniff/referrer/HSTS. Test it doesn't break the map/GA/images.
- ☐ 🔧 **Blog markdown XSS** — `src/lib/blog.ts` runs `marked.parse` unsanitized →
  `blog/[slug]/page.tsx` `dangerouslySetInnerHTML`. Content is first-party today, but
  strip raw HTML / `javascript:` / `on*=` (no heavy dep; workerd-safe) + rely on CSP.
- ☐ 🔧 **`/api/lead` unbounded payload** — no `Content-Length` check or field-length
  caps (only `attribution` is capped). Reject bodies > ~32KB; `.slice()` each field.
- ☐ 🔧 **`submitLead` downgrades 4xx → silent mailto** (`src/lib/lead.ts`) — a
  server validation reject becomes a mailto that no-ops on mobile w/o a mail client →
  lead lost. Distinguish 4xx (inline error) from network/5xx (mailto fallback).
- ☐ 🛠️ **Confirm prod Worker secrets set** (`FUB_API_KEY`, `RESEND_API_KEY`) before
  traffic — code self-arms, but blank secrets trip `LEAD_NOT_DELIVERED` on every lead.
- ☐ 🛠️ **Wire an alert to `CRITICAL LEAD_NOT_DELIVERED`** (Logpush/Tail or a durable
  KV/Queue outbox) — today the safety-net is an unwatched log line.

## P1 — before marketing spend
- ☐ 🔧 **Canonicals** on ~15 pages (incl. `/homes`, `/homes/[slug]`) — parameterized
  ad traffic (`?brand=`, `?wall=`, `?home=`) risks duplicate-URL indexing.
- ☐ 🔧 **Lead email HTML-escapes user input** — Resend `html` interpolates raw
  name/email/message (email HTML injection). Escape each value.
- ☐ 🔧 **Comparison tables overflow on mobile** — wrap the 4 `<table>`s
  (manufactured-vs-site-built, mobile-vs-manufactured, modular-vs-manufactured,
  drywall-vs-wall-strips) in `overflow-x-auto`.
- ☐ 🔧 **Error/404 boundaries** — add `src/app/not-found.tsx` + `global-error.tsx`
  (dynamic routes call `notFound()` but render Next's bare default).
- ☐ 🔧 **Warranty `!personId` branch logs nothing** (`api/lead/route.ts`) — a FUB
  response-shape change silently skips assign+task. Add an error log.
- ☐ 🔧 **Parallelize collaborator validation** (`Promise.all`) — currently up to 4
  serial FUB GETs on a cold isolate before warranty routing fires.
- ☐ 🔧 **Blog schema** — add `BreadcrumbList` + OG image + richer `BlogPosting`
  (image, `mainEntityOfPage`, date pairing).
- ☐ 🔧 **Remove `scripts/deploy-pages.sh` + the `PAGES_BUILD` export branch** — a
  stale static-export path that silently drops the HTTPS middleware (footgun).
- ☐ 🔧 **Fix schema `logo`** — `jsonld.tsx` sets `${site.url}/icon` (no ext); real
  route is `/icon.png`. Point to the actual logo.
- ☐ 🔧 **Escape Leaflet popup values + `rel="noreferrer"`** (`placements-map.tsx`).

## P2 — polish / defense-in-depth
- ☐ 🔧 Double-submit guard (`if (status!=="idle") return`) on all 5 forms.
- ☐ 🔧 `jsonld.tsx` — escape `</script>` (`<`) in stringified JSON-LD.
- ☐ 🔧 Mobile nav tap target → true 44px (`size-11`).
- ☐ 🔧 Sitemap `lastModified` derive from content (currently hardcoded).
- ☐ 🔧 Index-page schema (`ItemList`/`CollectionPage` on `/homes`).

## Bigger items (log now, schedule)
- ☐ 🔧 **Mirror manufacturer photos to R2/`public`** at build time — 611+ hotlinked
  CDN URLs (Clayton/Cavco/Champion) are a site-wide reliability + CSP-allowlist risk.
- ☐ 🔧 **Self-host Leaflet** (npm-bundle) instead of the unpkg runtime script.
- ☐ 🛠️ Verify a FUB Lead Flow automation exists for the `subscribe` tag (email-only
  leads are otherwise near-invisible to the team).
- ☐ Watch the 10MB gzip Worker cap as blog/models JSON grows.

## Blocked on Joe (external, unchanged)
- ☐ Pricing numbers (`setup-pricing.json`/`home-pricing.json`) · domain transfer +
  HSTS · Bing PIN · Apple Business Connect · replace hotlinked photos with owned.
