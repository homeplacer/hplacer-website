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

### Phase 1 — Foundation (the pivotal move)
Introduce a **Cloudflare D1 data layer** + lightweight **admin/auth** so inventory
(homes, **land**, build-ready lots, placed homes) is managed without redeploys.
Land + lots become first-class data. Mirrors Forturro's D1 pattern; own boundary.
*Enables everything downstream.* Gated on Phase 0 + a real signal that manual JSON
management is a bottleneck.

### Phase 2 — Sales tools (highest conversion ROI)
Package builder (home + lot + options → configured package), payment/financing
**estimator** (FHA/VA/USDA — education, not advice), quote generation, appointment
scheduling, home/land comparison.

### Phase 3 — Ops & CRM depth
Lead routing/workflow (reuse Forturro workflow patterns; own CRM boundary),
employee portal (pipeline, quotes, tasks), reporting/analytics.

### Phase 4 — Customer lifecycle
Customer portal (financing → permitting → construction → delivery → setup →
warranty), construction progress tracking, warranty/service, referral partners.

### Cross-cutting (continuous)
- **AI** only where it earns its keep: lead qualification, home/land recommendations,
  financing/permit education, internal drafting. No AI theater.
- **Marketing:** SEO, Google Business Profile, local search, Ads/LSA, reviews, content.
- **External AI advisory:** ChatGPT (architecture/UX/strategy critique), Gemini
  (Google-ecosystem + permitting research, joe@forturro.com). Research/critique only
  — never send customer data or secrets to external services.

## Success metric

> "If someone wanted to buy a manufactured home with land anywhere in the country,
> would Home Placer provide the best experience available?"

Not yet. The gap = Phases 1–4. We close it in ROI order, shipping reusable
increments and auditing each before the next.
