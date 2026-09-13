# Public-site operating handbook

Prepared September 13, 2026. This is an internal workflow, not public legal wording. Record actual owners and approvals; unfilled fields are not approvals.

## Package ownership and publication

Use `data/land-home-packages.json`. Run `npm run validate:public` before review and deployment. The first ten records are historical, town-only summaries sourced from the existing sold-project archive; no current asking price, customer consent, staff verification, or current availability is implied. The May 18 `mls-listings-active.json` export is stale and must not seed current offers.

1. Assign an actual employee in `owner` and retain the source record in the private operating system. Do not put private documents, customer identities, exact addresses, or credentials into this repository.
2. Create a draft using `package-record.template.json`. Obtain verified model identity, town/county, status, scope, inclusions, exclusions/allowances, and an explicit price policy.
3. For an active record, set `publication: approved` only after staff verification. Set `lastVerifiedBy` to the actual verifier and `lastVerifiedAt` to the actual check time. A source import timestamp is not a fresh availability check.
4. A total asking price requires `pricePolicy: verified-total`, a positive `packagePrice`, and an explicit price disclosure. No price means `not-published` with a null value. Do not use zero or historical sale price as a current offer.
5. Record photos only after permission is documented. Publish approved, stripped copies under `/public/packages/`, with no embedded GPS/customer metadata. Never publish the permission document itself. Keep town-only address policy; any future finer location policy needs deliberate review and implementation.
6. Append a status-history entry for every change with actual timestamp and reason. Normal progression is available → under_contract → sold. Cancellation can return to available only after re-verification. Withdrawn/draft/expired records leave the directory, sitemap, and public detail lookup. Restore only with new evidence; do not redirect to an unrelated home.
7. Check availability at least twice weekly. Available/under-contract records expire after seven days at request time. Pages and sitemap are intentionally dynamic, so a missed deployment cannot keep an expired offer visible. Keep static marketing pages cached.
8. Review a local preview, data validation, tests, build, typecheck, lint, and Worker dry run before deployment. Record commit and Worker version afterward. The approved package ID travels with its model, town, status, submission page, and server lead reference into the existing CRM message.

## Content and project evidence

The six published guides are source-linked planning checklists, not professional parcel determinations. Their `staffReviewer` remains null until a real employee reviews them. No staff approval or legal review is claimed in public schema. Before expanding into prescriptive regulatory guidance, fill the real reviewer, review date, claim/source mapping, and an approval decision.

For each proposed factual assertion, complete `content-review.template.json`. Link each regulatory claim to the current responsible agency, preserving uncertainty about city/county jurisdiction, fees, utility approvals, and parcel-specific conditions. Do not copy obsolete agency names/fees from old PDFs into sales promises. Check official links quarterly and when a county announces changes.

The project evidence sections describe only fields already present in the sold-home archive. Site constraints, itemized scope, durations, and customer quotes remain unknown unless documented. A new case study requires actual project notes plus explicit customer/media permission. Existing public photos/addresses are not proof of written permission; audit them before reuse in new campaigns. Locations with existing project evidence remain indexable; other service-area pages remain navigable but noindex and omitted from the sitemap until meaningful evidence is supplied.

## Review workflow (operator template; no messages sent)

System of record: approved CRM/portal only. Suggested fields: project_id, assigned_owner, closed_at, service_resolution_at, review_eligible_at, review_requested_at, review_channel, review_completed_at, response_owner, response_due_at, permission_reference, consent_scope, audit_actor, audit_at.

Use one neutral eligibility policy for customers, without selecting by predicted rating. An unresolved service matter can defer outreach under the same service policy for everyone; do not suppress negative reviewers or condition service on a review. Ask once at the approved milestone and record the date/channel. Do not offer incentives, write a review for a customer, post as the customer, or gate the Google link behind a satisfaction score.

Draft for human approval: “Thank you for choosing Home Placer. If you would like to share your experience, you can leave an honest review on our Google profile: [verified review link]. Your feedback is welcome.” Do not send until the exact destination, channel, recipients, and applicable consent are approved. The existing Maps CID is a profile link, not a verified direct review-writing link.

Assign an actual response owner; review new feedback each business day and target a response within two business days. Avoid customer property, contract, financing, health, or service details in public responses. Move specific troubleshooting to an approved private channel. Obtain separate permission to republish a quote/photo; link to the original review and do not add self-serving aggregateRating schema.

## Entity, GBP and citation cleanup

`data/business-identity.json` preserves existing public identity facts. It does not freshly certify a buyer-facing office, opening hours, license, or manufacturer relationship. Before profile edits, owner must confirm exact legal/public name, sales phone, public address policy, appointment hours, service area, license credentials with official verification URL, and authorized profiles.

Use `citation-audit.csv`: read each live profile, record differences and evidence, identify verified account owner, prepare exact before/after edits, then obtain required account action. Prioritize Google Business Profile, Bing Places, Apple Business Connect, Instagram/Facebook, manufacturer dealer locators, and genuine local associations. Use only supported categories. Do not create listings for nonexistent offices, change addresses to target cities, buy links, or publish edits from an unverified account. No account creation, terms acceptance, profile edit, review solicitation, or customer upload is authorized by this checklist itself.

