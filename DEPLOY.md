# Deploying hplacer.com

**hplacer.com runs on Cloudflare Workers (Next.js 16 → OpenNext) — NOT Vercel.**
The site is already live; this doc is how to ship an update and verify it.

> ⚠️ **Vercel is obsolete — do not follow any Vercel deploy instructions.** Earlier
> versions of this doc (and the README) described deploying to Vercel with GoDaddy
> DNS. That path is dead: nameservers are on Cloudflare, the app is a Cloudflare
> Worker, and **a `git push` / merge to `main` does not deploy anything.**

## How it deploys

- **Host:** Cloudflare Workers via **OpenNext** (`@opennextjs/cloudflare`).
- **Worker:** `hplacer-app`
- **Production domains:** `hplacer.com` and `www.hplacer.com` (Cloudflare custom domains).
- **No CI/CD.** No GitHub Action deploys on push. **Merging a PR to `main` does NOT
  deploy production.** The only automated deploy is the `hplacer-blog-publish`
  scheduled task, which runs `npm run deploy` Mon & Thu to surface date-gated blog
  posts. Everything else is a **manual** `npm run deploy` by an operator.

## Prerequisite — Wrangler must be authed to the Home Placer account

`npm run deploy` uploads to Cloudflare, so Wrangler must be authenticated to the
**Home Placer** account (not the Forturro account):

- Account email: **carolina@hplacer.com**
- Account ID: **`6caa351d57b30bd04cec8a08e4330ffd`**

```bash
wrangler login       # interactive browser OAuth — authorize the Home Placer account
wrangler whoami      # VERIFY: Account ID must be 6caa351d57b30bd04cec8a08e4330ffd
```

Do **not** use `wrangler --temporary` — that deploys to a throwaway preview
account (wrong target). Cloudflare allows only one account login at a time, so if
you were in the Forturro account, re-log into Home Placer first.

## Deploy an update

`npm run deploy` builds from the **working tree, not git HEAD** — so sync `main`
and keep the tree clean before deploying:

```bash
cd hplacer
git checkout main
git pull origin main
npm run deploy       # = build-manifests → opennextjs-cloudflare build → opennextjs-cloudflare deploy
```

The deploy also populates the static-assets incremental cache into the `ASSETS`
bundle, so prerendered pages are served from cache instead of re-rendered per
request (background: `OPENNEXT-CACHE-AUDIT.md`).

## Post-deploy verification (safe — single requests, no load testing)

Do **not** hammer the site — high request volume trips Cloudflare's per-IP
protection. A handful of single requests is enough:

1. **Homepage** — `https://hplacer.com/` returns **200** with full content.
2. **`/homes`** — returns **200** and the model grid renders.
3. **One detail page** — e.g. `https://hplacer.com/homes/palmer` returns **200**.
4. **Cache is working** — request a page **twice**; the response header shows
   **`x-nextjs-cache: HIT`**. This is the pass/fail signal — a `MISS` on every
   request means the incremental cache has regressed.
5. **`/api/lead` stays dynamic** — `GET https://hplacer.com/api/lead` returns
   **405** (POST-only) with **no** `x-nextjs-cache` header. Do **not** POST a test
   lead — it would create a real Follow Up Boss record.

Then watch **Cloudflare → Workers analytics** over a few hours (CPU P90, cache
rate, `1102`/`5xx`). No traffic generation needed.

## Rollback

- **Revert + redeploy (canonical — repo and live Worker stay in sync):**
  ```bash
  cd hplacer && git checkout main && git revert --no-edit <bad-commit> && git push && npm run deploy
  ```
- **Immediate Worker rollback (fastest):**
  ```bash
  cd hplacer && npx wrangler rollback      # reverts hplacer-app to the previous version
  ```
  Use this to restore production right now, then follow up with the git revert so
  the repo matches the live Worker.

## Secrets (reference — not part of a routine deploy)

Lead-delivery keys are **Cloudflare Worker secrets**, not committed to the repo:
`FUB_API_KEY` (required for FUB delivery), optional `RESEND_API_KEY` / `LEADS_TO`, and
optional `LEAD_FAILURE_WEBHOOK_URL` (posts a minimal alert to a team webhook if a lead
can't be delivered at all — unset = alert off, the failure is still logged).
Manage with `wrangler secret put <NAME>`. Blank secrets make leads log instead of
deliver. Don't change secrets as part of a normal code deploy.
