# Home Placer — Session Handoff

_Last updated: 2026-07-01. Written so a fresh Claude Code on another machine can pick up exactly where we left off._

> **This is the quick-start.** The exhaustive, 15-section engineering handoff (every folder/file, standards, rules, environment, roadmap, decisions, recovery guide) lives in [`docs/handoff/`](docs/handoff/00-INDEX.md) — start there after this.

---

## 0. MIGRATION CHECKLIST — read first

What travels and what doesn't when you move to a new machine:

| Thing | Travels via git? | Action needed |
|---|---|---|
| **The code + content** (site, 36 blog posts, OG image, etc.) | ✅ **only if committed + pushed** | ⚠️ There were **~60 uncommitted files** — they MUST be committed & pushed, or the new clone is missing the current site. |
| **Memory files** (the deep project log) | ❌ local to the old Mac | Copy `~/.claude/projects/-Users-spencer/memory/` to the new machine, or rely on this doc + the repo. |
| **Browser logins** (Google/Bing/Cloudflare/registrar/FUB) | ❌ | Re-log in on the new machine. See §6. |
| **Wrangler / Cloudflare deploy auth** | ❌ | Re-auth wrangler to the Home Placer Cloudflare account before `npm run deploy`. |
| **Scheduled task** `hplacer-blog-publish` | ❌ (lives in `~/.claude/scheduled-tasks/`) | Recreate on the new machine if you want the blog to keep auto-publishing there (see §3). |

**First move on the new machine:** `git clone https://github.com/homeplacer/hplacer-website.git`, `cd`, `npm install`, then read this file + `git log` to confirm the last commit includes the 2026-07-01 session work.

---

## 1. Who / what

- **User:** Joe Scaturro — owns **Home Placer LLC** (SC manufactured-home + land dealer, Horry County / Grand Strand, licensed SC & NC) and leads **The Forturro Group** (KW real-estate team). This session is almost entirely **Home Placer**.
- **hplacer.com** = Home Placer's marketing + lead-gen website. Tagline: "New homes, on land, from the low $200s." Phone (843) 849-HOME. Warranty line (843) 484-9844. Address 1801 N Oak St, Myrtle Beach SC 29577.
- **Voice:** honest, plain-spoken, local, never hypey. Objection-led. Speaks to a nervous first-time buyer.

## 2. Stack + how to run & deploy

