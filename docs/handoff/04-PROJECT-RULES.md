# 04 — Project Rules

Permanent, non-negotiable rules for working on hplacer.com. These are hard-won — several encode mistakes that were made and fixed. Violating them breaks the build, the site, SEO, or the brand. Every rule is backed by code or a documented incident.

---

## A. Always do

1. **Keep Home Placer accounts under `carolina@hplacer.com` ("Home Placer Carolina").** This account owns HP's Google (Search Console, GA4 `G-0T71PWYQSQ`, Google Business Profile), Bing Webmaster, and Bing Places. NEVER put HP under Joe's Forturro accounts (`info@forturro.com` / `joe@forturro.com`). *(Incident: Bing Webmaster + Bing Places were first set up under info@forturro.com, Joe corrected it, and it all had to be deleted and re-created under carolina@.)*
2. **Run a Gemini SEO/geo pass on every new page.** Standing rule: for any page buildout, drive gemini.google.com (logged in as joe@forturro.com in the session Chrome), prompt as "a top Google search engineer," get SEO + geo (local search) recommendations, then apply. Memory: `feedback_seo_geo_gemini.md`.
3. **Edit `data/models.json` DIRECTLY, by hand.** It is the source of truth for the 93-model catalog.
4. **Run `node scripts/build-manifests.mjs` as part of deploy** (it's baked into `npm run deploy`). Never hand-edit generated manifests.
5. **Keep the website's NAP consistent** with the canonical business facts in `src/lib/site.ts` (single source of truth): "Home Placer", (843) 849-HOME sales / (843) 484-9844 warranty, 1801 N Oak St Myrtle Beach SC 29577.
6. **Verify a deploy after shipping** with real `curl` checks against https://hplacer.com (status codes, meta tags, presence of expected content) — don't assume.
7. **Commit messages end with** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Commit/push only when Joe asks.

## B. Never do

1. **NEVER re-run `scripts/build-models.mjs`.** Its output omits `floorPlans` and `tourUrl` and would wipe hand-finalized fields from all 93 models. It's a one-time bootstrap, not a live pipeline. Edit `models.json` by hand instead.
2. **NEVER use `fs`/filesystem I/O at runtime.** The Cloudflare Workers (workerd) runtime has NO filesystem. `fs.readFileSync` in a request path throws (HTTP 500). *(Incident: the OG image used `fs.readFileSync(process.cwd()+"/public/...")` → 500 in prod AND dropped the `og:image` meta entirely. Fixed by inlining the photo as base64 in `src/app/og-hero.ts`.)* Anything needing a file must be a static import or inlined at build.
3. **NEVER commit secrets.** `.gitignore` covers `.env*`, `.dev.vars`, tokens. Real secrets (e.g. `FUB_API_KEY`) live as Cloudflare Worker secrets, not in the repo. Public ownership tokens (IndexNow key `.txt`, Google verification `.html`) ARE committed — they're meant to be publicly served.
4. **NEVER put an `# H1` in blog `bodyMarkdown`.** The post title is rendered separately by the page; a body H1 double-renders. Use `##` for sections.
5. **NEVER describe wall strips as "vinyl" or "VOG."** (Joe's explicit correction.) Correct wording: "pre-finished gypsum panels with a printed, wallpaper-like coating" + batten strips. ("Rock-vinyl skirting" on the gallery page is legitimate and stays.)
6. **NEVER treat Cloudflare burst-throttle 503s as real errors.** Rapid concurrent crawls of hplacer.com return transient 503s; retry sequentially with backoff. *(Incident: a 12-way crawl produced false 503s that a workflow mistook for broken pages.)*

## C. Data-model rules

- `data/models.json` (93), `data/placed-homes.json` (73), `data/blog-posts.json` (36) are the three primary stores, statically imported (workerd has no runtime fs). Types + pure helpers live in `src/lib/home-types.ts` (client-safe); fs-free loaders/caches in `src/lib/homes.ts`, `src/lib/placed-homes.ts`, `src/lib/blog.ts`.
- **`wallFinish`** on each model = `"drywall" | "drywall-optional" | "strips"`. 51 = drywall (badge shown), 4 = drywall-optional (The Summit line), 38 = strips (no badge — "don't highlight wall strips"). Plant→finish mapping lives in the model `series` field.
- **City reassignments are canonical and must match in BOTH sources:** all Rabbit Ln + Hwy 139 addresses = **Conway**; Pint Circle = **Longs**. The *cards* come from `placed-homes.json` and the *map dots* from `placements.json` — a city move must be applied to BOTH or the card and the map disagree.
- **Blog date-gating** (`src/lib/blog.ts`): `getAllPosts()` filters out posts whose `date` is in the future (evaluated at BUILD time). Future-dated posts stay hidden until a redeploy on/after their date. `getScheduledPosts()` returns all (tooling only). This is what powers the 2×/week drip.

## D. Frontend / copy rules

- **Financing line (use everywhere):** every manufactured home sold **with land** qualifies for **conventional, FHA, VA, or USDA** financing — it's real property, not a chattel/"mobile-home" loan.
- **JSX whitespace:** an inline `</strong>` or `</a>` immediately followed by text on the same source line drops the space (renders "MLSat"). Fix with an explicit `{" "}` after the closing tag. *(Hit repeatedly — the Forturro cross-over and the placed-home fallback both needed it.)*
- **Page `<title>` must NOT contain the brand** — the layout template appends `· Home Placer`, so any title with "Home Placer" in it double-brands. *(Incident: 74 recently-placed titles read "…placed by Home Placer · Home Placer"; fixed.)*
- **Voice:** honest, plain-spoken, local, objection-led, never hypey. Written for a nervous first-time buyer.

## E. Search / SEO rules

- Every deployable page contributes to `sitemap.ts` and gets JSON-LD via `src/lib/jsonld.tsx` (LocalBusiness with real reviews, Product for homes, Article for posts, breadcrumbs, FAQPage).
- OG/link-preview image is a real home photo, base64-inlined (`og-hero.ts`) — see rule B2. To change it, regenerate the base64 (sips resize→1200w q62).
- IndexNow is live: `scripts/indexnow.mjs` pings Bing/Yandex on each blog publish; the ownership key file is served at `/public/<key>.txt`.
- "Mobile home" is used deliberately in titles/copy (people search it) alongside "manufactured home."

## F. Infrastructure / performance / security

- Deploy target is **Cloudflare Workers via OpenNext** (`npm run deploy`). No ISR/revalidate configured — the blog drip relies on scheduled redeploys, not ISR.
- Static assets + JSON imports keep the Worker fast; no runtime DB.
- Site forces HTTPS (308 redirect, valid TLS 1.3 cert, auto-renewed). HSTS is NOT yet enabled (parked until the domain registration lands at Cloudflare).
- Lead delivery (`/api/lead`) runs FUB + Resend independently via `Promise.allSettled`, each guarded — a missing key (e.g. no `RESEND_API_KEY`) skips that channel without breaking the FUB path.

## G. Preferred vs rejected approaches

| Prefer | Over / rejected |
|---|---|
| Static JSON data stores + build-time import | A runtime database (unnecessary; workerd-hostile) |
| next/og image with base64-inlined photo | `fs.readFileSync` (500s in workerd) or a static PNG (loses code-driven tweaks) |
| Date-gated posts + scheduled redeploy | ISR/revalidate (unreliable on OpenNext/Workers for this) |
| Cross-linking to sister-company Ylopo search (can't iframe it) | Embedding the IDX (blocked by `X-Frame-Options: SAMEORIGIN`) |
| Editing `models.json` by hand | Re-running `build-models.mjs` (data loss) |
| Real home photos in link previews | Generic text OG cards (far lower CTR) |

---

*See `01-OVERVIEW.md` for architecture, `06-ENVIRONMENT.md` for env/secrets, `08-CONTEXT-AND-KNOWLEDGE-TRANSFER.md` for the "why" behind these rules.*
