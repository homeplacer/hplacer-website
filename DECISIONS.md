# Home Placer — Decision Record

*Architecture + business decisions for the Home Placer platform. Newest on top.
Append an entry for every major decision. Cross-references Forturro platform
decisions (`~/projects/forturro-idx/docs/DECISIONS.md`) where relevant — HP is a
sister platform, not a fork.*

---

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
