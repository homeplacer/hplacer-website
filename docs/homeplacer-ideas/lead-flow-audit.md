# Lead-Flow & Conversion Audit

*Traces the full lead journey and flags where leads/attribution/visibility can break.
Confirmed against code 2026-07-09. Opinions labeled.*

## The journey, end to end (confirmed)

```
Visitor
  → first-touch attribution captured to localStorage      (lib/attribution.ts)
  → lands on a page, sees CTA
      • Call:  tel: link (37 across the site)              (grep tel: = 37)
      • Text:  ✗ NONE (0 sms: links)                        (grep sms: = 0)
      • Form:  1 of 5 forms                                (components/*form*, email-capture)
  → submitLead(type, data)                                 (lib/lead.ts)
      → POST /api/lead  (attribution attached)             (api/lead/route.ts)
          → validate (422 if missing name/phone; email for subscribe)
          → deliverToFub()  — event + person + tags + source (+ warranty routing)
          → deliverByEmail() — Resend team email (if key set)
          → always console.log; if BOTH fail → CRITICAL LEAD_NOT_DELIVERED
      → GA4 generate_lead event                            (lib/analytics.ts)
  → on-page confirmation state ("Thanks — we've got it")
  → follow-up happens inside Follow Up Boss (automations live in FUB, not code)
```

**This pipeline is genuinely well-built** — retries w/ backoff, E.164 phone normalization
to maximize FUB merge, safe warranty routing that never steals an owned lead, first-touch
attribution on every form, and a no-silent-loss marker. Credit where due. The gaps below
are mostly at the **edges** (ops config, visibility, consent, missing paths), not the core.

## Lead types today (confirmed — `route.ts:33`)

`contact` · `financing` · `subscribe` · `service`. **No `seller`/`landowner` type.**

---

## Where leads can be LOST

| # | Risk | Detail | Severity |
|---|---|---|---|
| L1 | **Unwatched failure marker** | `CRITICAL LEAD_NOT_DELIVERED` (`route.ts:540-545`) is the last-resort net, but **no alert is wired to it** (`LAUNCH-READINESS.md:46`, `TODO.md`). If secrets are unset/invalid at go-live and Resend is off, *every* lead becomes an unread log line. | **P0 (ops)** / NEEDS ACCESS |
| L2 | **No bot/spam protection** | `/api/lead` has payload/field caps but **no honeypot, rate-limit, or captcha**. Spam floods FUB and buries real leads; also skews GA `generate_lead`. | **P1** |
| L3 | **Double-submit → duplicate events** | All 5 forms only disable the *button* while sending (`disabled={status==="sending"}`); Enter-key resubmit isn't blocked and there's **no `if(status!=="idle")return` guard** (open in `TODO.md`). FUB merges the *person* by email/phone, but duplicate **events/tasks** can still be created. No idempotency key on the request. | **P2** |
| L4 | **5xx → mailto fallback can dead-end** | On a 5xx/network error `submitLead` opens a `mailto:` (`lead.ts:61-67`). On mobile with no configured mail app it silently no-ops — though the UI does tell the user "didn't open? call." Acceptable, but a durable server-side outbox (KV/Queue) would be safer than relying on the client. | **P2** |
| L5 | **localStorage blocked → attribution lost** | First-touch is client-side only (`attribution.ts`). Private mode / blocked storage → lead arrives with no source. Minor; inherent to the approach. | **P3** |

## Where ATTRIBUTION can break

- **First-touch only** (by design, `attribution.ts:1-7`). A visitor who first arrives
  "direct" then converts via a paid click is credited "direct." Reasonable tradeoff; just
  know last-touch/multi-touch isn't captured. (P3 / NEEDS JOE if paid ads scale.)
- **No offline-conversion loop back to Google/Meta.** `gclid`/`fbclid` are captured and
  passed to FUB, but there's no export of *closed* deals back to Ads/Meta for
  conversion-optimized bidding. Big lever once ad spend starts. (P2 opportunity — see
  seo-content-opportunities + backend-opportunities.)
- **No GA4 ↔ FUB stitching** (no client_id/user_id joined to the CRM record). (P3.)

## Where STAFF may not know what happened

