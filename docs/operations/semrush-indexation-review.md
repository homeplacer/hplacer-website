# SEMrush indexation review

The October 4, 2026 audit includes 22 excluded location pages, 12 filter views with one incoming link, and one homepage sitemap notice. Source review and read-only production checks found the current behavior consistent with the existing publication policy. This review records the evidence and adds regression coverage; it does not change public metadata, sitemap behavior, redirects, crawler access, or deployment settings.

## Location publication policy

All 27 service-area pages returned HTTP 200 with a self-canonical during the October 4 check. The five towns below had `index, follow` metadata and were the only location detail pages included in the live sitemap. Their counts match the existing public sold archive, not a new assertion of current inventory or a new customer permission review.

| Town | Recorded public projects |
| --- | ---: |
| Conway | 42 |
| Loris | 10 |
| Aynor | 16 |
| Longs | 4 |
| Myrtle Beach | 1 |

The other 22 towns returned `noindex, follow` and were omitted from the sitemap. Their pages remain available to visitors through the service-area directory. This exclusion is intentional: the current evidence file does not support an expanded indexable town page. It does not mean the business cannot serve that town. These are index exclusions, not failed page requests or private pages.

The excluded towns are Andrews, Calabash, Carolina Forest, Chadbourn, Garden City Beach, Georgetown, Lake Waccamaw, Leland, Litchfield Beach, Little River, Murrells Inlet, North Myrtle Beach, Oak Island, Ocean Isle Beach, Pawleys Island, Shallotte, Socastee, Southport, Sunset Beach, Surfside Beach, Tabor City, and Whiteville.

Keep these 22 notices as documented exceptions under the current policy. Reconsider a town only after verifying meaningful local project evidence or other approved, genuinely distinct buyer guidance; review the facts and any required media permissions, then update the page and its evidence record together. Do not invent a local office, project, testimonial, inventory claim, or repeated filler to remove the notice. Confirm the final canonical, robots metadata, and sitemap inclusion after any reviewed change.

This follows the existing [public-site operating handbook](public-site-operations.md#content-and-project-evidence). Google's [noindex documentation](https://developers.google.com/search/docs/crawling-indexing/block-indexing) explains that the page must remain crawlable for search engines to read the directive; a robots.txt block is not a substitute. No crawler rule is changed by this review.

## Filter views and internal links

All 12 audited filter URLs returned HTTP 200 with their existing collection canonical:

- `/homes?brand=Cavco`, `/homes?brand=Champion`, `/homes?brand=Clayton`, and `/homes?wall=drywall` canonicalize to `/homes`.
- `/packages?model=birdie`, `hey-jude`, `pinehurst`, `sebastian`, `stayin-alive`, `tanglewood`, `ultra-flex-28-52`, and `ultra-flex-28-68` canonicalize to `/packages`.

These are browsing states, not 12 separate SEO landing pages. They are absent from the live sitemap. The collection pages and individual home/project pages supply the primary discovery routes. Keep contextual filter links useful for buyers, but do not add repetitive links solely to increase the incoming-link count. Existing model archive links are already restricted to models with published records by `modelPackageHref`; that separate journey fix must be preserved.

This is an accepted low-priority notice for the current browsing architecture, not proof that important model pages are orphaned. Google's [canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) supports identifying a preferred collection URL for similar variants. If a brand or town genuinely needs a separate search landing page, propose distinctive source-backed content and a deliberate canonical policy in its own task rather than silently indexing every query combination.

## Homepage sitemap notice

The live homepage canonical and sole root sitemap entry were both `https://hplacer.com`. The homepage returned HTTP 200 and remained linked from site navigation. No missing homepage or conflicting canonical was established by these checks.

Do not introduce a redirect between the root URL and its slash spelling. Google's [root URL explanation](https://developers.google.com/search/blog/2010/04/to-slash-or-not-to-slash) distinguishes this case from trailing slashes on non-root paths. Accept the current SEMrush notice as a tool-level discrepancy unless a fresh crawl or Search Console establishes an actual discovery/indexing problem.

## Verification and remaining limits

Run `node --test tests/indexation-policy.test.mjs` and the full public test suite. The new tests execute current collection metadata, every location's metadata, the evidence lookup, and the sitemap function with isolated inventory providers. They verify matching canonical/Open Graph routes, evidence-gated indexing and sitemap inclusion, no filter queries in the sitemap, one normalized root URL, and evidence counts that match the recorded archive. They send no leads and request no live inventory.

Production checks in this review read all 27 location pages, all 12 audited filter URLs, the homepage, and the live sitemap. They do not establish Google's selected canonical or actual index coverage; those require Search Console. No new public deployment, SEMrush score improvement, or ranking gain is claimed.

No new API, event, route, schema, environment variable, backend behavior, or backend implementation dependency is required. A future sitemap cache/discovery defect, if demonstrated, belongs in a separate backend-owned task. Broken media, mobile performance, text-to-HTML ratio, and gallery-resource notices are separate remediation lanes and are not marked resolved here.