## Finance, legal, privacy and SMS publication requirements

Complete `approval-register.csv` with the person authorized to approve each claim and the actual evidence. Keep public copy and workflow consistent.

- Financing: actual lender/product relationships, permitted referral wording, home/land classification facts, qualification restrictions, and written disclosure requirements. Rates, payments, down payments, eligibility and approval claims need current provider-approved evidence. Do not assume FHA/VA/USDA availability from a generic government program page.
- Licensing: current entity name, exact license number, state, classification, expiration/status, and official verifier. NC and SC are separate checks. Do not infer a license from service-area marketing.
- Privacy: inventory form fields, first-touch attribution, logs, CRM/email vendors, access, retention/deletion, failure/recovery behavior, cookies/analytics, and the contact for requests. Counsel/owner must approve wording against actual practice.
- SMS: identify the sending vendor, purpose, audiences, consent collection and evidence, opt-out handling, required disclosures, and operational responsibility before any automation. No inferred consent from a phone field; no invented legal terms. Call recording has its own approval and workflow requirements.
- Warranty: preserve exactly the approved distinction: Home Placer provides a one-year builder warranty for defects. The separate 2–10 Home Buyers Warranty provides two years of mechanical coverage and ten years of structural coverage through the 2–10 company. Do not expand transferability, exclusions, claims procedures, or coverage without the actual approved documents.

## Funnel measurement and lead operations

The public API generates a UUID per accepted submission attempt and includes it in the FUB timeline and email. It is not a customer ID, a CRM person ID, or an idempotency guarantee. Preserve it when recording outcomes. Each accepted lead also receives an `Acquisition channel` in the FUB timeline/email: `paid_search`, `paid_social`, `email`, `organic_search`, `organic_social`, `referral`, `direct`, or `campaign_other`. This is derived from first-touch click/UTM signals only and is the reporting bucket; it is not a claim about a CRM-native source field. Package context is looked up server-side; arbitrary submitted model/package/market claims are not trusted. GA4 gets only allowlisted categorical events, never this UUID, CRM IDs, names, contact details, raw URLs, free text, or sensitive application data.

The server returns 503 when neither delivery channel confirms capture. The client then offers its existing mailto fallback; that is not a confirmed conversion. The logged failure record remains the recovery path. A durable outbox and long-term retention policy are separate operating decisions.

Use `funnel-outcomes.template.csv` in an access-controlled CRM/reporting store, never a public directory or this repo with live data. Taxonomy: qualified, appointment, land_review, finance_conversation, contract, closed, lost, cancelled. Outcomes require actual evidence; page visits and form starts do not establish them. Lost reasons: no_response, timing, location, budget, product_fit, financing_not_proceeding, other; avoid sensitive explanations in marketing reports.

Monthly reconciliation: filter FUB timeline events with `Website lead reference:`, copy that exact UUID into `lead_reference`, and record the FUB person reference only in the access-controlled outcome store. Copy the event's `Acquisition channel`, type, server-validated package/model/market, and submission-page category; do not infer them from a later page visit. One merged CRM person can have several website lead references, so report both distinct references and distinct CRM people. Update the same row as the lead progresses; do not add a second row for an appointment or closing. The evidence reference must point to the approved CRM record or transaction record, not private notes in this repository.

Monthly report: aggregate by source/channel and landing-page category, with counts through qualified → appointment → contract → closed. Report attribution coverage and unknowns alongside conversion rates. Count distinct lead references consistently and reconcile retries/merged CRM people. Do not claim closed-sale attribution until actual outcome records are connected. No new export/webhook/vendor is enabled by this release.

## Crawler and technical review

Policy: public search and assistant retrieval allowed; model training disallowed. Source robots includes separate retrieval groups and private/API exclusions; it is not authentication. Keep portal host authentication, API validation, rate limits and WAF protections intact.

Cloudflare administrator: inspect AI Crawl Control → Crawlers/Directives and Security → rules for zone hplacer.com. Export current settings and 30-day metrics first. Permit verified search/user crawlers, retain training blocks, and remove only a conflicting crawler restriction on public marketing paths. Never use an all-WAF skip based on a spoofable user-agent string. Limit any exception to public host/path and verified identity. Confirm origin and edge robots agree, including Content-Signal values. Google-Extended combines reuse purposes; retain its disallow to honor no training, while ordinary Googlebot search remains allowed.

Monthly: review crawler errors/blocks, Search Console index coverage, GA4 event quality, real-user CWV/CrUX if available, and CRM outcomes. No metric available means unknown, not zero. Use PageSpeed mobile/desktop and a real browser to identify actual LCP/CLS/INP issues before changing imagery or adding tracking vendors. Existing responsive model images and lazy loading are preserved; the new directory has no large client catalog payload.
