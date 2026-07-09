# Compliance / Risk Review Flags

*Prepared by an engineer acting as a compliance-risk reviewer — **NOT legal advice.**
Every item is **flagged for a human reviewer** (legal / lender / broker / dealer-licensing),
not a directive to change copy. "CONFIRMED" = verbatim from code; interpretation labeled.
Confirmed 2026-07-09.*

## P0 — Address before / at launch

### C-1 · No Privacy Policy or Terms page exists — **P0**
CONFIRMED: no `privacy`/`terms`/`legal`/`cookie`/`disclaimer` route in `src/app` or `public`
(grep-verified). Footer has only a copyright + "Homes shown are representative" line
(`site-footer.tsx:136-140`). Meanwhile the site collects name/phone/email/address/free-text
(`api/lead/route.ts:50-60`), forwards to Follow Up Boss + Resend, captures UTM/gclid/fbclid/
referrer (`route.ts:37-48`, `attribution.ts`), and runs GA4 on every page. **Why it matters:**
a lead-gen site collecting PII + running analytics with no published privacy policy / data-use
disclosure / cookie notice is a baseline gap (state privacy statutes, Google Ads policy,
CAN-SPAM). **Reviewer: legal (privacy).** *(Also blocks Google Ads — Ads requires a privacy policy.)*

### C-2 · Contact consent is fine-print only — no TCPA/SMS consent — **P0**
CONFIRMED: contact + want-this-house forms carry one sentence, "By submitting, you agree to be
contacted by Home Placer about your inquiry." (`contact-form.tsx:112`, `want-this-house-form.tsx:112`).
The **financing form has no consent line** ("No credit pull… We'll call…" only,
`financing-form.tsx:110`); **email-capture** has only "No spam — unsubscribe anytime."
(`email-capture.tsx:37`). Phone is **required** on 4 forms and CTAs say "Call or text (843)
849-HOME" (`page.tsx:164`). **Why it matters:** for autodialed/prerecorded calls or texts, the
passive fine print lacks a checkbox, express written consent, "msg & data rates / reply STOP"
language, and a policy link — classic TCPA/SMS exposure, and entirely absent on financing +
subscribe. **Reviewer: legal (TCPA/telemarketing).** (Overlaps lead-flow-audit consent table.)

## P1 — Review before / soon after launch

### C-3 · Financing "$0 down" / USDA / VA / FHA program claims — **P1**
CONFIRMED: "$0-down options…" (`financing/page.tsx:10`), "$0 down for veterans" (`:22`), "As low
as 3.5% down" (`:27`), "A lot of Horry County qualifies for USDA $0-down" (`:69`). **Mitigant
(good):** bottom disclaimer "Home Placer is not a lender; we connect buyers with third-party
lenders. All financing subject to credit approval." (`:107-111`), and most claims are hedged.
**Why it matters:** headline chips read unconditional next to the program name; qualifiers sit in
body copy. Advertising specific financing terms can implicate Reg Z / MLO-advertising rules even
for a non-lender referrer. **Reviewer: lender / mortgage-compliance.**

### C-4 · Warranty page contradicts every other page (1-yr vs "2-10") — **P1**
CONFIRMED: `/warranty` claims "Every Home Placer home is covered: a full 1-year warranty… plus a
2-10 Home Buyers Warranty backing your systems for 2 years and structure for 10." (`warranty/page.tsx:9-11,26-34`).
Every other surface advertises **only 1 year** — `site.ts:91` "A limited one-year warranty plus a
30-day walk-through", homepage chip "1-year warranty" (`page.tsx:68`). **Why it matters:** "Every…
home is covered" + specific 2/10-yr figures tied to a **named third-party product** are firm
guarantee representations. Verify (a) HP actually enrolls every home in 2-10 HBW, (b) the durations
& systems/structure scope match the real policy, (c) who backs each layer. **Reconcile the
1-yr-vs-2-10 inconsistency.** **Reviewer: dealer / legal (warranty).**

### C-5 · "Licensed" claims — no license number; SC **and** NC asserted — **P1**
CONFIRMED: footer "Licensed manufactured-home dealer, Horry County, SC." (`site-footer.tsx:138`);
homepage "Licensed in SC & NC" (`page.tsx:68,154`); metadata claims Brunswick & Columbus NC
(`layout.tsx:20-21`); `site.ts:94-95` "Licensed SC dealer… not a broker." **No license number
appears anywhere.** **Why it matters:** licensure claimed repeatedly (incl. NC, a separate regime)
with no number; SC/NC dealer-advertising rules can require the number on ads. Confirm SC **and** NC
licenses are active and whether the number must be shown. Verify "dealer" (not "broker") is accurate
for all activity incl. land. **Reviewer: dealer-licensing (SC + NC).** (Overlaps website-audit P1 claim + NC-"SC" bug.)

### C-6 · "Recently Placed" presents MLS closed sales as HP's own placed/sold homes — **P1**
CONFIRMED: "{n} homes Home Placer has placed and sold…" (`recently-placed/page.tsx:29-34`); footer
"Closed sales across the Coastal Carolinas MLS. Photos are of real Home Placer homes." (`:105-107`);
per-home "Closed sale · Coastal Carolinas MLS" + **street address + sold price** (`[slug]:114,121-127`);
JSON-LD publishes each address+geo as "placed and sold by Home Placer" (`jsonld.tsx:178-282`); the
case-study blog lists specific closed prices/dates. Source = Coastal Carolinas MLS/Paragon
(`sold-homes.json`, `paragon-sold.csv`). **Why it matters:** (a) **accuracy** — every home labeled
"placed and sold" by HP must be an actual HP transaction, not just an MLS record HP can see;
(b) **MLS/IDX data-use & attribution** — republishing closed-sale addresses/prices/photos may need
specific MLS permission/attribution. **Reviewer: broker / MLS compliance + dealer.**

