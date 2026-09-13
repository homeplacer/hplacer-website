# Blueprint implementation — September 13, 2026

## Implemented source changes

- Explicit source robots: public AI search/user retrieval allowed, training disallowed, per-agent API/private-path exclusions. Retains Cloudflare-managed training policy rather than using a broad WAF bypass.
- Governed package data and build validator. Ten source-backed town-only historical summaries across available archive towns, with no current price/offer/media/availability invented. May active-listing export intentionally excluded as stale. Request-time seven-day expiry for future active/under-contract records; draft/withdrawn/stale records disappear from lookup/listing/sitemap. Staff approval, source, history, scope, and price/media gates are required. Unknown detail routes 404.
- Package index with town/status/model filters, detail pages, model-card/detail links, server-validated inquiry IDs, and conditional Product/Offer markup. Historical records emit WebPage markup without Offer. Current asking prices are not seeded.
- Six source-linked land-readiness planning checklists. Official-source check date is shown; no named employee/professional review is fabricated. Full staff/regulatory review remains pending in source and operating templates.
- Expanded existing sold-project pages with factual record context and explicit unknown scope/duration/constraints. Project index by town. No new customer name, street address, price, image, or testimonial was added to these new summaries.
- Location evidence file: five archive-backed towns retain indexability. Other service-area pages remain navigable, marked noindex and omitted from sitemap. No claim that their service coverage is false; the reason is insufficient project evidence for expanded indexable location content.
- Business identity file supplies existing public name/contact/address/profile data. It explicitly keeps verified opening hours/licenses empty and buyer-facing office verification false. Unsupported structured starting-price/slogan claims removed; no aggregateRating added.
- Land-package overview now requests an itemized, parcel-specific scope/current quote instead of universal inclusion/starting-price claims.
- Server UUID per submission attempt, actual submission page, and authoritative package/model/market/status included in existing CRM/email path. No lead/CRM IDs or personal data sent to GA4. Category-only package/guide events added.
- Lead safety: bounded 32 KB body read, invalid shape/type handling, and truthful 503 when both providers fail so the existing client mailto fallback runs. Confirmed conversion requires a successful provider response. Contact fallback heading asks the visitor to finish sending.
- Internal operator handbook plus package/content approval, citation, compliance and funnel templates. No profile edits, review solicitation, external accounts/terms, new vendors, or customer exports.

## Validation before deploy

Build, TypeScript, ESLint and 12 tests passed. Static audit checked 263 pages and parsed 693 JSON-LD blocks; no metadata/canonical/Open Graph mismatch, duplicate title, or broken internal navigation. Local dynamic checks verified ten package pages, empty available filter, model links, private field exclusion, no historical Product/Offer, hidden package IDs, canonical, sitemap exclusion/inclusion, location noindex, robots and unknown-package 404. All lead-provider calls in tests were mocked.

Package pages and sitemap are dynamic intentionally to enforce expiry at request time. Static marketing pages retain the existing cache strategy. Data model tests cover the seven-day boundary and status distinctions. Existing responsive catalog images/lazy loading remain; no new heavy client inventory bundle.

## External verification limits

- The CUA tool reports the Mac locked. Browser visual QA and dashboard inspection are unavailable until unlock.
- Wrangler account verified as Home Placer; worker deployment access works. Bot Management and WAF ruleset reads for zone `835af35062a623fd3ac738652006af82` return 403 with the existing OAuth credential. No policy mutation or privilege expansion attempted.
- Live pre-deploy managed robots lists training/mixed-purpose blocks, but no dedicated OAI/ChatGPT/Claude search/user or Perplexity retrieval block. Source policy reconciles the intended distinction; underlying WAF/AI Crawl Control and 30-day metrics still require dashboard access.
- PageSpeed's unauthenticated API returned 429 (quota exhausted). No CWV/CrUX or external rich-result test success is claimed.
- Installed Wrangler 4.127.1 `wrangler check` prints subcommand help, not a configuration-validation result. The built Worker dry run is the substantive deploy validation.

## Exact remaining dependencies

Cloudflare dashboard unlock/access for WAF/crawler policy verification and metrics; real staff-owned current package records; itemized scope/current prices and media permissions; actual staff guide reviewers and project constraints/duration/permission records; exact licenses and verified buyer-facing hours/address; lender/finance and privacy/SMS approval against actual workflows; verified GBP/citation/manufacturer accounts and specific permitted edits; CRM outcome/reporting access and privacy-controlled store/export approval; PageSpeed/CrUX access or quota; authenticated browser visual/external schema QA. Warranty wording is unchanged. No arbitrary inventory, staff identity, consent, price, license, lender offer, or review was fabricated.

See `docs/operations/public-site-operations.md` for the executable workflow and templates.
