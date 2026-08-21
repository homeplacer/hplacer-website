# Home Placer Website — Current Status

_Updated 2026-08-21 from the local repository, its remote state, and the Home Placer Claude memory on this Mac._

## Working scope

This is the standalone Home Placer website workspace. Forturro work has moved to a
different machine and is out of scope here.

## Canonical workspace

- **Repository:** `hplacer` / `homeplacer/hplacer-website`
- **Production target:** hplacer.com on Cloudflare Workers via OpenNext
- **Deployment:** manual `npm run deploy`; merging to `main` does not deploy
- **Current remote main:** includes the lead-failure webhook improvement merged on
  2026-07-09
- **Local checkout:** clean; its active fix branch is already merged remotely. Before
  new work, switch to `main` and pull the remote main branch.

## Product state

- The site is live with the catalog, location pages, recently placed homes, lead forms,
  SEO routes, and Cloudflare deployment configuration.
- Website lead delivery uses Follow Up Boss when its Cloudflare secret is configured.
  The optional Resend team-email backup remains unconfigured.
- The blog queue is exhausted: all scheduled posts were live by 2026-08-06. The
  publishing automation now has nothing to release until new posts are intentionally
  added.

## Highest-priority follow-ups

1. Add approved catalog pricing when it is available; the site is ready to display it.
2. Refill the blog queue only when approved.
3. Confirm lead delivery and decide whether to enable the optional email backup.
4. Finish the external domain-transfer and business-listing tasks when account access
   and approvals are available.

## Rules that prevent expensive mistakes

- Never deploy from an unreviewed or dirty working tree.
- Do not submit test leads to production.
- Never rerun `scripts/build-models.mjs`; edit the finalized model data directly.
- Cloudflare Workers has no runtime filesystem. Keep runtime assets static or bundled.
- Keep secrets in Cloudflare, never in the repository.

## Where to read next

- `DEPLOY.md` for the deployment and rollback procedure.
- `HANDOFF.md` and `docs/handoff/` for detailed historical implementation context.
- `AGENTS.md` and `CLAUDE.md` for session rules.
