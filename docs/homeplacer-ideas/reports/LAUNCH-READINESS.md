# 🚀 Home Placer — Launch-Readiness Report

*Prepared by Builder-Claude (HP CTO / Lead Engineer). As of 2026-07-03.
Companions: `ROADMAP.md`, `DECISIONS.md` (D-HP-001…005), `TODO.md`, `CHANGELOG.md`.*

---

## Summary

Phase 0 (launch readiness) is **complete**. The site moved from "brochure with lead
forms" to **launch quality** behind a green production build + a three-way audit
(SEO/routing · leads/CRM · mobile/perf/security). **11 PRs merged** this cycle across
conversion, lead-pipeline, security, SEO, and robustness.

**The code is launch-ready.** What remains before flipping traffic is **operational
configuration** — secrets, monitoring, pricing, domain — not engineering.

---

## Readiness by dimension

| Area | Status | Notes |
|---|---|---|
| **Build** | ✅ Green | 240 routes prerender (93 homes, 73 placed, 27 locations, 16 blog + static); **no broken internal links** |
| **Lead pipeline** | ✅ Hardened | Retry + backoff; warranty-id validation; **no silent lead loss** (validation reject → inline error, not a dead mailto); `CRITICAL LEAD_NOT_DELIVERED` safety marker; first-touch attribution on every form |
| **Security** | ✅ Closed | Response headers (CSP Report-Only + HSTS/X-Frame-Options/nosniff/Referrer/Permissions); blog-markdown XSS sanitized; `/api/lead` payload (413) + field caps + email/output escaping; **no secrets committed** |
| **SEO** | ✅ Strong | Canonicals on 14 pages; full sitemap/robots; LocalBusiness / Product / FAQ / BlogPosting / BreadcrumbList schema; schema logo fixed |
| **Mobile / robustness** | ✅ Fixed | Styled 404 + global error boundary; comparison tables scroll on mobile; accessible mobile nav |
| **Analytics** | ✅ Live | GA4 (`G-0T71PWYQSQ`); `generate_lead` events on all forms; Google Search Console + Bing + IndexNow |
| **Conversion** | ✅ Upgraded | Money-first homepage capture; land-packages conversion page; per-home "Get this home's price" lead moments |

---

## ⛳ Remaining operational gates (before traffic)

### DevOps / production configuration
- 🛠️ **Set Worker secrets** — `FUB_API_KEY` (required); optional `RESEND_API_KEY`,
  `WARRANTY_LEADS_TO`, `FUB_WARRANTY_USER_ID` — via `wrangler secret put`. The code
  self-arms, but blank secrets trip the not-delivered marker on every lead.
- 🛠️ **Promote CSP** from `Content-Security-Policy-Report-Only` → enforcing after a few
  days of real-traffic violation reports (`src/middleware.ts`).
- 🛠️ **Domain** — finish the registrar → Cloudflare Registrar transfer, then enable
  **HSTS preload**.

### Monitoring (highest-priority ops item)
- 🛠️ **Wire an alert to `CRITICAL LEAD_NOT_DELIVERED`** — Cloudflare Logpush/Tail →
  email/Slack, or a durable KV/Queue outbox. This is the one gap between "resilient"
  and "safe": today the last-resort log line is unwatched.
- 🛠️ Basic **uptime + Worker error-rate** monitoring (Cloudflare analytics + alerts).

### Backups
- All content is **static JSON in git** today — versioned and recoverable by design;
  there is **no database yet**, so no DB backup is required.
- *Phase 1 introduces Cloudflare D1 → add a D1 export/backup routine at that point.*

### Owner (Joe) — external
- 💲 **Pricing** — fill `data/setup-pricing.json` / `data/home-pricing.json` (loader is
  hardened; templates ready). Lights up the dormant price sort/filter. **Biggest
  conversion unlock.**
- Bing Places PIN verify · Apple Business Connect · verify a FUB Lead Flow rule for the
  `subscribe` tag · replace hotlinked manufacturer photos with owned images.

---

## Deferred (non-blocking, scheduled)

- 🔧 **Mirror manufacturer photos to R2/`public`** at build — 611+ hotlinked CDN URLs
  are a site-wide reliability + CSP-allowlist risk.
- 🔧 **Self-host Leaflet** (npm-bundle) instead of the unpkg runtime script.
- 🔧 P2 polish — double-submit guards, mobile-nav 44px tap target, sitemap
  `lastModified` from content, `/homes` index schema.

*(Tracked in `TODO.md`.)*

---

## ▶️ Next: Phase 1 — platform foundation

Per the platform directive (D-HP-004/005), when Phase 0's ops gates are cleared we
begin the foundation, **API-first**, in this order:

1. **Database (Cloudflare D1)** — system of record. Schemas designed so every major
   object supports audit history, permissions, notes, attachments/documents, workflow
   status, AI-interaction history, and reporting from day one.
2. **Unified auth + RBAC** — one identity system for employees, customers, and future
   vendors/contractors/administrators; roles from day one.
3. **Versioned `/api/v1/*`** service layer — business logic behind the API; the
   website becomes one client of the platform.
4. **Admin UI** — edit inventory (homes, land, build-ready lots) without deploys.

Schema + API contracts will be designed and brought for review **before** feature code.

---

## Ledger — PRs shipped this cycle

| PR | Title |
|---|---|
| #1 | FUB lead delivery resilience (R6) + Builder-Claude charter |
| #2 | Pricing loader hardening |
| #4 | Homepage inline "Get your price" lead capture |
| #5 | Land-packages conversion page (cost transparency, photos, FAQs, form) |
| #6 | Inventory "Call for pricing" → lead-capture moment |
| #7 | CTO charter: ROADMAP + DECISIONS + TODO |
| #8 | Security hardening (headers, blog XSS, payload caps, escaping) |
| #9 | No silent lead loss + faster warranty routing |
| #10 | SEO batch (canonicals, blog schema, logo, remove Pages footgun) |
| #11 | Robustness (styled 404 + error boundary + mobile table scroll) |
| #12 | Docs: Phase 0 complete (D-HP-005, TODO, CHANGELOG) |
| #3 | *(open)* Platform request: read-only land API — for Spencer (D-021) |

**Verdict:** Phase 0 complete; the site is engineering-ready for launch pending the
operational gates above.