### C-7 · "7 Google reviews" advertised, only 3 on site — **P1**
CONFIRMED: `site.ts:40-44` `reviewCount 7, rating 5.0` but `reviews.ts` has **3** review objects.
UI renders "5.0 · 7 Google reviews" with only 3 cards, each "Verified Google review"
(`testimonials.tsx:31-52`); footer "★ 5.0 on Google (7 reviews)" (`site-footer.tsx:48`); JSON-LD
asserts `reviewCount:7` to search engines while embedding 3 (`jsonld.tsx:77-89`). **Why it matters:**
the 7-vs-3 gap and the aggregateRating must match the **live GBP** at all times or the claims are
unsubstantiated (FTC review-substantiation + schema-accuracy). `reviews.ts` correctly uses verbatim/
attributed reviews ("never invent testimonials") — keep count+rating synced to live GBP.
**Reviewer: legal / marketing-compliance.** (Also website-audit P2 + technical B6.)

## P2 — Review when practical

- **C-8 · Estimated-monthly-payment offers** in lead flows ("See your price & monthly payment",
  `page.tsx:142-148`; land-packages `:238`; home detail `:281-283`; want-this-house auto-message
  `:35`). No numeric APR/payment published (lower risk), but quoting payments — even privately — can
  pull specific figures into Reg Z trigger-term / MLO territory for a non-lender. **Reviewer: lender/Reg Z.**
- **C-9 · "Apply for financing"** button/heading (`financing-form.tsx:107`, `financing/page.tsx:80`)
  on a form that (per its own comment) collects **no** SSN/income/credit. Calling it "apply" could be
  read as taking a credit application (ECOA/Reg B). Consider a softer verb. **Reviewer: lender/legal.**
- **C-10 · "Every… home… qualifies"** (`financing/page.tsx:49-54`) blurs *property* qualification
  (titled real property) with *borrower* qualification (still program-dependent). Matches Joe's
  standing position; a lender may want a "borrower/loan approval separate" hedge. **Reviewer: lender.**
- **C-11 · Fair Housing** — concentration of "family"/"family-first" selling frames in town copy
  (`locations.ts:181,128`) + a testimonial citing "the perfect neighborhood" (`reviews.ts:16`). Most
  are neutral place/product descriptions; worth a Fair-Housing pass on town copy + testimonial choice
  (familial-status steering is what reviewers scan for). **Reviewer: legal (Fair Housing).**
- **C-12 · GA4 with no consent gate** (`layout.tsx:67`, `analytics.tsx`) — ties to C-1. `anonymize_ip`
  is a partial (and in GA4, no-op) mitigant; no cookie/consent mechanism or disclosure. **Reviewer: legal (privacy).**
- **C-13 · RESPA / affiliated business** — dealer routes homebuyers to sister KW brokerage "The
  Forturro Group" via UTM referral (`site.ts:51-59`, `forturro-land-search.tsx`). No fee evident in
  code, but the affiliation is explicit; if any value flows for the referral, affiliated-business-
  arrangement / RESPA disclosure may apply. **Reviewer: broker / legal (RESPA).** (P2/P3.)

## Looks FINE (verified — no action)

- **Wall-finish wording is correct** — "pre-finished gypsum panels" (`manufactured-home-drywall-vs-wall-strips/page.tsx:18,73`, `home-types.ts:10`); no interior finish called "vinyl/VOG." (The "Vinyl" strings in `models.json` are *exterior siding colors*.) Matches Joe's standing correction.
- **"Not a lender" disclaimer** present on financing page, 2 FAQs, and financing blog posts (though **not on the financing form itself** — see C-2/C-9).
- **Mobile-vs-manufactured HUD/legal distinction accurate** (pre/post-June-15-1976, HUD code). Minor nit: homepage still markets "mobile home dealer" as SEO bait while content says you can't buy a new mobile home (accuracy nit, P3).
- **Pricing consistently hedged** ("from the low $200s" paired with "varies by model, size, lot"; footer "Pricing and availability subject to change").
- **Family-land / heirs'-property blog handles legal boundaries well** ("We can't give you legal advice… It's a legal question, not a sales question").
- **No rental / property-management / landlord-services wording anywhere** (grep-confirmed) — only the Forturro land *search* (C-13). Tenant/renter compliance risk is effectively nil.

## Suggested triage order

1. **C-1 (privacy/terms) + C-2 (TCPA consent)** — foundational; touch every form + visitor; also gate Google Ads.
2. **C-4 (warranty 1-yr vs 2-10), C-5 (license #/NC), C-6 (MLS "placed & sold" accuracy), C-7 (7-vs-3 reviews)** — concrete, verifiable factual claims.
3. **C-3 / C-8–C-10** — financing-advertising language, batched for the lender/Reg Z reviewer.
4. **C-11–C-13** — Fair Housing pass, analytics consent, RESPA affiliation.

*Nothing above is legal advice — each item is for the indicated reviewer to confirm.*