- **All visibility lives in FUB. There is no in-app admin/dashboard** (no DB, no auth).
  If a FUB Lead Flow/automation isn't configured for a given `source`/`tag`, a lead can
  land quietly on a timeline with no human alert. HANDOFF already flags *"verify a FUB
  Lead Flow rule exists for the `subscribe` tag"* — treat that as a live gap. **NEEDS JOE
  / NEEDS ACCESS** to confirm FUB automations for every source: `hplacer.com`,
  `Home Placer Warranty`, and each tag. (P1 to verify.)
- The unwatched `LEAD_NOT_DELIVERED` marker (L1) is the extreme version of this.

## Where the CUSTOMER may not get confirmation

- On-page confirmation states are good (every form). **But there is no automated
  email/SMS *receipt to the customer*** — Resend only emails the *team*
  (`route.ts:419-423`). A buyer who submits at 11pm gets an on-screen message and then
  silence until someone calls. An autoresponder would set expectations and reduce "did it
  go through?" anxiety. **Customer-facing email/SMS needs Joe's explicit approval**
  (standing rule) → PARKING LOT / NEEDS JOE, not a silent build.

## Wrong-type-of-lead & owner/seller separation

- **Buyer vs. financing vs. service** are cleanly separated by `type` + tags + routing. Good.
- **Landowner/seller has no path.** There's no `seller`/`landowner` lead type, no intake
  page, no distinct routing. A landowner wanting to *sell* land to HP would have to use the
  generic contact form and self-describe in free text — and would be tagged like a buyer.
  When the seller path is built, give it its **own `type` + tag + FUB routing** so owner
  opportunities don't get worked like buyer leads. (P2 opportunity; NEEDS JOE on timing.)
- **Note the buyer "landowner" language is different:** all on-site "already have land?"
  copy (`land-packages`, `financing-form`, `homes/[slug]`) targets a *buyer who owns a lot*,
  not a *seller offering land*. Don't confuse the two in the build queue.

## Bad-lead (tenant/renter) risk — LOW, with one watch item

- Site content **actively repels** the leased-land/rental audience (education pages argue
  *owning* land beats a land-lease park; "We've never put a family on leased land, and we
  never will" — `data/blog-posts.json`). This is on-message and good.
- **One watch item:** the Forturro **"Browse all listings"** button
  (`forturro-land-search.tsx:39` → `site.forturro.searchUrl`) is an *unfiltered* MLS search,
  unlike the land-only deep link beside it. If `search.forturro.com` surfaces rentals, an HP
  visitor could land on rental inventory and generate a rental inquiry (on the Forturro
  side, not HP's CRM — but still off-message). **NEEDS JOE:** confirm what that search shows;
  consider pointing "Browse all" to *for-sale-only* (and land-first). (P2.)

## Consent capture — inconsistent (compliance overlap)

| Form | Consent line | Collects |
|---|---|---|
| contact | "By submitting, you agree to be contacted by Home Placer about your inquiry." (`contact-form.tsx:112`) | name, phone, email |
| want-this-house | same line (`want-this-house-form.tsx:112`) | name, phone, land notes |
| financing | *no "agree to be contacted"*; "No credit pull… We'll call…" (`financing-form.tsx:110`) | name, phone, email |
| service-request | *no consent line found* | name, phone, address |
| email-capture | "No spam — unsubscribe anytime." (`email-capture.tsx:37`) | email |

- **Inconsistent + no privacy-policy link** (no `/privacy` route exists). For phone
  contact, TCPA-style **express consent to call/text** is the safer standard, ideally the
  same sentence on every form with a link to a privacy policy. Detailed in
  `compliance-review-flags.md`. **P1 (compliance) to standardize.**

## Quick wins (build-ready, pending approval)

1. **Add click-to-text** (`sms:` CTA) next to click-to-call — *if the sales line is
   SMS-capable* (NEEDS JOE to confirm). Manufactured-home buyers skew text-first. (P2)
2. **Standardize consent** copy across all 5 forms + link a privacy policy. (P1)
3. **Add a honeypot field + light rate-limit** to `/api/lead`. (P1)
4. **Add `if(status!=="idle")return`** double-submit guard to all 5 forms. (P2)
5. **Wire an alert** to `CRITICAL LEAD_NOT_DELIVERED` before traffic. (P0 ops)
6. **Build a `seller`/`landowner` intake** with its own type/tag/routing (later). (P2)
