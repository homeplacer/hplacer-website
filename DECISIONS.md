# Home Placer — Decision Record

*Architecture + business decisions for the Home Placer platform. Newest on top.
Append an entry for every major decision. Cross-references Forturro platform
decisions (`~/projects/forturro-idx/docs/DECISIONS.md`) where relevant — HP is a
sister platform, not a fork.*

---

## D-HP-004 — Build for who we're becoming: API-first, DB-first, modular (2026-07-03)
**Decision:** HP is architected as the **operating system for a manufactured-housing
company**, not a website. Every dynamic feature from here on follows:
- **API-first** — `UI → API → business logic → database`; business logic lives behind
  versioned `/api/*`, never in pages. The website, portals (employee/customer/future
  dealer), mobile apps, and AI assistants are all clients of the same APIs.
- **Database-first** — Cloudflare D1 is the system of record; nothing assumes static
  JSON forever. Everything becomes data (inventory, land, lots, customers, leads,
  quotes, packages, appointments, tasks, construction jobs, warranty/service, docs,
  employees, permissions, AI conversations, notifications, audit logs).
- **Modular / service-oriented** — independent modules (Auth, Inventory, Land,
  Customers, CRM, Construction, Warranty, Scheduling, Financing, Documents, Reporting,
  Marketing, AI, Notifications, Search) with clear interfaces; no monolith.
- **Auth is foundational** — moved to the front of the platform build (Phase 1), since
  it unlocks portals, saved quotes/homes, documents, messaging, roles, and audit.
- **No temporary solutions** that require replacing later; think several phases ahead
  while building only what delivers value today.

**Why:** "build for the company we are becoming, not just the company we are today" —
the destination is a national platform running the whole business (marketing →
ownership). Phasing stays; the constraint is that each phase expands into that
platform **without a rewrite**. **Relationship to D-HP-002:** does NOT change "launch
readiness first" — Phase 0 stays marketing/lead hardening. It governs *how* we build
everything from Phase 1 on, and sets guardrails so Phase-0 choices don't create debt
(e.g. any new dynamic behavior goes through an API + is DB-ready, not a static hack).
**Owner:** Joe directed 2026-07-03. **Supersedes nothing; refines the roadmap** (see
`ROADMAP.md` §Target architecture + Phase 1 re-scoped to DB + auth + API + admin).

## D-HP-003 — Sister to Forturro: share patterns, not coupling (2026-07-02)
**Decision:** Home Placer reuses Forturro's *engineering patterns* — Cloudflare D1
data layer, Workers/OpenNext deploy, HMAC-cookie auth model, workflow/notification/
AI patterns, and UI conventions — as **templates**, but keeps its own database, CRM,
and customer-data boundary. The two platforms must be able to evolve independently.
**Why:** maximizes engineering leverage without entangling two separate businesses.
Extends Forturro **D-021** (HP hybrid boundary) from "reuse horizontals" to an
explicit "copy the pattern, own the instance" rule. **Implication:** when a Forturro
shared service isn't yet extractable (e.g. the read-only listing API — see the open
platform request in `docs/platform-requests/`), HP replicates the pattern locally
rather than blocking or hard-coupling.

## D-HP-002 — Launch-readiness before platform build (2026-07-02)
**Decision:** finish and harden the current marketing/lead site to launch quality
(Phase 0) and get pricing + marketing live **before** building the larger platform
(D1, portals, package builder, etc.). Reassess scope from real traffic/conversion
data. **Why:** the highest-ROI, lowest-risk next step is converting the traffic we
can already earn; speculative backend before validated demand is debt. **Owner:** Joe
ruled 2026-07-02. **Revisit:** after Phase 0 ships and marketing drives real traffic.

## D-HP-001 — Scope: single-tenant HP-SC platform (2026-07-02)
**Decision:** architect for **one** dealership — Home Placer LLC (Horry/Georgetown
SC + nearby NC) — not a multi-dealer SaaS. Keep the data model and auth clean enough
that tenancy *could* be added later, but do **not** pay the multi-tenancy tax now.
**Why:** the business today is a single-location dealer; multi-tenant architecture
(per-tenant isolation, roles, branding, billing) would multiply cost and slow every
feature for a national-platform option that isn't a current goal. **Owner:** Joe
ruled 2026-07-02. **Revisit:** if selling the platform to other dealers becomes a
real objective.

---

*Governance model + team identity: see `CLAUDE.md` (Builder-Claude = HP CTO / Lead
Engineer) and the Forturro platform SSOT under `~/projects/forturro-idx/docs/`.*
