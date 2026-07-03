# Home Placer — Changelog

*What shipped, newest first. Companion: `ROADMAP.md`, `DECISIONS.md`, `TODO.md`.*

## 2026-07-03 — Phase 0 launch-readiness (Builder-Claude, CTO)

Hardened the marketing/lead site to launch quality behind a production build + a
three-way audit (SEO/routing · leads/CRM · mobile/perf/security). Governance:
`ROADMAP.md`, `DECISIONS.md` (D-HP-001…005), `TODO.md`.

- **Conversion** — homepage inline "Get your price" lead capture (#4); land-packages
  rebuilt into a conversion page with cost transparency, real photos, FAQs, inline
  form (#5); inventory "Call for pricing" → "Get this home's price" lead moments,
  price sort/filter hidden while unpriced (#6).
- **Lead pipeline** — FUB delivery resilience: retry + warranty-id validation +
  `LEAD_NOT_DELIVERED` safety marker (#1); no silent lead loss on validation reject
  (all 5 forms show a retryable error) + parallelized warranty routing (#9); pricing
  loader hardened against malformed input (#2).
- **Security** — response headers (CSP report-only + HSTS/frame/nosniff/referrer),
  blog-markdown XSS sanitization, `/api/lead` payload/field caps + email escaping,
  Leaflet popup escaping (#8).
- **SEO** — canonicals on 14 pages, `BlogPosting` + `BreadcrumbList` schema, logo fix,
  removed the stale GitHub-Pages export path that dropped security middleware (#10).
- **Robustness** — styled 404 + global error boundary, mobile table scroll (#11).
- **Repo** — promoted the real production branch to `main`; recorded the Builder-Claude
  charter + platform-request for a Forturro read-only land API (open, D-021).

Result: production build green; security/lead/SEO/robustness audit items closed.
Remaining before traffic = ops gates (Worker secrets, `LEAD_NOT_DELIVERED` alert,
promote CSP to enforcing) + Joe's items (pricing, domain, listings). See TODO.md.
