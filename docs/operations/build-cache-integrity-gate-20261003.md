# Build cache integrity release gate

## Purpose and scope

An integrated local OpenNext build produced one malformed serialized FETCH-cache
record. OpenNext warned about it but retained the file, which its static-assets
cache population step can copy into uploaded ASSETS. This check blocks that
known bad artifact before upload. It does not fix the underlying writer race,
prove that a particular framework update caused it, or change runtime caching.

No Worker configuration, account, binding, environment variable, secret, route,
cache policy, dependency, or customer data is changed by this task.

## Normal release command

`npm run deploy` retains the existing public-data validation, manifest creation,
OpenNext build, and OpenNext deployment steps. It now runs
`npm run verify:build-cache` after the build and before the deployment command.
A nonzero check result stops the `&&` chain before OpenNext can upload artifacts.
The existing manual and scheduled deployment paths using this command receive
the same guard. Direct adapter or Wrangler commands bypass it and must not be
used as substitutes for the documented release command.

The check is read-only and requires a nonempty `.open-next/cache` directory. It
recursively parses every regular file, including extensionless `__fetch` records
and route `.cache` records, as one complete JSON value. Malformed JSON,
concatenated JSON/duplicate tails, unreadable files or directories, and symlinked
or other unsupported entries fail closed. It validates the outer serialization,
not response bodies or a version-specific cache schema.

## ASSETS population timing

OpenNext's static-assets cache population happens inside its `preview` or
`deploy` command, after a normal build. A fresh build therefore may not yet have
`.open-next/assets/cdn-cgi/_next_cache`. Its absence is expected at the default
pre-upload check; if that mirror already exists, every record in it is also
checked, and it must be nonempty. The adapter then copies the validated source
cache into the static-assets mirror before upload, following the unchanged
deployment lifecycle.

After an authorized local preview/population step, enforce the presence of both
directories with:

```sh
npm run verify:build-cache -- --require-assets
```

That stricter QA mode fails if the ASSETS mirror has not been populated. Neither
check populates, repairs, removes, or otherwise modifies generated files; neither
uses credentials or makes network requests. Output contains only record counts,
relative artifact paths, and fixed error reasons. Raw JSON, response bodies, and
parser exception messages are never printed.

## If a release is stopped

Do not truncate a file, select only a valid JSON prefix, edit a cached response,
or suppress the failure. Preserve the failed artifacts privately for diagnosis.
Make a fresh normal OpenNext build in an exclusive checkout with no concurrent
build or preview writing its output, and rerun the gate. If it remains invalid,
stop deployment and have the backend owner investigate the cache writer or
adapter. A passing rebuild is evidence of valid artifacts for that build, not
evidence that the underlying race has been permanently fixed.

Run the local regression fixtures without a build or network access:

```sh
node --test tests/build-cache-integrity.test.mjs
```

Backend-owned follow-up: retain this gate in any future CI/scheduled deployment
workflow, and investigate non-atomic cache writes separately without weakening
the release check or changing the existing ASSETS cache policy.

## Verification for this change

- All 12 local fixture tests pass, including malformed source/mirror records,
  concatenated JSON, missing/empty paths, unsupported entries and CLI flags,
  safe diagnostics, read-only behavior, and deployment command ordering.
- Both files pass Node syntax checks and the repository's ESLint configuration;
  the diff passes the whitespace check.
- Read-only checks of the release owner's freshly rebuilt and locally populated
  integrated artifacts pass in default and `--require-assets` modes: 271 source
  records and 271 ASSETS mirror records.
- This safeguard lane did not install dependencies, run a production build,
  populate caches, start a Worker, merge, or deploy. The release owner separately
  owns integrated build and deployment verification.

## Separate inherited freshness follow-up

The release owner's aged local integrated artifact returned HTTP 200 for the
homepage with `x-nextjs-cache: STALE`, alongside dummy-queue and read-only-cache
errors. This is a separate freshness issue, not a malformed-JSON failure and not
a refresh fix delivered by this batch.

Read-only comparison of the installed baseline (Next 16.3.3, OpenNext Cloudflare
1.19.11, AWS adapter 4.0.2) and updated versions (16.3.8, 1.20.8, 4.1.7) found
byte-identical static-assets cache, queue-default resolver, build-timestamp
compiler, and dummy-queue implementations. The unchanged cache handler returns
the fixed build timestamp as `lastModified` and cannot persist refreshed records;
the unchanged default queue throws when a stale response requests background
revalidation. Both Next versions compare record age against its revalidation
interval. Configuration, bindings, and the feed's declared refresh intervals
were not changed in this release.

The existing active-listings fetch interval is 300 seconds and closed-listings
interval is 900 seconds. The integrated prerender manifest records 300 seconds
for `/` and `/land-packages`, 900 seconds for `/recently-placed`, and no interval
for the static `/homes/eclipse` model page. Fresh `HIT` responses after a rebuild
do not demonstrate that listings refresh after those intervals expire. These
findings establish an inherited configuration mismatch; they do not establish a
new dependency regression or verify production refresh behavior.

The backend owner needs a separate writable incremental-cache and functioning
revalidation-queue design, including any required resources, bindings,
permissions, and release safeguards. Verify artifacts after their TTL has elapsed
and confirm that a controlled upstream listing change is reflected without a new
site build; preserve active-only filtering and the additive, deduplicated sold
archive. Do not disable refresh intervals or all caching, or downgrade the
security updates, merely to hide the errors. No cache-policy or runtime change
is included in this PR, and automatic MLS refresh must not be described as fixed
by this release.
