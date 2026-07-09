# Home Placer — Website + Backend Deep Dive

*Audit + prioritized queue. Investigation-only pass — no production changes were made.
Prepared 2026-07-09. Companion to (not a replacement for) the repo's engineering docs —
`ROADMAP.md`, `DECISIONS.md`, `TODO.md`, and `docs/handoff/`. (The launch-readiness and
OpenNext cache-audit reports now live in `reports/` — see below.)*

## Why this folder exists

The repo already has strong engineering docs (handoff, roadmap, decisions, launch
readiness). This folder is different in purpose: it is an **outside-in audit** of the
site + business (engineering, conversion, SEO/local, lead-flow, compliance, backend
opportunity) and a **clean prioritized queue** a future Claude build session can pull
from. It does **not** supersede `TODO.md` / `ROADMAP.md` — it feeds them.

**Docs-structure decision:** kept the requested `docs/homeplacer-ideas/` rather than
folding into `docs/handoff/`. `docs/handoff/` is the engineering onboarding package
(how the system works); this is findings + a decision queue (what to do next and why).
Different jobs, so they live side by side.

## How to read this

| File | What's in it |
|---|---|
| `current-system-map.md` | The factual map — stack, routes, data, integrations, deploy. Confirmed. |
| `website-audit.md` | Public-site UX/conversion audit (persona-based). |
| `technical-audit.md` | Code/technical debugging audit. Bugs separated from cleanup. |
| `lead-flow-audit.md` | Full lead journey + where leads/attribution can break. |
| `backend-opportunities.md` | What backend/admin should eventually exist (urgent/later/parking). |
| `seo-content-opportunities.md` | Local-search + content gaps + coverage table. |
| `compliance-review-flags.md` | Items to route to legal/lender/broker/dealer review. Not legal advice. |
| `business-opportunity-review.md` | Direct opinion on gaps + what NOT to build. |
| `approved-build-queue.md` | **Empty until Joe approves.** Nothing here is authorized yet. |
| `parking-lot.md` | Deliberately-not-now ideas. |
| `questions-for-joe.md` | Decisions + access blockers that need Joe. |
| `FINAL-REPORT.md` | The executive roll-up of everything above. **Start here.** |

### `reports/` — long-form reports

| File | What's in it |
|---|---|
| `reports/HOME-PLACER-DEEP-DIVE.md` | The complete single-file bundle of this whole audit (every section above, concatenated). |
| `reports/LAUNCH-READINESS.md` | Phase-0 launch-readiness report — build / lead-pipeline / security / SEO status + the remaining operational gates before traffic. |
| `reports/OPENNEXT-CACHE-AUDIT.md` | OpenNext incremental-cache audit + the one-file fix plan (the `static-assets` incremental cache). |

## Documentation rules used here

- **Confirmed facts** (cite `file:line`) are kept separate from **assumptions/opinion**.
- **Bugs** are kept separate from **opportunities**.
- **Urgent fixes** are kept separate from **future ideas**.
- The **approved queue** is empty by design — a rough idea in this folder is *not* an
  approved build task. Joe decides what graduates into `approved-build-queue.md`.

## Priority legend

| Label | Meaning |
|---|---|
| **P0** | Urgent / broken / blocking / serious risk |
| **P1** | High-value fix, soon |
| **P2** | Important improvement |
| **P3** | Nice-to-have |
| **PARKING LOT** | Not now |
| **NEEDS JOE** | Needs a business decision |
| **NEEDS ACCESS** | Blocked by missing credentials/admin/analytics/CRM access |
| **DO NOT BUILD** | Bad idea or too risky until clarified |

## Scope guardrails honored this pass

Read-only. No production changes, no deploy, no forms submitted, no emails/SMS sent,
no CRM writes, no DNS/payment/DB changes, no secrets exposed. The only writes are the
markdown files in this folder.
