# Home Placer MLS photo contract

This Home Placer-only service adds responsive delivery; it does not own or alter
MLS status, pricing, the feed producer, or approved permanent closing galleries.

## Request and source boundary

- `GET /api/mls-photo/{listingKey}/{width}` accepts only canonical numeric keys
  and widths **320, 480, 640, 768, 1200**. No query, arbitrary source, format,
  quality, crop, photo ordinal, or extra transform options are accepted. HEAD is
  explicitly blocked; other mutation methods have no handler.
- Every request checks the existing builder-scoped active snapshot before looking
  in `caches.default`. Only that item's exact current
  `https://forturro.com/api/img/{same listingKey}/1` is eligible. An authoritative
  empty snapshot/removal is not resurrected by a cached photo. Feed failures do
  not become empty availability; existing 300-second active and 900-second closed
  cache/last-good behavior and the permanent archive remain unchanged.
- Unsafe/malformed **optional photo** values are omitted without rejecting valid
  inventory. A private loader retains the original callback source and literal
  v1 key; the public loader revalidates optional media after **every** cache read,
  including an older snapshot with an unsafe optional photo URL. No listing IDs
  or live photos are hard-coded into source/assets. This is not a guarantee of
  cross-deployment warmth: Next includes callback.toString() in its cache key and
  OpenNext's R2 namespace includes a build ID. A reviewed release must successfully
  build/seed its own validated feed cache and pass the existing cache integrity
  gate; an outage must never be replaced with an invented empty snapshot.
- Source redirects are rejected. Raster MIME, decoded format, 6 MiB source cap,
  40 MP/10,000-pixel dimension caps, 3 MiB output cap, and bounded fetch/stream/
  binding operations prevent an unrestricted image proxy. No credentials or
  request cookies/headers are forwarded upstream.

## Encoding, cache and fallback

The dedicated **MLS_IMAGES** binding is intentionally not OpenNext's global
`IMAGES`: it cannot enable the generic `/_next/image` optimizer. Output is fixed
WebP quality 75 with `fit: scale-down`, no crop, watermark edit or enlargement.
The binding's free `.info()` validates both source and final output. A candidate
wider than its source returns no-store 422 rather than advertising a false width
descriptor; other failures return no-store 4xx/5xx, never a full JPEG labeled as
an optimized derivative.

Successful derivatives use a fixed, versioned Cache API namespace separate from
the JSON R2 incremental cache and its DO revalidation queue. Their own cache and
browser TTL is at most 300 seconds (with Age on cache hits), not immutable. No
outer Worker cache is enabled, because it would bypass membership checks. Cache
failures are nonblocking. The upstream currently advertises a one-hour cache;
this service does **not** guarantee end-to-end photo freshness in 300 seconds or
claim a photo revision/version contract exists.

Cards and details keep their original URL, alt text, box ratio and loading
behavior. A candidate error removes the entire srcset and uses the authentic
original; a prehydration error is checked on mount. A no-JavaScript fallback uses
the original directly. JSON-LD and sitemap continue referencing the original.
Failure of both the derivative and original remains an upstream media outage,
not a reason to invent a replacement photo or change listing availability.

## Deployment gate and costs

Declaring the binding is code configuration, not an account plan purchase. Before
deploying this PR, confirm Home Placer's Images entitlement and whether this
account can use the free allowance, plus the right to resize/cache/display these
MLS photos while preserving their required attribution/watermarks. Public
access alone does not establish those rights. No paid upgrade, account setting,
secrets, source-site change or deployment is authorized by this PR.

Cloudflare documents 5,000 unique transformations/month on Free; after the cap,
new transformations fail rather than incur Free overage. Paid transformations
above the included allowance cost $0.50/1,000. Fixed width/quality/format and
current-feed eligibility bound caller-controlled variation, but changed source
bytes, inventory growth, account-wide usage and ordinary Worker costs mean zero
future cost cannot be assumed. Images binding responses require explicit caching;
local offline Images tests do not incur provider usage and do not prove production
entitlement, final compression fidelity, global cache hit rates or LCP gains.

Primary references: [Images binding](https://developers.cloudflare.com/images/optimization/binding/),
[Images pricing](https://developers.cloudflare.com/images/pricing/),
[Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/),
[OpenNext image differences](https://opennext.js.org/cloudflare/howtos/image).

Tests use synthetic/intercepted media only. The loopback component fixture runs
with `node tests/fixtures/mls-photo-preview.mjs` on port 18063 and never calls the
feed or provider. Its `scripts-blocked` mode blocks scripts by CSP; it is **not**
real browser scripting-disabled proof and does not exercise native `noscript`.
The real SSR test verifies the semantic original-photo noscript markup.
Existing MLS refresh workerd tests remain the authoritative
regression check for real cache/queue refresh behavior; no production lead is
submitted by this work.
