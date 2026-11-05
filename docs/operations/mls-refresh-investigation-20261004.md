# MLS automatic refresh fix — October 4, 2026

## Result

The implementation is complete locally and the real-time acceptance test passed. Production resources, secrets, and live data have not changed. This
branch is not committed or deployed; the live site still uses the old cache.

GitHub main is `8b2322f4978ff77ec3a06f8b54632ef6fc5d9413`. Wrangler's read-only
deployment listing confirms `hplacer-app` serves version
`dffb9b58-7774-4466-ad32-35960efb2e7a` at 100%, matching the supplied handoff.
The isolated investigation checkout is based on that exact main commit.

## Original causes and additional failure cases

1. The original `open-next.config.ts` selected the static-assets incremental cache and did
   not configure a revalidation queue. The installed adapter reads every cache
   record with the fixed build timestamp and only logs an error on attempted
   writes. The default dummy queue throws rather than refreshing a stale route.
   This configuration cannot implement the requested time-based refresh.
2. The active feed requests 300-second revalidation. The closed feed requests
   900 seconds. The dynamic package detail and sitemap also consume the active
   getter; changing route caching alone is insufficient.
3. A controlled VM execution of the actual active-feed source, with every fetch
   mocked, confirmed that a successful `{items: []}` response invokes the legacy
   address-search fallback. A synthetic matching fallback record reappeared.
   An empty authoritative active feed must be accepted as empty; it is not an
   outage. The fallback record has no explicit status check in this getter.
4. Mocked total upstream failures return an empty active list and an empty list
   of new closings. These are successful return values, not thrown regeneration
   failures. A writable cache by itself does not guarantee last-good-data
   retention when the application swallows an outage. Integrated Next/Workerd
   tests must establish the final behavior rather than assuming it.
5. The permanent local sold archive remains separate. Dynamically discovered
   closings are deduplicated against it, but are not durably appended by this
   getter. Define and test persistence for new closings if additive retention
   must survive upstream disappearance and later builds.

All diagnostic requests were mocked. No live MLS changes, lead submissions,
production load tests, or production cache purges were used.

## Proposed implementation

Use the installed OpenNext adapter's supported R2 incremental cache and Durable
Object revalidation queue, with a service binding back to `hplacer-app`:

- `NEXT_INC_CACHE_R2_BUCKET`: dedicated Standard R2 bucket, proposed name
  `hplacer-web-incremental-cache` (not provisioned).
- `NEXT_CACHE_DO_QUEUE`: `DOQueueHandler` with a new SQLite-class migration.
- `WORKER_SELF_REFERENCE`: service `hplacer-app`.
- Keep existing 300/900-second intervals. These are request-triggered stale-
  while-revalidate intervals, not a promise of a wall-clock scheduled fetch.
- Start without a regional cache wrapper to avoid adding another freshness
  layer before correctness is demonstrated. Measure performance afterward.
- No application use of `revalidateTag` or `revalidatePath` was found under
  `src`; a tag-cache database is not currently required for this proposal.
- Make successful empty active results authoritative. Distinguish malformed
  data and upstream failures from a valid empty inventory. Establish last-good
  behavior for route and data caches together, including dynamic consumers.
- Preserve local archive galleries and deduplication. Any persistent store for
  newly discovered closed records needs a separate explicit schema/contract;
  an expiring incremental cache is not a permanent archive.

Wrangler can list deployments and R2 buckets from this Mac. Only
`hplacer-portal-photos` exists in the returned bucket inventory. Do not reuse
that bucket. Listing access does not prove bucket-creation or Durable Object
provisioning permissions; check those at the authorized infrastructure step.

## Local acceptance work before production

Build once using the locked OpenNext toolchain and synthetic upstream fixtures.
Use local Workerd/R2/DO bindings, never production storage. Change upstream
fixtures after cache age crosses the configured intervals without rebuilding:

