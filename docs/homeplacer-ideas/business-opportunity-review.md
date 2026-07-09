# Business / Opportunity Review

*Direct opinion on what Home Placer is missing, based on the actual business. Blunt by
request — if something's a bad idea, it says so. Opinion throughout, grounded in the audit.*

## The honest one-paragraph read

Home Placer already has the thing most manufactured-home dealers never build: a genuinely
good website that educates a nervous first-time buyer and captures the lead cleanly. The
engineering is above the bar for this industry. **The company is not held back by its website
code — it's held back by three business inputs that only Joe can supply: prices, a privacy/
consent layer, and a decision about the landowner/seller line.** Fix those and the existing
site will convert materially better. Everything else is optimization.

## What's actually blocking conversion right now

1. **No prices.** Every one of 93 homes says "Call for pricing" (`setup-pricing.json`/
   `home-pricing.json` = `{}`). The price sort/filter is built and dormant. This is the single
   biggest conversion drag — buyers self-select out when they can't gauge affordability. The
   machinery is ready; it needs numbers. **NEEDS JOE.**
2. **No privacy policy / consistent consent.** Beyond the legal exposure (compliance C-1/C-2),
   this **blocks Google Ads** (Ads requires a privacy policy) — so the paid-traffic lever is
   locked until it's fixed. **P0.**
3. **The landowner/seller line doesn't exist.** The business says it wants these leads; the site
   has no page, form, or route for them, and they'd currently land as generic buyer leads. It's a
   cheap build (a page + form + FUB tag) **once Joe decides the offer.** **NEEDS JOE.**

## What buyers need explained before they call (and how the site does)

The site is strong here — this is its best asset. Covered well: manufactured vs modular vs
site-built vs mobile, drywall vs strips, FHA/VA/USDA/conventional on owned land, septic/well/
permits, the 6-step timeline, "no HOA / own the land." **Gaps:** a single **first-time-buyer
"start here" hub** (the education is excellent but scattered across footer links), and a
**browsable "what's available now"** (everything routes to a call).

## The objections that stop people from becoming leads — and whether the site answers them

| Buyer objection | Answered? | Where / gap |
|---|---|---|
| "Is a manufactured home cheap/temporary junk?" | ✅ Strong | comparison + drywall + brand pages |
| "Will it hold value / can I really finance it?" | ✅ Strong | financing page ("real property… same loans") |
| "What will it actually cost me?" | ❌ **No** | "Call for pricing" everywhere — the big gap |
| "Can I afford the monthly payment?" | ⚠️ Partial | promised after a call; no on-site estimator (Phase 2) |
| "What about land, septic, permits — is this a nightmare?" | ✅ Good | FAQ + land-packages + per-county facts |
| "Are these guys legit / licensed?" | ⚠️ Partial | says "licensed" but shows no license #, only 3 reviews shown, one off-message |
| "How long does it take?" | ✅ Good | `/process` |

## What would make Home Placer look more trustworthy (cheap wins)

- **Show the dealer license number(s)** in the footer/About (NEEDS JOE for the number). "Licensed"
  with no number is weaker than "SC MH Dealer Lic. #XXXX."
- **Show all real Google reviews, not 3 of 7,** and lead with product-relevant ones (drop the
  Realtor-sounding testimonial). Then **run a review-request workflow** to grow past 7 — review
  count is the real local-pack lever, and 7 is thin.
- **Reconcile the warranty story** (1-year everywhere vs "2-10" on `/warranty`) — a contradiction a
  sharp buyer will notice, and a substantiation risk (C-4).

## What staff probably waste time explaining repeatedly (→ automate later)

- **Financing eligibility** ("can I get FHA/VA/USDA on this?") → a Phase-2 **financing estimator**
  (education, not advice) qualifies and pre-answers.
- **"What's my all-in price?"** → publish pricing now; **Package Builder** later.
- **Status of an in-flight deal** (permit, septic, delivery, closing) → Phase-3/4 trackers +
  customer portal cut the "where are we?" calls.
- **Septic/permit/timeline basics** → already offloaded to content (good); keep feeding the blog.

## What would help close more deals

- Prices on-site (self-qualification) · a real "available now" list (urgency) · click-to-text for a
  text-first audience · an autoresponder that sets expectations after a form (needs approval) ·
  offline-conversion export so ad dollars optimize on closings, not form-fills.

## What should NOT be built (distractions)

- **A second CRM / lead dashboard in-app** — FUB already does it. (See backend-opportunities.)
- **A custom attribution/reporting dashboard before there's ad spend + volume.**
- **Customer-facing SMS/email automation without approval + a consent framework.**
- **Multi-dealer SaaS** — out of scope (D-HP-001); don't architect for it now.
- **A tenant/renter search or any rental workflow** — off-strategy; the site correctly repels this
  audience today. Don't add it. (Only watch item: the Forturro "Browse all listings" link — see
  lead-flow-audit / questions-for-joe.)
- **Chasing the "mobile home" SEO term into rent/park intent** — the current approach (capture the
  high-volume term, pivot the page to ownership) is right; don't build rent-oriented pages for it.

## Roadmap opinion (agree / adjust)

The locked roadmap (Phase 0 harden → Phase 1 DB/Auth/API/Admin → Phase 2 sales tools → Phase 3–4 ops
+ lifecycle) is **sound and correctly sequenced.** Two adjustments:

1. **Don't start Phase 1 on a calendar — start it on data.** Per D-HP-002, let live pricing + real
   traffic prove demand first. The temptation to build the platform before validating conversion is
   the main risk to guard against.
2. **Pull two cheap, high-value items forward out of "Phase 1+":** the **landowner intake** (a form,
   not a platform) and the **privacy/consent layer** (unblocks Ads). Both are days of work and
   unlock disproportionate value.

## Bottom line

The build quality is not the problem. The company's growth is currently gated by **business
inputs (pricing, consent/privacy, the seller-line decision)** far more than by features. Ship those,
show the license number and real reviews, and let the resulting traffic tell you whether the
platform build is worth starting. Resist building a backend that duplicates Follow Up Boss.
