# AI-information manifest copy correction

Reviewed October 3, 2026. The user explicitly approved the two limited
backend-owned corrections (robots policy and the outdated AI-information file)
after the frontend release. This separate PR changes only the existing
`/llms.txt` response copy, its offline regression tests, and this review note.
It does not change either project's APIs, events, secrets, schedules, tracking,
listing ingestion, deployment safeguards, or portal behavior.

## Preserved contracts

- Existing `/llms.txt` URL, zero-argument `GET`, `force-static`, and
  `text/plain; charset=utf-8` response remain unchanged. No request-time fetch,
  new route, environment variable, or custom cache header is introduced.
- Catalog-derived model counts and the eight best-seller links still use
  `getAllHomes()` and `bestSellerHomes()`. Recorded featured dimensions and
  floor areas are unchanged; no manufacturer record is edited.
- The six recent article links still use the existing `getAllPosts()` loader,
  including its build-day publication gate. Authored headlines are preserved.
- Existing key-page URLs, phone, email, address, service area, and owner-confirmed
  one-year defect / separate two-year mechanical and ten-year structural
  warranty statements are preserved.

## Copy corrections

- Current package prices and availability point to the current inventory,
  rather than freezing the old $179,999 floor. Model estimates are distinguished
  from actual listings and parcel-specific quotes; the quarter-acre assumption,
  variable lot/site/utility costs, and written project scope are explicit.
- Remove the static Google review score/count, corporate identities and ranking
  claims, blanket no-HOA/one-closing promises, universal utility/permit scope,
  and general completion-time promise. Brand names come from the same current
  catalog as the model counts.
- Clarify parcel HOA/deed/placement review, providers, permitting authority,
  responsibilities, written scope, closing arrangements, and project-specific
  timing. This does not alter a buyer's existing written agreement.
- Correct Columbus County to HUD Wind Zone II, alongside Horry, Georgetown,
  and Brunswick. Retain actual-home/data-plate and site-installation review;
  a design-zone classification is not a storm-safety guarantee.
- Financing options require borrower, address, home, title, foundation, lender,
  and program review. A rural town name does not establish USDA approval or a
  no-down-payment loan.

## Primary-source checks

- [24 CFR 3280.305(c)(2)(ii)](https://www.ecfr.gov/current/title-24/subtitle-B/chapter-XX/part-3280/subpart-D/section-3280.305#p-3280.305(c)(2)(ii))
  is the governing county list. Direct eCFR retrieval was access-limited during
  this check; the [official GovInfo CFR text](https://www.govinfo.gov/content/pkg/CFR-2025-title24-vol5/pdf/CFR-2025-title24-vol5-sec3280-305.pdf)
  lists all four service-area counties in Zone II. This aligns with the source
  review already recorded in `location-financing-copy-review.md`; no design-speed
  or hurricane-survival claim is added.
- [USDA Guaranteed Loan Program](https://www.rd.usda.gov/programs-services/single-family-housing-programs/single-family-housing-guaranteed-loan-program)
  directs applicants to address eligibility and participating lenders and
  states applicant requirements. [USDA manufactured-home training](https://www.rd.usda.gov/media/file/download/usda-rd-sfh-manufactured-home-loans-08152025.pdf)
  separately identifies site, foundation, documentation, title, and closing
  requirements. The manifest summarizes the need for review, not a loan offer.
- Warranty terms come from the owner's explicit instructions and the existing
  public warranty page. Written coverage, exclusions, and claim procedures
  remain controlling; no coverage is removed or expanded.

## Regression coverage

`tests/llms-manifest.test.mjs` executes the production handler with the actual
catalog, business identity, town records, and blog loader offline. It checks
response headers/static contracts, model/brand/featured counts and links,
unchanged recorded dimensions, all existing key pages, corrected qualifications,
and warranties. Injected future/today article records verify publication gating;
mutated review values verify no stale rating/count can leak into the response.
No live inquiry is sent and no third-party profile is changed.

Verified locally: 68 public tests (including six new manifest tests) and 365
portal tests pass; `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.
The generated `.next/server/app/llms.txt.body` and `.meta` confirm current catalog
counts and links, corrected copy, HTTP 200, and the unchanged plain-text header.
The only lint warning is the inherited unused `nowIso` import in portal code;
the inherited Next middleware-deprecation notice is outside this copy-only task.