| Scenario | Required evidence |
| --- | --- |
| Price changes | Homepage, package index/detail, and RSC eventually agree on new price. |
| Active removal, including removal of every listing | Removed homes disappear from cards and sitemap; details return the intended not-found behavior; legacy fallback does not restore them. |
| New closing | New closing appears once; existing permanent archive and galleries remain. |
| Upstream failure or malformed response | Last-good policy holds; failures do not become a cached empty success; recovery replaces stale data. |
| Concurrent requests after expiry | Queue deduplicates work, retries are bounded, and successful regeneration persists. |
| Restart/rebuild and upstream missing older closings | Permanent-history contract is preserved, including any newly persisted closings. |
| Cache integrity | Existing JSON gate still runs before upload; adapt ASSETS-mirror-specific checks explicitly for R2 population. |

The installed Next ISR guide confirms the first request after expiry can receive
stale content while background regeneration runs. Tests must wait for completed
regeneration and inspect later responses, not mistake that first stale response
for a failure or a fresh post-build HIT for proof of refreshing.

## Release, cost, and rollback gates

Prepare local implementation and fixture evidence before requesting production
approval. Review the PR, resource/binding migration, cache population, and cost
impact together. The user's standing boundary requires approval for new
infrastructure and deployment. Keep `npm run deploy` and its integrity gate as
the release entry point; verify R2 build-cache population before traffic moves.

R2 Standard pricing checked today: 10 GB-month, 1 million Class A operations,
and 10 million Class B operations are included monthly. Beyond allowances,
storage is $0.015/GB-month, Class A $4.50/million, and Class B $0.36/million.
Durable Objects also meter requests, duration, and storage according to the
account plan. No traffic-based estimate or promise of zero additional cost is
established. Confirm the account plan and usage budget before provisioning.

Before rollout, record the then-current Worker version and test rollback with
the new Durable Object migration. Do not assume a historical version can be
rolled back unchanged across that migration. Keep cache prefixes/build IDs
isolated, retain data required by the previous release, and never delete the
new resources as an automatic rollback step. After release use a few safe GETs
and passive error/queue monitoring; no synthetic lead POSTs.

## Dependency advisory follow-up

The exact lockfile installed under Node 24.21.0/npm 11.19.0. Installation reports
five high affected-package entries. Fresh production-only audit reports zero
findings. Registry `braces` latest remains 3.0.3, matching the handoff's unfixed
development-tool chain. No dependency changes or forced fixes were made.

## References

