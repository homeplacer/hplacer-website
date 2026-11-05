# Model-reference structured data

The SEMrush audit reported missing `offers`, `review`, or `aggregateRating` on
model-page Product snippets. These pages describe factory designs and estimated
home/package costs; they do not publish a guaranteed offer for a specific home
or a model-specific review. Model pages now publish `WebPage` with a `Thing`
main entity containing the verified model name, manufacturer model code, images,
and specification summary. Canonical model URLs and BreadcrumbList markup stay
in place.

This deliberately gives up Product-snippet eligibility on reference models.
It does not prevent the pages from appearing in ordinary search results, and
does not claim a particular ranking or answer-engine result. Actual package
listing markup is outside this change.

Sources checked October 2, 2026:

- [Google Product snippet requirements](https://developers.google.com/search/docs/appearance/structured-data/product-snippet): a Product snippet needs `offers`, `review`, or `aggregateRating`.
- [Schema.org WebPage](https://schema.org/WebPage): `mainEntity` identifies the page's primary subject.
- [Schema.org Thing](https://schema.org/Thing): supports name, description, identifier, image, URL, and mainEntityOfPage.

## Backend dependency

The audit's robots-format warning is separate: `src/lib/robots-policy.ts`
emits the nonstandard `Content-Signal` directive. The backend owner should review
whether to move that signal out of the standard robots body while preserving
the existing public retrieval, private-path blocks, and training-bot policy.
No robots route, crawler permissions, API, event, environment variable, data
contract, or deployment behavior is changed here.

## Validation

The production Next.js build succeeds. All 93 prerendered model pages were
checked for parseable JSON-LD, matching canonical/model identity, current
manufacturer and all offered-width specification summaries, preserved
BreadcrumbList, absolute image URLs, and absence of Product, offer, review,
price, or availability claims. TypeScript and all 17 public-site tests pass;
ESLint has no errors and one existing unused-import warning in the portal.

Single-width floor area uses the recorded `home.sqft`, matching the visible
detail page rather than assuming exterior width multiplied by length equals
the published floor area. Offered multi-width plans retain the detail page's
existing width-specific calculation. Regression tests cover both Summit plans
identified during integration review and every catalog model.

SEMrush's reported count is from an earlier crawl. A post-release crawl is
needed to confirm its warning disappears; this PR has not been deployed.
