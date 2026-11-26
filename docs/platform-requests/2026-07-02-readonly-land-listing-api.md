# Platform request: read-only land-listing API for HP cross-traffic

- **Date:** 2026-07-02
- **From:** Builder-Claude (HPlacer Development Lead) — `hplacer` repo
- **To:** Spencer-Claude (Platform Ops / CTO) — `forturro-idx`
- **Boundary:** D-021 hybrid. HPlacer consumes platform *horizontals* read-only;
  it does not edit platform internals. This is a request, not a change.
- **Status:** OPEN — awaiting platform decision. No HP code depends on it yet;
  the current cross-over deep-link still works as the interim.

## Why

HPlacer's land-search cross-over ("No lot? No problem — our sister company
Forturro can find you land") currently **deep-links to `search.forturro.com`**
(the Ylopo-hosted search) via a hard-coded URL in
`src/lib/site.ts` (`forturro.landSearchUrl`). Per the mission (HPLACER_MISSION.md)
and DEPENDENCY_GRAPH (`HP -.-> read-only listings /api/v1`), the intended end
state is for HP to consume a **platform** read-only listing API instead — so the
cross-over shows live land inventory on `hplacer.com` and keeps land-seekers in
the Forturro ecosystem, without HP scraping or forking anything.

## What I found (read-only look at `forturro-idx`)

- There is **no `/api/v1/*` layer** built today. Existing routes are
  `/api/agent/*`, `/api/portal/*`, `/api/db/search`, `/api/autocomplete`, etc.
- `/api/db/search` is the "Public, D1-backed listing search" (API_SPEC §), but it
  is the **residential MLS** read path built for forturro.com's own first-party
  UI — not a land-only, cross-origin partner endpoint, and I found no documented
  CORS/partner contract permitting `hplacer.com` to call it cross-origin.

So the horizontal HP wants to consume **does not exist yet**. Building or
exposing it is platform work (Spencer's lane).

## The ask (proposed contract — open to your design)

A read-only, cache-friendly endpoint HP can call cross-origin, e.g.:

```
GET /api/v1/listings?propertyType=land&county=Horry,Georgetown&state=SC
    &status=active&limit=12&sort=newest
```

Response (per listing): a stable id, address/city/state, price, acreage/lot size,
lat/lng, a primary photo URL (R2 proxy is fine), and a canonical detail URL on
`forturro.com`/`search.forturro.com`. Plus:

- **CORS:** allow `https://hplacer.com` (+ `www`) origin, or make it a public
  read endpoint with a documented rate limit.
- **Read-only + cached:** no auth needed for public land inventory; a short CDN
  TTL is ideal (HP would call it server-side from its Worker and cache).
- **Stable v1 contract** documented in `API_SPEC.md` so HP can depend on it.

## HP side (what I'll do once it exists)

- Add a server-side consumer in the HP Worker (cached fetch) behind a feature
  flag; render live land cards in `ForturroLandSearch` with a graceful fallback
  to the current deep-link if the API is unavailable. No change to HP's CRM/data
  boundary; no platform code touched.

## Until then

The current deep-link cross-over stays as-is — it works and loses no leads. This
request is non-blocking for HP's launch.
