# Additional dealer-confirmed model estimates — October 6, 2026

## Scope and source

The dealer confirmed five additional **land-and-home package estimates** in the
October 6 realtime conversation. The final correction in that conversation is
that **every home-only estimate is $65,000 lower** than its package estimate.
That supersedes the earlier $60,000 convention for all models, including the
original 83 quotes. These are model-and-lot estimates, not asking prices for an
MLS-listed property.

| Existing model | Slug | Package estimate | Home-only estimate |
| --- | --- | ---: | ---: |
| Stayin' Alive | `stayin-alive` | $229,999 | $164,999 |
| Caddie | `caddie` | $249,999 | $184,999 |
| Shout | `shout` | $229,999 | $164,999 |
| Pegasus | `pegasus` | $229,999 | $164,999 |
| Levi | `levi` | $189,999 | $124,999 |

The spoken “Caddy” identifies the existing **Caddie** record, model code
`57fwy28683bh`. No duplicate model, renamed slug, or manufacturer record is added.
Stayin' Alive is the existing `57TPO28563PH` record, also known as “Staying Alive”;
Shout is `57TMI28563AH`, Pegasus is `28483H`, and Levi is `27NXT16602AH`. For Levi,
the dealer's final correction was “one eighty-nine,” not the preceding “two.”

## Preservation and verification

The original 83 package estimates were added in commit `bad8439` on October 2
and remain unchanged. Their home-only estimates are intentionally recalculated
$5,000 lower to follow the corrected $65,000 deduction. A regression fixture
preserves both original maps at
`tests/fixtures/model-pricing-confirmed-20261002.json`. Tests verify the 83
original package figures, the corrected original home-only figures, all five
new quotes, and exact $65,000 arithmetic for every pair.

There are now **88 quoted active models**, exactly matching the buyer-facing
catalog. The five retired source models remain archived and unpriced. Original
manufacturer records, aliases, photos, tours, historical sold prices, and
property-specific MLS asking prices are unchanged. The existing graceful
fallback remains available for a future model without a confirmed quote.

Before this change, read-only live checks verified all 83 original model URLs
and their catalog cards on October 6. Every detail returned 200 and visibly
rendered both then-current confirmed figures in its model summary, excluding
script/schema content; every corresponding catalog card showed both figures.
There was no demonstrated price-display wiring or cache defect. The full dated
pre-change evidence is retained as
`hplacer-live-model-pricing-verification-20261006.json` in the originating task's
output folder. It does not prove the five new quotes or revised home-only
figures are deployed.

## Buyer-facing qualifications and release

The existing estimate qualifications remain unchanged: packages assume a
quarter-acre lot and full setup; land, lot size, utilities, site work, permits,
options, and local requirements can vary. Buyers should call, text, or email
for a written estimate for their lot. Home-only and package figures remain
distinct on details and catalog cards. The buyer-facing land-readiness estimate
guide now describes the $65,000 convention, without treating it as a separate
parcel or utility quote.

There is no new API, event, route, schema, environment variable, backend behavior,
MLS-feed change, or deployment safeguard change. The existing static imports
require the normal reviewed rebuild/release before these changes appear in
production. No production lead submission or cache bypass is required.

Verification commands:

```bash
node --test tests/model-pricing.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
```