- **Next.js 16.2.9** (App Router) + **React 19** + **Tailwind v4** (brand = slate ramp; live theme currently has **pink accents**). ⚠️ `AGENTS.md` warns Next 16 has breaking changes — standard client components/metadata work fine.
- **Cloudflare Workers via OpenNext.** Deploy: **`npm run deploy`** (`build-manifests.mjs && opennextjs-cloudflare build && opennextjs-cloudflare deploy`). Custom domains hplacer.com + www.
- **Repo:** `github.com/homeplacer/hplacer-website` (GitHub org `homeplacer`). Working branch: `first-touch-attribution`. **Deploys build from the WORKING TREE, not a branch** — so the working files are the source of truth, not git HEAD.
- **Dev preview:** `npm run dev` (or the preview tool's `hplacer` server on :3000).
- **Data (edit these JSON directly):** `data/models.json` (93 models), `data/placed-homes.json` (73), `data/blog-posts.json` (36). ⚠️ **NEVER re-run `scripts/build-models.mjs`** — it omits floorPlans/tourUrl and would wipe hand-finalized fields. Edit models.json by hand.
- **workerd has NO filesystem at runtime.** Anything needing a file (e.g. next/og images) must be a static import or inlined base64 — NOT `fs.readFileSync`. (See §7.)

## 3. Current LIVE state (done + deployed)

- **Full site:** homepage, 93 model detail pages, `/homes` browser (brand/width/beds/sqft/price/**full-drywall** filters + search + sort), 73 `/recently-placed` pages + Leaflet map, 27 `/locations`, `/brands`, `/land-packages`, `/financing`, `/process`, `/warranty`, `/faq` (23 Q&As), `/gallery`, educational pages (manufactured-vs-site-built, modular-vs-manufactured, mobile-vs-manufactured, drywall-vs-wall-strips), about/team/contact/service-request.
- **Blog: 36 posts**, date-gated **auto-publishing 2×/week (Mon & Thu)** through ~Aug 6 via the `hplacer-blog-publish` scheduled task (runs `npm run deploy` + pings IndexNow). Queue empties ~Aug 6 → needs a refill batch then (Gemini's plan = 2/wk for 90 days).
- **Full Drywall badge** (51 drywall models), **"mobile home" SEO** on homepage+/homes+locations, **real Google reviews** section + Review JSON-LD (5.0★, 7 reviews), **OG link-preview = real home photo** (see §7 gotcha).
- **Forturro land-search cross-over** (homepage + /land-packages + footer) → `search.forturro.com` land-only deep-link (sister-company; keeps land-seekers in-house).
- **Search infra (all under carolina@hplacer.com):** Google Search Console verified + sitemap submitted; Bing Webmaster imported; **IndexNow live** (`public/e0e445eaf75d61f3faee17b699eca3b9.txt` + `scripts/indexnow.mjs`); robots.ts, sitemap.ts, llms.txt.
- **Lead capture:** website forms → Follow Up Boss via `/api/lead` (FUB_API_KEY is set as a Worker secret; leads DO land in FUB). Resend email backup NOT configured (optional).

## 4. ⭐ IN PROGRESS / PAUSED — resume first

### A. Domain transfer: hplacer.com registration → Cloudflare Registrar (PAUSED 2026-07-01)
Moving the **registration** (NOT DNS — nameservers already Cloudflare, so the site is unaffected) from **Priced Right Domains** (GoDaddy/Secureserver reseller; portal `dcc.secureserver.net`, logged in as carolina@hplacer.com) → **Cloudflare Registrar** (at-cost). Transfer-eligible (registered 2024-10-14).
- ✅ DONE: domain **Lock turned OFF**.
- ▶️ NEXT: (1) Priced Right Domains → hplacer.com settings → **"Transfer to Another Registrar"** (NOT "…Another Priced Right Account") → get the **auth/EPP code**; ⚠️ **Domain Privacy is ON** (Domains By Proxy) — may need to toggle OFF first. Approval email → joe@forturro.com. (2) Cloudflare (Home Placer account) → **Domain Registration → Transfer Domains** → hplacer.com → paste EPP → confirm contacts → **pay (~$10.44/yr at cost, adds a year — confirm before paying)**. (3) Approve the confirmation email.
- Blocker: Cloudflare only allows **one account login at a time** and Joe was in Forturro's CF account.
- ⏸️ Also parked until the domain lives at CF: **enable HSTS** (SSL/TLS → Edge Certificates; the site already forces HTTPS via 308 redirect + valid TLS 1.3 cert, so HSTS is a hardening nice-to-have).

### B. Bing Places for Business (CLAIMED, needs Joe's PIN verify)
Listing claimed under carolina@hplacer.com (correct NAP, "Mobile home dealer", hours). Joe must finish: bing.com/forbusiness → Home Placer → "Verify now" → Phone/SMS to (843) 849-4663 → enter PIN. Fields are locked until verified.

### C. Apple Business Connect (PARKED — Joe locked out of his Apple ID)
`businessconnect.apple.com` now redirects to the unified `business.apple.com` (Maps place-card under the Maps icon). Needs an Apple ID sign-in (ideally a Home Placer one). Come back when Joe recovers his Apple ID.

## 5. Open TODOs (need Joe)

1. **⭐ Pricing** — all 93 models still show "Call for pricing" (`data/setup-pricing.json` + `data/home-pricing.json` are empty `{}`). This is the biggest conversion gap. When Joe sends numbers → fill them in + the price sort/filters (already built, dormant) light up.
2. Domain transfer + then HSTS (§4A).
3. Bing Places PIN verify (§4B) · Apple Business Connect (§4C).
4. **Blog queue refill** ~Aug 6 (write ~12 more posts to hit Gemini's 90-day/36-post cadence).
5. **Modulars catalog** (DEFERRED by Joe — educational page done, inventory not built) · **Sapphire/Pearl** placed-home models not in catalog (deferred).
6. Optional: add `RESEND_API_KEY` Worker secret for team-email lead backups.

## 6. Accounts & access (re-establish on the new machine)

- **⚠️ RULE: keep Home Placer's accounts under `carolina@hplacer.com` ("Home Placer Carolina"), NEVER Joe's Forturro `info@forturro.com` / `joe@forturro.com`.** (Learned the hard way — Bing was mistakenly put under info@forturro.com and had to be moved.) carolina@ owns HP's Google (GSC, GA4 `G-0T71PWYQSQ`, GBP), Bing Webmaster, Bing Places.
- **Cloudflare:** Home Placer account (zone hplacer.com; nameservers barbara/gabriel.ns.cloudflare.com). Wrangler must be authed to it to deploy.
- **Registrar:** Priced Right Domains via `dcc.secureserver.net` (Wild West Domains/GoDaddy reseller), logged in as carolina@hplacer.com.
- **Follow Up Boss:** the website's `FUB_API_KEY` is set as a Cloudflare Worker secret (not in the repo). Broader FUB automation lives in other projects (`~/fub-integration`, etc.).
- **Gemini (for the SEO rule, §7):** joe@forturro.com, logged into the session Chrome.
- Browser logins do NOT transfer — sign in fresh.

## 7. Key rules & gotchas (don't relearn these)

- **next/og OG images:** workerd has no fs → the hero photo is inlined as base64 in `src/app/og-hero.ts` and imported by `src/app/opengraph-image.tsx`. `fs.readFileSync` → HTTP 500 in prod + drops the og:image tag. To change the OG hero photo, regenerate og-hero.ts (sips resize→1200w q62 + base64).
- **SEO/geo rule:** every page buildout gets an SEO+geo pass via Gemini (joe@forturro.com web login), prompting as a top Google engineer, then apply. (Memory: `feedback_seo_geo_gemini.md`.)
- **Wall finish wording:** wall strips = "pre-finished gypsum panels with a printed, wallpaper-like coating" + batten strips — **NOT "vinyl"/"VOG"** (Joe's correction). "rock-vinyl skirting" on the gallery page is legit.
- **Financing line:** every manufactured home sold **with land** qualifies for **conventional / FHA / VA / USDA** (real property, not a chattel/"mobile home" loan). Use this everywhere.
- **models.json:** edit directly; never re-run build-models.mjs. Plant→drywall mapping in the `series` field; `wallFinish` field = "drywall"|"drywall-optional"|"strips".
- **Blog:** date-gated (`src/lib/blog.ts` — future-dated posts hidden until their date; a redeploy on/after the date surfaces them). `bodyMarkdown` has **no H1** (title renders separately); use `##`.
- **JSX whitespace:** inline `</strong>`/`</a>` followed by text on the same line strips the space → use `{" "}` after the closing tag.
- **City reassignments are canonical:** all Rabbit Ln + Hwy 139 = Conway; Pint Circle = Longs. Cards (placed-homes.json) AND map dots (placements.json) must both match on any city move.
- **Cloudflare throttling:** rapid concurrent crawls of hplacer.com return transient 503s — not real errors. Retry sequentially.

## 8. Deep detail lives in memory

The full, blow-by-blow project log is in the memory files on the old Mac:
`~/.claude/projects/-Users-spencer/memory/` — `MEMORY.md` is the index; **`project_hplacer_rebuild.md`** is the exhaustive Home Placer log (theme, extraction, every feature, every deploy). Copy that folder to the new machine for full continuity, or use this doc + the repo. Related: `feedback_seo_geo_gemini.md`, `project_forturro_new_website_idx.md`, `feedback_relationship_owner_routing.md`.
