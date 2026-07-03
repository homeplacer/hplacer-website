# Home Placer — Platform Roadmap

*Owned by Builder-Claude (HP CTO / Lead Engineer). Companion docs: `DECISIONS.md`
(why), `TODO.md` (actionable now), `CHANGELOG.md` (what shipped), `HANDOFF.md`
(session-to-session), `docs/handoff/` (deep engineering reference). As of 2026-07-02.*

## Mission

Become the premier manufactured-home + land-home platform — streamlining the whole
customer journey from discovering a home or lot through financing, permitting,
construction, delivery, setup, warranty, and the long-term relationship. Software
employees enjoy, customers trust, and the business scales on.

## Locked decisions (2026-07-02 — Joe)

- **Scope: single-tenant Home Placer (SC) platform** — build the best tooling for
  *this* dealership (Horry/Georgetown SC + nearby NC). Not a multi-dealer SaaS yet.
  Keep the data model/auth clean, but do **not** pay the multi-tenancy tax now.
  (`DECISIONS.md` D-HP-001.)
- **Launch-readiness first, then reassess** — finish and harden the current
  marketing/lead site to launch quality, get pricing + marketing live, and decide
  the larger platform build from real traffic/conversion data. (D-HP-002.)
- **Sister to Forturro, not coupled** — reuse Forturro's *engineering patterns*
  (D1 data layer, CF Workers deploy, auth model, workflow/notification/AI patterns,
  UI conventions) as templates; keep HP's data + CRM boundary its own (Forturro
  D-021). Each platform evolves independently. (D-HP-003.)
- **Build for who we're becoming** — API-first, database-first, modular, auth-
  foundational; the website is one client of the platform, not the platform. Phase,
  but never in a way that requires a rewrite later. (D-HP-004 — see below.)

## Target architecture — build for who we're becoming (D-HP-004)

HP is not a website; it is the **operating system for a manufactured-housing
company** — marketing → lead → CRM → package → financing → construction →
permitting → delivery → install → warranty → long-term ownership. We build in
phases and only ship what delivers value today, but **every decision must expand
into that platform without a rewrite.** No temporary solutions we'll have to replace.

**Non-negotiable patterns (apply to every dynamic feature from here on):**
- **API-first.** `UI → API → business logic → database`. The UI never owns business
  logic. The website, customer/employee/dealer portals, mobile apps, and AI
  assistants are all just *clients* of the same Home Placer APIs.
- **Database-first.** The DB (Cloudflare D1) is the system of record — homes, land,
  lots, communities, customers, leads, quotes, packages, appointments, tasks,
  construction jobs, warranty/service tickets, documents, employees, permissions,
  AI conversations, notifications, audit logs. No feature assumes static JSON forever.
- **Modular / service-oriented.** Independent modules with clear interfaces: Auth,
  Inventory, Land, Customers, CRM, Construction, Warranty, Scheduling, Financing,
  Documents, Reporting, Marketing, AI, Notifications, Search. Not one monolith.
- **Auth is foundational, not a later feature.** It unlocks the employee dashboard,
  customer portal, saved homes/quotes, documents, messaging, roles, and audit history
  — so it moves to the front of the platform build (Phase 1).
- **Reusable components + shared patterns** (Forturro reuse — see `DECISIONS.md`).

Before any feature: *does it reduce employee work? eliminate a manual process? can
AI automate it? scale nationally? be reused by another module? will we regret this
architecture in three years?* If a materially better approach exists, propose it first.

## Current state (honest)

A strong **marketing + lead-capture site**: Next 16 + OpenNext on Cloudflare
Workers, live at hplacer.com. 93 model pages, 73 placed homes, 27 locations, blog
automation, SEO infra, and a hardened `/api/lead → Follow Up Boss` pipeline.
Inventory is **static JSON** (edited by redeploy). **No** database, auth, portals,
package builder, financing calculator, quote generation, scheduling, or ops backend.

Today HP is a brochure with excellent lead forms. The roadmap below is the path to
a platform.

## Phased roadmap

### Phase 0 — Launch-ready (NOW)
Harden what exists to "no surprises" launch quality; unblock marketing spend.
SEO/schema, forms/lead-pipeline correctness, mobile, performance, security, broken
links, analytics. Tracked as a punch list in `TODO.md`. **No new backend.**
*Exit:* production-readiness audit green; pricing + marketing live.

### Phase 1 — Platform foundation (the pivotal move)
Stand up the spine every later module consumes, built API-first from day one:
- **Database** (Cloudflare D1) as the system of record; start with the **Inventory**
  + **Land** modules (homes, land, build-ready lots, communities, display/placed/sold
  homes, model availability, pricing history) — migrate off static JSON.
- **Auth + roles** as foundational infrastructure (employee vs customer vs — later —
  dealer; RBAC + audit log). Reuse Forturro's auth pattern; own the instance/boundary.
- A versioned **`/api/*` service layer** over that data (business logic behind the
  API, not in pages) + an **admin UI** so inventory is edited without deploys.
*Everything downstream (portals, package builder, quotes, scheduling) consumes this.*

### Phase 2 — Sales tools (highest conversion ROI, all API/DB-backed)
The **Package Builder as a core product**, not a calculator — guiding a buyer through
land → utilities/flood/septic/foundation → home → floorplan → upgrades → site work →
delivery → install → closing/taxes/insurance → **monthly payment → proposal →
schedule → save → send to sales**. Plus the financing **estimator** (FHA/VA/USDA —
education, not advice), quote/proposal generation, appointment scheduling, comparison.

### Phase 3 — Ops & CRM depth
Lead routing/workflow (reuse Forturro workflow patterns; own CRM boundary), employee
portal (pipeline, quotes, tasks), vendor/manufacturer management, reporting/analytics.

### Phase 4 — Customer lifecycle
Customer portal + construction/permitting/utilities/septic/survey/delivery/install
tracking, warranty/service tickets, documents, referral + future dealer portal, mobile.

### Cross-cutting (continuous)
- **AI** only where it earns its keep, trending toward **specialized assistants** with
  narrow responsibilities (sales, construction, estimating, permitting, warranty,
  inventory, marketing, support, finance, ops) rather than one general chatbot — each
  a client of the same APIs. Start small (lead qualification, recommendations,
  financing/permit education, internal drafting). No AI theater.
- **Marketing:** SEO, Google Business Profile, local search, Ads/LSA, reviews, content.
- **External AI advisory:** ChatGPT (architecture/UX/strategy critique), Gemini
  (Google-ecosystem + permitting research, joe@forturro.com). Research/critique only
  — never send customer data or secrets to external services.

## Success metric

> "If someone wanted to buy a manufactured home with land anywhere in the country,
> would Home Placer provide the best experience available?"

Not yet. The gap = Phases 1–4. We close it in ROI order, shipping reusable
increments and auditing each before the next.
