# Backend / Admin Opportunities

*What internal systems Home Placer should eventually have — evaluated, not built.
Grounded in the current system (no DB/auth/admin; FUB is the CRM; static-JSON-by-redeploy)
and the locked roadmap (`ROADMAP.md`, `DECISIONS.md` D-HP-001…005). 2026-07-09.*

## The one framing that governs everything here

Two decisions Joe already locked shape every recommendation below:

1. **D-HP-002 — launch-readiness *before* platform build.** Finish Phase 0, get pricing +
   marketing live, and let **real traffic/conversion data** decide the backend scope. So the
   honest answer for most items below is **"useful later — trigger = validated demand,"** not "now."
2. **The CRM already exists — it's Follow Up Boss.** Leads, pipeline, tasks, notes, activity log,
   collaborators, and follow-up automations live in FUB today (`/api/lead` feeds it well).
   **Do not rebuild the CRM in-app.** Build in-house backend only for what FUB *can't* do
   (inventory, packages/quotes, construction/permit/delivery tracking, customer portal, reporting
   that spans FUB + inventory + ads).

Everything is also bound by the platform charter (`CLAUDE.md` / D-021): keep HP's data/CRM
boundary its own; reuse Forturro *patterns*, not internals.

## Scorecard

Legend — **Urgent** (do at/around launch) · **Useful later** (real value, gated behind Phase 1
or validated demand) · **Parking lot** (premature/duplicative now) · **Do not build** (would
duplicate FUB or is a distraction).

| System | Verdict | Business value | Complexity / risk | Depends on |
|---|---|---|---|---|
| **Missed-lead alerting** (wire `CRITICAL LEAD_NOT_DELIVERED` → email/Slack; durable KV/Queue outbox) | **Urgent** | Prevents silent lead loss — the one gap between "resilient" and "safe" | Low (Logpush/Tail or a Worker Queue binding) | Cloudflare access |
| **Admin UI to edit inventory + pricing without deploy** | **Useful later (Phase 1, highest backend ROI)** | Kills the redeploy bottleneck; lets pricing go live + stay fresh; non-engineers manage content | Medium (needs D1 + auth + API first) | D1, Auth, API |
| **Database (D1) as system of record** | Useful later (Phase 1 spine) | Everything downstream consumes it | Medium–High | — (foundation) |
| **Unified Auth + RBAC** (employees/customers/vendors) | Useful later (Phase 1, foundational) | Unlocks admin, portals, saved quotes, documents, audit | Medium | D1 |
| **Versioned `/api/v1/*` service layer** | Useful later (Phase 1) | Business logic behind API; site becomes one client | Medium | D1, Auth |
| **Home-model / land / lot / package inventory managers** | Useful later (Phase 1 admin) | Real availability, no "call for" gating, price history | Medium | D1, Admin |
| **Package Builder** (land→utilities→septic→foundation→home→upgrades→delivery→payment→proposal) | Useful later (**Phase 2 flagship**) | Highest conversion ROI; the core product per D-HP-005 | **High** | Phase 1 complete |
| **Financing estimator** (FHA/VA/USDA — education, not advice) | Useful later (Phase 2) | Answers the #1 buyer question before they call; qualifies leads | Medium (+ **compliance review** — see C-3/C-8) | API; legal review |
| **Quote / proposal generation** | Useful later (Phase 2) | Speeds sales; professional artifact | Medium | Package builder |
| **Lender / preapproval tracker** | Useful later (Phase 3) | Visibility into financing stage; fewer stalls | Medium | D1, CRM link |
| **Permit / septic-well-utility / order / delivery-setup / inspection-CO / closing trackers** | Useful later (Phase 3–4) | **Where a land-home dealer actually bleeds time** — coordination across county, installer, lender, surveyor | High (multi-party workflow) | D1, Auth, API |
| **Document checklist + storage** | Useful later (Phase 4) | Fewer dropped docs at closing; customer + staff share one list | Medium | D1, Auth |
| **Internal task system / staff assignment / notes / activity log** | **Do not build (use FUB)** | FUB already does this | — | — |
| **Lead dashboard / customer pipeline / buyer status tracker** | **Do not build now (use FUB)** | Duplicates FUB pipeline; build only the *inventory/construction* views FUB lacks | — | — |
| **Customer portal** (saved homes/quotes, docs, messaging, build status) | Useful later (Phase 4) | Trust + fewer status calls; differentiator | High | Auth, D1, trackers |
| **Owner / seller / landowner intake** | **Useful sooner — light** | Captures the stated future lead type; it's a *form + FUB tag*, not heavy backend | **Low** (a page + form + distinct FUB routing) | **NEEDS JOE: define the offer** |
| **CRM sync depth** (FUB webhooks back, dedupe, offline-conversion export to Ads/Meta) | Useful later | Lets ad platforms optimize on *closed deals*, not just form-fills | Medium | Ad accounts, FUB API |
| **Reporting dashboard** (leads × source × stage × inventory) | Parking lot | GA4 + FUB reports cover it until volume justifies custom | Medium | Data volume |
| **Advertising / source-attribution dashboard** | Parking lot | First-touch already flows to FUB; custom dashboard premature pre-spend | Medium | Ad spend + data |
| **SMS / email follow-up automation** | Parking lot — **needs approval + compliance** | Real value, but Joe's standing rule = explicit approval; TCPA/consent gate (C-2) | Medium | Consent framework, Joe |
| **Review-request workflow** | Parking lot — **needs approval** | Grows the thin GBP review count (the real local-SEO lever) | Low–Medium | Joe, GBP |

## Recommended sequencing (honest)

1. **Around launch (ops, not a platform):** missed-lead alerting; set secrets; verify FUB
   automations exist for every source/tag. Add the **landowner intake** once Joe defines the offer —
   it's cheap and serves a stated goal.
2. **Phase 1 (only once traffic/conversion data justifies it):** D1 → Auth/RBAC → `/api/v1` →
   **Admin UI for inventory + pricing**. This is the keystone: it ends the redeploy bottleneck and is
   the prerequisite for everything else.
3. **Phase 2:** Package Builder + financing estimator + quotes (highest conversion ROI; the flagship).
4. **Phase 3–4:** construction/permit/delivery/closing trackers + document checklist + customer portal
   — the operational depth that actually saves staff time in this business.

## What NOT to build (and why)

- **A second CRM / lead dashboard / task system in-app** — FUB already does leads, pipeline, tasks,
  notes, activity, collaborators. Rebuilding it is the classic time-sink. Integrate; don't replace.
- **A custom analytics/attribution dashboard before ad spend** — GA4 + FUB suffice until there's
  volume; the higher-value move is the **offline-conversion loop back to Ads**, not a dashboard.
- **Any customer-facing SMS/email automation without explicit approval + a consent framework**
  (Joe's standing rule + compliance C-2).
- **Multi-tenant / multi-dealer SaaS architecture** — explicitly out of scope (D-HP-001). Keep the
  data model clean enough to add later; don't pay the tax now.
