# Security dependency update — October 3, 2026

This separate dependency-only task follows the owner's explicit authorization
to address the backend security findings. It starts from main
`b46917ad039093267fbd4602885aba9666c3299e`; it does not change application source,
routes, lead contracts, Worker configuration, bindings, compatibility flags,
cache settings, secrets, credentials, data, or the separate portal deployment.
Review and production deployment remain separate operator steps.

## Deliberate version changes

| Package | Previous lock | Updated lock |
| --- | --- | --- |
| Next.js and matching eslint-config-next | 16.3.3 | 16.3.8 |
| @opennextjs/cloudflare | 1.19.11 | 1.20.8 |
| @opennextjs/aws, through Cloudflare adapter | 4.0.2 | 4.1.7 |
| Wrangler | 4.127.1 | 4.147.0 |
| Miniflare, through Wrangler | 5.20260828.0-alpha | 5.20261001.0-alpha |
| Undici, through Miniflare | 7.29.0 | 7.29.1 |
| Miniflare's Sharp | 0.35.2 | 0.35.4 |
| qs | 6.15.2 | 6.16.0 |
| brace-expansion branches | 1.1.18 / 2.1.4 / 5.0.9 | 1.1.21 / 2.1.7 / 5.0.12 |
| browserslist | 4.28.2 | 4.29.3 |
| baseline-browser-mapping | 2.10.38 | 2.11.27 |

The new adapter's peer range explicitly supports Next.js 16.3.8. Updating the
adapter also includes upstream fixes for Next.js 16.3 cache-handler binding
regressions. The generated lockfile includes the updated adapter/toolchain's
transitive and platform-specific dependencies; no forced overrides or
`npm audit fix --force` were used. React, React DOM, Leaflet, Marked, application
scripts and the configured static-assets cache remain unchanged.

Wrangler 4.147.0 itself requires Node.js 22 or newer, but the full resolved
build/lint toolchain has stricter requirements: use **Node.js 22.x at 22.13.0 or
newer, or Node.js 24 or newer**. `yargs`/`yargs-parser` require at least 22.12 on
the 22.x line; `eslint-visitor-keys` requires at least 22.13. Validation used
Node.js 26.0.0 and npm 11.12.1. Backend operators must check their runtime before
using this lockfile; do not silently use an older Node.js deployment machine.

## Audit result and remaining upstream risk

The baseline full audit reported 14 affected-package entries: one critical,
11 high and two moderate. The updated full audit reports **five high entries,
zero critical and zero moderate**. The production-only audit
(`npm audit --omit=dev --json`) now reports **zero**; it previously reported
eight entries. These counts describe npm's advisory graph, not a guarantee that
all possible security risks have been eliminated.

The five remaining entries are one unfixed development-tool chain:
`eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.
The root advisory is [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm),
a stack-exhaustion denial of service for deeply nested brace patterns.
The registry's newest published `braces` version remains 3.0.3, which is affected.
Do not hide this finding, remove lint checks, vendor an unreviewed fork, or follow
npm's force-fix recommendation to downgrade eslint-config-next to 14.2.35.
Run lint only on trusted repository/configuration inputs and revisit the chain
when upstream publishes a compatible fix. It is dev-only in the resolved graph;
the public application does not import these glob parsers.

The removed critical [Next.js ImageResponse advisory](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)
affected versions before 16.3.6. The site's existing Open Graph image uses trusted
static content and an embedded JPEG, with no request-supplied SVG input; this
update patches the dependency rather than relying on that narrower exposure.

## Validation and release handoff

- Exact updated lockfile installed successfully with `npm ci`.
- Public tests: 117 passed. All lead-provider traffic in those fixtures is mocked;
  no live lead was submitted.
- Portal checks: 365 tests passed, portal TypeScript passed, no ESLint errors.
- Root TypeScript and ESLint passed. The one inherited portal `nowIso` unused-import
  warning remains; it is unrelated to this dependency change.
- Next.js 16.3.8 production build passed with 271 generated routes.
- Normal OpenNext Cloudflare build passed. Wrangler dry-run read 3,709 asset files
  and produced a 11,338.99 KiB bundle (2,800.24 KiB gzip), with only the existing
  ASSETS binding; it exited without uploading.
- Local-only OpenNext/Workerd preview: GET `/`, `/homes` and `/homes/eclipse`
  each returned 200 with `x-nextjs-cache: HIT` on both requests. GET `/api/lead`
  returned 405 without that cache header. Requests used manual redirect handling;
  no browser, production smoke requests or POST submissions were used.
- Deployment-target configuration remains `hplacer-app`, Home Placer account
  `6caa351d57b30bd04cec8a08e4330ffd`, domains hplacer.com and www.hplacer.com,
  and the existing ASSETS-only binding. No authentication or account changes were made.

The first attempt to reuse a plain Next build with OpenNext `--skipNextBuild`
failed because that build did not produce standalone output. Use the normal
`opennextjs-cloudflare build` flow, which sets the adapter's build environment;
do not change configuration to work around the skip-build invocation.

After independent review and an authorized release, follow DEPLOY.md: verify
the correct account, use a clean merged-main checkout, record the previous
Worker version, deploy, and check public page cache hits plus GET /api/lead 405.
Never POST a test lead. Watch production errors and CPU; this document does not
claim a production deployment or post-deploy validation.

## Upstream references checked

- [Next.js 16.3.8 security release](https://github.com/vercel/next.js/releases/tag/v16.3.8)
- [OpenNext Cloudflare 1.20.8 supported-version update](https://github.com/opennextjs/opennextjs-cloudflare/releases/tag/%40opennextjs/cloudflare%401.20.8)
- [OpenNext Cloudflare 1.20.7 cache-handler fixes](https://github.com/opennextjs/opennextjs-cloudflare/releases/tag/%40opennextjs/cloudflare%401.20.7)
- [Wrangler 4.147.0 and Miniflare version](https://github.com/cloudflare/workers-sdk/releases/tag/wrangler%404.147.0)
- Registry version/dependency/engine metadata was also checked with `npm view`.