- [OpenNext cache and queue setup](https://opennext.js.org/cloudflare/caching)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- Installed Next guide: `node_modules/next/dist/docs/01-app/02-guides/incremental-static-regeneration.md`
- Existing diagnosis: `docs/operations/build-cache-integrity-gate-20261003.md`


## Implementation prepared after the investigation

Local changes now replace the read-only adapter with OpenNext R2 caching and
its Durable Object queue. Proposed bindings are declared in `wrangler.jsonc`;
no remote bucket, namespace, credential, DNS, or production change has been made.
The Worker remains `hplacer-app` in the Home Placer account.

Active and closed snapshots are validated inside Next `unstable_cache`, with
300/900-second revalidation respectively. The inner fetch is `no-store` so
invalid JSON or an HTTP error cannot enter a separate raw-response cache.
The validated snapshot remains cached; this does not disable page caching.
A successful empty active snapshot removes active listings, including details
and sitemap entries. The legacy address-search fallback is removed because it
cannot establish current active status. A refresh error retains the previous
validated snapshot; a cold-cache error fails instead of inventing inventory.

Permanent `data/placed-homes.json` and all galleries are unchanged. New live
closings are still deduplicated against that archive by MLS and address. This
change does not convert upstream live closings into permanent archive records;
that is a separate ingestion policy, not a property of an expiring cache.

### Reproducible local checks

```sh
node --test tests/*.test.mjs
npx tsc --noEmit
npm run portal:check
npx opennextjs-cloudflare build
npm run verify:build-cache
npx wrangler deploy --dry-run --outdir .open-next/refresh-test-worker
node scripts/tests/mls-refresh-runtime.mjs
npx opennextjs-cloudflare populateCache local
node scripts/tests/verify-local-r2-cache.mjs
```

The runtime test uses the actual bundled application in Workerd, local R2 and
SQLite Durable Objects, with every external fetch intercepted by synthetic
fixtures. It waits through real TTLs without rebuilding or editing cache
records. No live listing, lead, production Worker, or public traffic is used.
The R2 read-back test separately verifies every populated record equals its
validated source, without printing its contents. The ASSETS mirror check remains
available for older static-cache builds; it is not required for an R2 build.

### Release procedure (requires approval)

1. Commit and open the isolated branch as a PR; review the feed contract,
   cache bindings, regression tests, and acceptance evidence.
2. Verify current main and Home Placer account permissions again. Confirm the
   account's R2/DO billing plan, and obtain approval for resource provisioning
   and deployment. No new secret is required by this cache design.
3. Create `hplacer-web-incremental-cache` in account
   `6caa351d57b30bd04cec8a08e4330ffd` only after approval. Leave the portal photo
   bucket untouched. Record the current Worker version before release.
4. Merge reviewed code and use a clean isolated checkout of that merged tree.
   Run `npm run deploy`; this keeps validation before R2 population and upload.
   The checked-in migration creates the SQLite-backed queue namespace.
5. Confirm the new version is at 100%, all three bindings are present, and
   initial safe GETs read the populated cache. Verify catalog/archive routes and
   GET `/api/lead` (405); never submit a test lead.
6. Observe regeneration on a small set of real requests after expiry and check
   for cache write/queue errors. Do not fabricate upstream changes or load-test.

R2 uses build-specific cache keys; retain the prior build's objects during
rollout. Do not delete the bucket or Durable Object namespace during rollback.
A rollback across the initial DO migration may be blocked: prefer a reviewed
forward recovery retaining bindings/migration, and confirm compatibility before
using `wrangler rollback`. If new cache operation is unhealthy, stop rollout
and retain the recorded last-good version; do not silently disable the JSON gate.


### Runtime findings during implementation

R2 plus the queue alone did not pass the timed homepage test in this installed
Next/OpenNext combination: the validated data refreshed but the stored HTML
remained unchanged. Enabling the supported `enableCacheInterception` option
made the adapter dispatch the regeneration through the Durable Object queue
and persist updated HTML and RSC. This setting is therefore part of the fix,
not merely an optional performance suggestion for this release.

The sitemap no longer uses `force-dynamic`, which bypassed its snapshot cache.
It now revalidates every 300 seconds so its cached XML and validated listing
data can survive temporary upstream failures as well. Route timing in the build
manifest is 300 seconds for `/`, `/land-packages`, and `/sitemap.xml`, and 900
seconds for `/recently-placed`.

The optional `MLS_TEST_AGE=1` harness mode simulates aged R2 reads in a test-only
Worker wrapper without modifying stored records. It disables the DO SQLite
success deduplication only in that simulated mode because artificial object
age conflicts with real queue timestamps. It is useful for fast failure cases,
but does not substitute for the default real-time test, which uses unmodified
bindings, real R2 timestamps, and the production SQLite queue settings.


### Local verification record

- Public tests: 149 passing. Portal regression tests: 365 passing.
- Type checking passes; lint has no errors and only the inherited portal
  `nowIso` unused-import warning (generated `.wrangler` files excluded).
- Production build and Wrangler dry run pass.
- JSON integrity gate: 275 source records, approximately 80.8 MiB total.
- Local R2 population: all 275 objects read back equal to their validated sources.
- Simulated expiry checks pass for changed prices, HTML/RSC, all-active removal,
  detail 404, sitemap removal, new closings, archive preservation, upstream 503,
  malformed successful response, recovery, and GET `/api/lead` returning 405.
- Default real-time run: passed through the real 300/900-second TTLs without
  rebuilding. Five-minute price updates appeared in HTML and RSC. Five concurrent
  requests produced one failed upstream refresh and retained the last good page.
  Recovery removed the active fixture from the homepage, index, sitemap and
  detail route (404), and added the new closing while preserving all 73 archived
  home destinations. Final intercepted request counts: 7 active, 2 closed.
  The run completed October 4 at 10:53:48 UTC with exit code 0.

No production change or remote resource provisioning has been performed.
Storage accrues per retained build (about 81 MiB for this one); do not infer
zero cost from storage size alone. Request charges and DO usage depend on
traffic and the account plan. No cleanup policy is introduced by this patch.
