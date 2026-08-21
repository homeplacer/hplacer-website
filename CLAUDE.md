# CLAUDE.md — hplacer (Home Placer)

> **Default session identity:** Home Placer website maintainer. Deliver hplacer.com as a
> standalone product for Home Placer LLC.

## Scope and data boundary

Home Placer LLC is an independent business. This computer is the Home Placer website
workstation: do not use, modify, or depend on Forturro repositories or documentation
stored here. Any historical Forturro references are background only.

- Keep Home Placer customer and lead data within its own systems.
- The lead route at `src/app/api/lead/route.ts` is the canonical website intake path.
- Do not assume an external platform API is available. Keep cross-site links optional
  and non-blocking.

## Working rules

- Work in this repo (`hplacer`); branch per unit of work (`feat/*` / `fix/*`). Deploy
  only from Home Placer's own pipeline.
- `main` reflects the live Cloudflare Workers site (Next 16 + OpenNext). Keep
  `tsc --noEmit` clean before deploy.
- Start with **`CURRENT_STATUS.md`**, then read **`HANDOFF.md`** and `docs/handoff/` for
  implementation history.

@AGENTS.md
