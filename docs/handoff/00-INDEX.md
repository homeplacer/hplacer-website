# Home Placer — Complete Engineering Handoff Package

_Generated 2026-07-01. Purpose: let another engineer or Claude continue this project with **zero prior context**._

This folder is the exhaustive version of the quick-start [`../../HANDOFF.md`](../../HANDOFF.md). Read the quick-start first (5 min), then dive into the files here for depth.

## Read in this order

| # | File | What's in it |
|---|------|--------------|
| — | [`../../HANDOFF.md`](../../HANDOFF.md) | **Start here.** 5-minute migration checklist, live state, paused domain transfer, rules, accounts. |
| 01 | [`01-OVERVIEW.md`](01-OVERVIEW.md) | Executive summary + full project overview: every page/route, service, backend, API, data store, integration, automation. |
| 02 | [`02-FOLDER-GUIDE.md`](02-FOLDER-GUIDE.md) | Folder tree + purpose of every major folder and important file; generated files; never-edit list. |
| 03 | [`03-DEVELOPMENT-STANDARDS.md`](03-DEVELOPMENT-STANDARDS.md) | Naming, architecture, TypeScript, React, backend, API, error handling, commit style, docs. |
| 04 | [`04-PROJECT-RULES.md`](04-PROJECT-RULES.md) | Permanent always/never rules, preferred vs rejected approaches, perf, security. |
| 05 | [`05-SKILLS-AND-MCP.md`](05-SKILLS-AND-MCP.md) | Skills/tooling/workflows relied on + MCP servers (how to reconnect + verify). |
| 06 | [`06-ENVIRONMENT.md`](06-ENVIRONMENT.md) | Node, package manager, Python, Cloudflare/wrangler, git, env vars (described, no secrets), accounts. |
| 07 | [`07-ROADMAP.md`](07-ROADMAP.md) | Prioritized TODO (immediate → future) + feature dependencies + blockers + known bugs. |
| 08 | [`08-CONTEXT-AND-KNOWLEDGE-TRANSFER.md`](08-CONTEXT-AND-KNOWLEDGE-TRANSFER.md) | **The most important file.** Decisions + why, tradeoffs, lessons, "if I were continuing," deep session memory. |
| 09 | [`09-ACTIVE-WORK-AND-RECOVERY.md`](09-ACTIVE-WORK-AND-RECOVERY.md) | Active/WIP files + step-by-step fresh-machine recovery guide. |

## 60-second TL;DR

- **What:** hplacer.com — Home Placer LLC's marketing/lead-gen site. Next.js 16 (App Router) → OpenNext → **Cloudflare Workers**. Data is static JSON (`data/*.json`). Leads → Follow Up Boss via `/api/lead`.
- **Deploy:** `npm run deploy`. Repo: `github.com/homeplacer/hplacer-website`, branch `first-touch-attribution`. Deploys build from the **working tree**, not git HEAD.
- **Live & done:** 93 model pages, filterable browser, 73 recently-placed + map, 27 location pages, 36 blog posts auto-publishing 2×/wk, reviews, drywall badge, mobile-home SEO, real-photo OG preview, GSC + Bing + IndexNow.
- **#1 open item:** **pricing** — all 93 models say "Call for pricing" (`data/home-pricing.json` + `data/setup-pricing.json` are empty). Filling them activates the already-built price sort/filters.
- **Paused external work:** hplacer.com **domain registration transfer** to Cloudflare (unlock done; needs auth code + Cloudflare submit + pay). Bing Places PIN verify. Apple Business Connect (Joe's Apple ID locked).
- **Hard rules:** keep HP accounts under **carolina@hplacer.com** (never Forturro's); **never** `fs` at runtime (workerd has no FS — OG image is base64); **never** re-run `build-models.mjs`; wall strips ≠ "vinyl"; page titles must not include the brand.

## What doesn't live in git (re-establish on the new machine)

- The deep memory log (`~/.claude/projects/-Users-spencer/memory/project_hplacer_rebuild.md`) — copy it for full history.
- Browser logins (Google/Bing/Cloudflare/registrar/FUB), wrangler auth, and the `hplacer-blog-publish` scheduled task. See `09-ACTIVE-WORK-AND-RECOVERY.md`.
