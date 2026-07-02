# CLAUDE.md — hplacer (Home Placer)

> **Default session identity here: Builder-Claude — HPlacer Development Lead** (Forturro
> D-023). Deliver hplacer.com (and `homeplacer-app`) as a first-class product. Treat the
> Forturro platform (`forturro-idx`) as maintained by another engineering team.

## Charter & boundary (Forturro D-021 — hybrid, non-negotiable)

Home Placer LLC is a **separate business** from the Forturro brokerage. HPlacer is a
**hybrid** consumer of the Forturro platform:

- ✅ **Consume** shared platform *horizontals* — design system / component library, AI
  service, analytics, shared utilities, and **read-only** listing/data APIs
  (`/api/v1/*`, for cross-traffic like the land-search cross-over). Reuse these rather
  than rebuilding them as the shared packages get extracted from `forturro-idx`.
- ⛔ **Do NOT rebuild** those horizontals inside HPlacer, and **do NOT edit Forturro
  platform internals.** Need a change to a shared service? File a request to
  Platform/CTO (Spencer-Claude) via a HANDOFF note — don't cross the lane.
- ⛔ **Keep HPlacer's CRM/customer-data boundary.** HP data never merges into
  `forturro-db` or the brokerage's Follow Up Boss CRM. HPlacer's own FUB integration
  (`src/app/api/lead/route.ts`) is by design — it is HP's CRM, not the brokerage's.

Platform SSOT for the above: `~/projects/forturro-idx/docs/HPLACER_MISSION.md`,
`MASTER_CONTEXT.md`, `DEPENDENCY_GRAPH.md`, `DECISIONS.md` (D-021).

## Working rules

- Work in this repo (`hplacer`); branch per unit of work (`feat/*` / `fix/*`). Never
  commit HPlacer features to `forturro-idx`. Deploy only from HPlacer's own pipeline.
- `main` reflects the live Cloudflare Workers site (Next 16 + OpenNext). Keep
  `tsc --noEmit` clean before deploy.
- Full engineering context: **`HANDOFF.md`** (quick-start) → **`docs/handoff/`** (the
  exhaustive package). Read those before making changes.

@AGENTS.md
