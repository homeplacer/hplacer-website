# Source-map dependency patch — October 6, 2026

This isolated patch starts from main `95fd6dea0f1f8e2f71a55ef3fd46390392557db3`.
The only dependency change is the existing `source-map-js` lockfile record:
version, registry URL and integrity move from **1.2.1 to 1.2.2**. The manifest,
every unrelated lock record, Next.js 16.3.8, ESLint configuration, OpenNext,
Wrangler, application source, routes, bindings, secrets and tracking are unchanged.

[GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
affects `source-map-js >=1.0.0 <1.2.2`; the maintainer's
[1.2.2 release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2)
fixes indexed-source-map denial of service. All existing consumers accept
`^1.2.1`: Next's PostCSS 8.5.23, Tailwind's PostCSS 8.5.26 and
`@tailwindcss/node` 4.3.3. They resolve to the single patched 1.2.2 installation;
no override, new direct dependency or major upgrade is needed.

The full audit falls from **six to five high affected-package entries**. The
production-only audit (`npm audit --omit=dev --json`) falls from **one to zero**.
These are advisory-graph results, not a guarantee of absolute security or proof
that the public Worker accepted exploitable source maps.

The remaining development-only chain is
`eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
still lists no patched version; the registry's latest `braces` remains 3.0.3.
Do not force-fix, downgrade eslint-config-next to 14.2.35, remove lint or use an
unreviewed fork. Run lint on trusted repository/configuration inputs and revisit
when a compatible upstream fix exists.

## Verification

- `npm ci` installed the exact lockfile (647 packages; 648 audited).
- All three consumer ranges accept 1.2.2; the manifest and every unrelated lock
  record are identical to the task base.
- Actual patched-library checks reject invalid/oversized indexed offsets and
  excessive nested offset totals, while a valid SourceNode round trip succeeds.
- Public tests: **220 passed**; lead-provider requests remain synthetic/mocked.
- Full lint: no errors, only the inherited portal `nowIso` unused-import warning.
- Root TypeScript passed before and after the production build.
- Normal OpenNext 1.20.8 build passed, including Next.js 16.3.8 and 272 generated
  pages. The build-cache integrity gate passed with 273 source records and remains
  mandatory before upload.
- No production lead, account-setting change, merge or deployment was performed.

Independent review and an authorized operator release are separate steps. Do
not alter the live release checkout or the primary checkout's user-owned
`AGENTS.md` to deliver this patch.
