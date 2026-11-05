# Location and financing copy review

Reviewed October 3, 2026. This customer-facing change preserves the existing
27 town URLs, headlines, county keys, ZIPs, coordinates, utility-provider
context, and location-evidence indexing rules. It adds no town pages or API,
event, environment-variable, data-feed, or deployment contract. Model pricing
and the existing user-approved $5,000 / 6.5% buyer offer are unchanged.

Town copy is explicitly written for each record, not changed by regex price
substitution. It retains local context while directing buyers to the actual
parcel, written scope, association/restriction check, and lender. Home Placer's
preference for lots without an HOA remains visible, without promising that
every lot or town has none. The location page's own blanket inclusion and
timeline copy is also clarified so it cannot reintroduce the removed claims.

## Source checks

- [Current 24 CFR 3280.305(c)(2)(ii)](https://www.ecfr.gov/current/title-24/subtitle-B/chapter-XX/part-3280/subpart-D/section-3280.305#p-3280.305(c)(2)(ii)) lists Horry, Georgetown, Brunswick, **and Columbus** in Wind Zone II. The previous Columbus Zone I / lower-cost claim was incorrect. A zone's engineering design reference is not a storm-survival promise.
- [HUD homeowner resources](https://www.hud.gov/hud-partners/manufactured-home-resources) and [HUD labels/data plate](https://www.hud.gov/hud-partners/manufactured-home-labels) explain documented design zones and site/installation considerations. Buyers are directed to the actual home's ratings and site review, not a simplified MPH assurance.
- [USDA Guaranteed Loan Program](https://www.rd.usda.gov/programs-services/single-family-housing-programs/single-family-housing-guaranteed-loan-program) identifies eligible rural areas, applicant requirements, and participating lenders. Address-map eligibility is not approval of the borrower, home, or transaction; no county-wide $0-down eligibility is asserted.
- [Fannie Mae factory-built property requirements](https://guide-selling.fanniemae.com/sel/b2-3-02/special-property-eligibility-and-underwriting-considerations-factory-built-housing) treats title, foundation, utilities, documentation, and appraisal as distinct property requirements. Land ownership and a foundation are not automatic legal classification or loan approval. The same source distinguishes modular construction from HUD-code manufactured housing.
- [VA purchase-loan guidance](https://www.va.gov/housing-assistance/home-loans/loan-types/purchase-loan/) and [VA borrower eligibility](https://www.benefits.va.gov/homeloans/purchaseco_eligibility.asp) qualify possible no-down-payment financing with borrower, lender, and property requirements.

The financing form retains its existing fields, submission type, and handling;
page-supplied button and success text clarify that it collects an inquiry,
not a loan application. No live lead was submitted during verification.

## Backend dependency (not changed in this PR)

`src/app/llms.txt/route.ts:31` still tells retrieval clients that Columbus County
is Wind Zone I. The backend owner should correct that public route to Zone II,
using the current CFR county list above. The route also contains the older
unqualified no-HOA and one-price/one-closing copy; its owner should align those
statements with the parcel and written-scope qualifications in the public pages.
This PR changes no route handler, robots policy, feed, or backend behavior.

## Regression coverage

The public test suite checks all 27 town identities and coordinates, unchanged
utility-provider context, correct four-county zones, absence of the previous
town-wide offers, preserved indexing and static-parameter wiring, and the
financing/comparison page's inquiry and qualification wording. Other model
pricing and warranty source data are not edited.
