# Home Placer — TODO

*Actionable list. Strategy: `ROADMAP.md`. Decisions: `DECISIONS.md`. Legend:
☐ open · ✅ done · 🔧 code (Builder) · 🛠️ ops/deploy (Joe/DevOps). As of 2026-07-03.*

## Phase 0 — Launch readiness

### ✅ Done (shipped to `main`)
- ✅ Build baseline green — 211+ routes prerender, sitemap/robots complete, no broken
  internal links, no secrets committed.
- ✅ **Security headers** — X-Frame-Options/nosniff/Referrer-Policy/Permissions +
  HSTS enforced; CSP shipped **Report-Only** (prod). (#8)
- ✅ **Blog markdown XSS** sanitized (workerd-safe strip + CSP backstop). (#8)
- ✅ **`/api/lead`** payload cap (413) + field-length caps + email HTML-escape. (#8)
- ✅ **Leaflet popup** escaping + `rel="noreferrer"`. (#8)
- ✅ **No silent lead loss** — `submitLead` 4xx → inline error banner (all 5 forms),
  not a silent mailto. (#9)
- ✅ **Warranty routing** — `!personId` logged; owner+collaborator validation
  parallelized. (#9)
- ✅ **Canonicals** on 14 pages; **blog schema** (BlogPosting + BreadcrumbList + OG);
  schema `logo` fixed; JSON-LD `<` escaped. (#10)
- ✅ **Removed the stale GitHub-Pages export footgun** (`deploy-pages.sh` +
  `PAGES_BUILD`) that dropped the HTTPS/security middleware. (#10)
- ✅ **Styled 404** + **global error boundary**; **mobile table scroll** on the 4
  comparison pages. (#11)

### ☐ Remaining code (P2 polish — non-blocking)
- ☐ 🔧 Double-submit guard (`if (status!=="idle") return`) on all 5 forms.
- ☐ 🔧 Mobile nav tap target → true 44px (`size-11`).
- ☐ 🔧 Sitemap `lastModified` derive from content (currently hardcoded).
- ☐ 🔧 Index-page schema (`ItemList`/`CollectionPage` on `/homes`).

### ☐ Bigger items (schedule; some pair with Phase 1)
- ☐ 🔧 **Mirror manufacturer photos to R2/`public`** at build time — 611+ hotlinked
  CDN URLs are a site-wide reliability + CSP-allowlist risk.
- ☐ 🔧 **Self-host Leaflet** (npm-bundle) instead of the unpkg runtime script.
- ☐ Watch the 10MB gzip Worker cap as blog/models JSON grows.

### ☐ Ops / deploy gates (Joe / DevOps — before flipping traffic)
- ☐ 🛠️ **Set the prod Worker secrets** (`FUB_API_KEY`, optional `RESEND_API_KEY`) —
  code self-arms, but blank secrets trip `LEAD_NOT_DELIVERED` on every lead.
- ☐ 🛠️ **Wire an alert to `CRITICAL LEAD_NOT_DELIVERED`** (Logpush/Tail, or a durable
  KV/Queue outbox) — the last-resort safety net is otherwise an unwatched log line.
- ☐ 🛠️ **Promote CSP from Report-Only → enforcing** after reviewing violation reports.
- ☐ 🛠️ Verify a FUB Lead Flow automation exists for the `subscribe` tag.

### ☐ Blocked on Joe (external)
- ☐ Pricing numbers (`setup-pricing.json` / `home-pricing.json`) · domain transfer +
  HSTS · Bing PIN · Apple Business Connect · replace hotlinked photos with owned.

## Phase 1 — Platform foundation (next; see ROADMAP + D-HP-004/005)
- ☐ Design the **database** (D1) system-of-record schema — every major object with
  audit history, permissions, notes, attachments/documents, workflow status, AI
  interaction history, reporting hooks (D-HP-005).
- ☐ **Auth + RBAC** foundation (employees + customers + future vendors/contractors +
  admins; unified, roles from day one).
- ☐ Versioned **`/api/v1/*`** service layer (business logic behind the API).
- ☐ **Admin UI** — edit inventory (homes, land, lots) without deploys.
- ☐ Document APIs + data models as they land (`docs/`).
