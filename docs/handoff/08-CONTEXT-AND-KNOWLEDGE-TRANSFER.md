# 08 — Context & Knowledge Transfer: Deep Session Memory

**For:** the next Claude engineer picking up Home Placer work  
**Status:** hplacer.com Live (Cloudflare Workers), blog auto-publishing 2×/week via scheduled task  
**Last sync:** 2026-07-01 (Joe Scaturro confirmed green)

---

## SECTION 10: Architecture Decisions & WHY

### **Why Next.js 16 + Cloudflare Workers (OpenNext)?**

Home Placer is a **performance-first lead-gen + content site** with 130+ static pages, 36 blog posts (date-gated), and zero database. The stack choice reflects:

1. **Workerd has NO filesystem** — a hard constraint. Next.js 16 on Workers is not typical; you must:
   - Import static data (JSON) directly into the bundle (`import X from '../../data/X.json'`)
   - Never use `fs.readFileSync` outside of build time (the build generates static assets)
   - Inline binary assets as base64 or import them at build → they land in `.open-next/assets`
   - **This is why og-hero.ts is base64-encoded**: OG images are generated at build time; workerd cannot fetch them at request time

2. **OpenNext + `@opennextjs/cloudflare`** = the glue between Next 16 and Cloudflare Workers. The config is minimal (`open-next.config.ts`); it's pure SSR + SSG (no ISR/on-demand revalidation, no R2 binding needed yet). Custom domains via `wrangler.jsonc`: hplacer.com + www.

3. **Why not Vercel?** Joe owns the domain (Priced Right Domains → Cloudflare Registrar pending). Workers is at-cost ($0.50/M requests, ~$5-10/mo for hplacer traffic), cheaper than Vercel Pro + custom domain.

4. **All data is JSON, never a database.** The site's "database" is three hand-edited JSON files + scripts that generate manifests (search indices, pagination). Why?
   - **Simplicity:** Joe controls everything; no ORM, no migrations, no schema conflicts.
   - **Git-friendly:** every home, price, blog post is durable in version control.
   - **No vendor lock-in:** data is portable.
   - **Caveat:** hand-edit **only** `data/models.json`, `data/blog-posts.json`, `data/placed-homes.json`. **NEVER re-run `scripts/build-models.mjs`** — it omits `floorPlans` + `tourUrl` fields Joe hand-finalized; rebuild would wipe them. The script is a one-time init tool, not a rebuild tool.

### **Why Static JSON, Not a Database?**

- **Performance:** all data bundled → no runtime DB queries, pure edge caching.
- **Offline-friendly:** the build is deterministic; a dev can work anywhere without a live connection.
- **Joe's autonomy:** he edits `models.json` by hand (VS Code JSON schema validation), sees the site change on redeploy, no backend required.
- **Trade-off:** if inventory grows to 1,000+ models, consider a lightweight DB + ISR for dynamic pricing/availability. Current 93 models are fine as JSON.

### **Why Date-Gated Blog Publishing?**

The blog at `src/lib/blog.ts` evaluates the `date` field at **BUILD time** (today = the deploy date):

```ts
const TODAY = new Date().toISOString().slice(0, 10);
export function getAllPosts(): Post[] {
  return getScheduledPosts().filter((p) => p.date <= TODAY);
}
```

Any post with a **future date is hidden until that date**. A post scheduled for 2026-07-15 won't appear until the site is rebuilt + deployed on/after 2026-07-15. The **hplacer-blog-publish scheduled task** (runs Mon & Thu 6:10am) does exactly that: rebuild + deploy, so any due posts surface.

**Why this design?**
- **No CMS, no live state.** The entire content calendar is in `data/blog-posts.json`; anyone can edit it (with git).
- **Autonomous publishing:** the scheduled task removes manual deploy friction. New posts go live on their date with zero human intervention.
- **Queue management:** if the queue empties, the task warns so Joe knows to write more posts. Current queue: ~36 posts, dripping Mon & Thu; empties ~2026-08-06 (Gemini's 90-day plan).

### **Why Base64-Encoded OG Image?**

The og-preview card (when you paste hplacer.com in a Slack/iMessage/social) uses a real home photo as the og:image. Originally attempted `fs.readFileSync` at build time → worked locally, but **failed in production with HTTP 500 in workerd (no filesystem)**.

**The fix:** `src/app/og-hero.ts` is a build-generated file containing a base64-encoded JPEG of the hero photo. `opengraph-image.tsx` imports it and renders it as an `<img src="data:image/jpeg;base64,..."`.

**How to change the OG photo:**
1. Get the new photo (or use an existing one from `public/models/*/01.jpg`)
2. Resize it to 1200×630px, quality 62 (via `sips --resampleHeightWidth 1200 630 -s formatOptions 62`)
3. Base64-encode it: `base64 < hero.jpg | tr -d '\n'`
4. Paste the base64 string into `og-hero.ts` as the value of `OG_HERO`
5. Redeploy

**Never use emoji in `ImageResponse`** — the next/og library tries to fetch emoji glyphs from a CDN at build time; offline builds fail. Use text or unicode symbols only.

### **Why Carolina@hplacer.com (Not Joe's Forturro Email)?**

**Learned the hard way:** Bing Search Console + Google Search Console + Google Business Profile were initially set up under `info@forturro.com`, causing:
- Bing mistakenly thought HP was a Forturro property (SEO confusion)
- Account recovery + brand reputation risk
- Access confusion (Joe + Home Placer team both need admin, but Forturro's account is Joe's personal)

**Rule (standing, enforced):** All Home Placer accounts live under **carolina@hplacer.com** (the Home Placer ops email). This includes:
- Google Search Console (verified via sitemap submission)
- Google Business Profile (CID 3461988553332431879)
- Bing Webmaster Tools
- Bing Places for Business (claimed, pending PIN verify from Carolina)
- Cloudflare Registrar (once domain transfer completes)
- Priced Right Domains portal (dcc.secureserver.net, during domain transfer)

**Never use** `info@forturro.com` or `joe@forturro.com` for Home Placer infrastructure. If a tool autocompletes to Joe's email, override it.

### **Why Static Lead Capture, Not Real-Time Sync?**

`/api/lead` (the unified form endpoint) sends leads **instantly** to Follow Up Boss via the FUB `/v1/events` API. FUB auto-merges by email + phone (E.164-normalized), so a lead from the website lands in Joe's pipeline within 1-2 seconds.

**Why not a database queue?**
- **Workers can't write to filesystem** → no local queue
- **Cloudflare D1 (SQL)** would add complexity + cost for a simple async relay
- **HTTP 200 is the contract:** the form always succeeds from the user's perspective; if FUB is down, it's logged server-side + Joe reviews logs

**Why split delivery to FUB + email (Resend)?**
- **FUB is primary** (the CRM of record; leads feed automated workflows, task assignment, SMS)
- **Email is a safety net** → if FUB key is missing/expired, leads still land in `leads@hplacer.com` (manually workable; has happened during auth rotations)
- **Both are optional:** neither is required to deploy. The form works in dev (no secrets), "self-arms" when env vars are set (FUB_API_KEY, RESEND_API_KEY)

### **Why Pricing is Empty (Call for Pricing)?**

All 93 models currently show "Call for Pricing" (`data/home-pricing.json` and `data/setup-pricing.json` are empty `{}`). The UI, filters, and sorts **all support pricing** (already built, dormant).

**Why delay?**
- **Price is volatile:** Joe sets pricing per home, per lot, per buyer (financing, down payment, incentives). A hardcoded price in the site is stale within days.
- **Two-price model:** home-only price vs. full-package price (home + ¼-acre lot + setup + utilities). Both are context-dependent.
- **Minimal friction:** "Call for pricing" removes the anchor problem (a low quote online kills motivation; a high quote kills leads).

**To go live with pricing:** Joe sends price data → fill `data/home-pricing.json` (keyed by model slug) and `data/setup-pricing.json` (same keys). Redeploy. The site instantly shows prices + enables sort/filter by budget. The UI already handles missing prices gracefully.

### **Why Drywall Badge + Wall Finish Classification?**

Joe emphasized that **manufactured homes with full drywall interior** (not pre-finished gypsum panels + wall strips) are a premium selling point. Many buyers equate "manufactured" with cheap finishes; true drywall changes the perception + resale value.

**Implementation:**
- `data/models.json` each model has a `wallFinish` field: `"drywall"` | `"drywall-optional"` | `"strips"` (or omitted = default strips)
- `src/lib/homes.ts` exports `fullDrywallHomes()` — filters to only drywall homes
- Homepage + /homes page both show a **gold "Full Drywall" badge** on qualifying models
- Filters on /homes include "Full Drywall only" (checkbox)
- `series` field in models.json maps Plant (e.g., "Ultra Flex Oxford") → drywall qualification (build-models.mjs knows which series are drywall)

**Wording rule (Joe's correction):**
- Wall strips = "**pre-finished gypsum panels with a printed, wallpaper-like coating** + batten strips" (not "vinyl" or "VOG")
- Drywall = "site-built-quality full drywall interior"
- Skirting = "rock-vinyl skirting" (the exterior underpinning; real material, legit term)

### **Why Financing Line Emphasizes Conventional/FHA/VA/USDA?**

Manufactured homes sold **with land** (the full package) are real property, not chattels. They qualify for conventional mortgages, not short-term "mobile home" loans.

**Every financing reference** (homepage, /financing, /process, hero sections) emphasizes: "Conventional / FHA / VA / USDA financing available." This is **the biggest objection killer** for nervous first-time buyers who think manufactured = high-rate chattel loan.

Joe's rule: **always mention financing options when discussing packages.** It changes the math + the perception.

### **Why 52-Model Photo Refresh Was Critical?**

Of 93 models, only ~17 had real home photos from Joe's inventory. The other 76 showed manufacturer renders (often generic, low-quality, or watermarked). Joe's MLS photos (real homes he's placed, finished, with skirting + proper staging) are **the most persuasive asset** on the site.

**Lesson:** a home with a real photo of an actual placed home (skirted, finished, with landscaping) converts 3-5× better than a generic render. This is why best-sellers (52 Breeze, Stayin' Alive, etc.) all got photo refreshes. Took 2 sessions but was the single highest-ROI build-out.

**Photo sourcing method (reusable):**
1. Query Joe's Apple Photos library via Photos.sqlite: filter by scene `888` ("Motor Home" = his manufactured homes, not agent listings)
2. Export JPEG derivatives from `~/Library/Photos\ Library.photoslibrary/resources/derivatives/masters/`
3. Sort by date (≥ Aug 2023 = recent homes) + appearance rules (finished skirting, clear exteriors, no watermarks)
4. Match folder names to model slugs (e.g., "52 Breeze" → `ultra-flex-28-52`)
5. Import ~16 photos per model, lead with the skirted exterior (hero), sort -V for MLS photo order
6. `build-models.mjs` automatically uses local `public/models/<slug>/` photos if they exist (override manufacturer renders)

---

## SECTION 14: If I Were Continuing This Project

### **Next 30 Days (Blocking)**

1. **[URGENT] Pricing Numbers** — This is the #1 conversion blocker. Without prices, the site is a brochure. Joe must provide:
   - Home-only price per model (or range: low/high for different decor)
   - Full-package price per model + typical lot (can be a template: home + $15k land + $8k site work = X)
   - Financing examples (e.g., "Full package $225k, $20k down, 25-yr conventional = $850/mo at 6.5%")
   - Once dropped into `data/home-pricing.json` + `data/setup-pricing.json`, redeploy. Instantly 10x more conversion potential.

2. **[BLOCKING] Domain Transfer + HSTS** — The domain is locked in a GoDaddy reseller (Priced Right Domains). Transfer to Cloudflare Registrar (Joe's account, not Forturro's) is **50% done**: domain lock is OFF, but EPP code not yet retrieved + Cloudflare transfer not initiated. Steps:
   - Get the auth/EPP code from `dcc.secureserver.net` (carolina@hplacer.com login)
   - Initiate transfer in Cloudflare Home Placer account
   - Verify domain contact email (approval flow)
   - Enable HSTS (SSL/TLS edge cert) once live at CF (the site already forces HTTPS via 308 redirect; HSTS hardens this)
   - **Why it matters:** CF registrar is cheaper (~$10.44/yr), cleaner account, no GoDaddy junk, one place to manage DNS + registration

3. **[MEDIUM] Bing Places PIN Verification** — The listing (carolina@hplacer.com) was claimed but never PIN-verified. This locks all fields (hours, descriptions, etc.). Joe must:
   - Log in bing.com/forbusiness as carolina@
   - Find Home Placer listing
   - Click "Verify now"
   - Receive SMS to (843) 849-4663
   - Enter PIN
   - Fields unlock for editing

4. **[OPTIONAL] Apple Business Connect** — Joe's Apple ID was locked (security event or recovery issue). This is low-priority (Forturro has active GBP + reviews; HP's GBP is less critical). Revisit when/if Joe recovers the ID.

### **Next 60 Days (High-Value)**

5. **Blog Queue Refill** (~Aug 6, Gemini's cadence runs out)
   - Current: 36 posts queued, auto-publishing Mon & Thu, empties ~2026-08-06
   - Action: write ~12–18 more SEO posts (90-day cadence = ~36 posts). Topics: locations (Conway, Loris, Longs, Aynor, Myrtle Beach), financing (USDA, VA, conventional), buyer journey (what to expect, timeline, costs), objections (land quality, insurance, financing myths)
   - **Don't write posts yourself.** Joe or a freelance writer should. Claude can review + SEO-optimize before publishing.
   - Schedule them in `data/blog-posts.json` with future dates; the auto-publish task surfaces them on time.

6. **Modulars Catalog (Deferred)** — Joe's idea: add a "Modulars" section (Skyline, Commodore, other modular-manufactured brands). Educational page is done (`/modular-vs-manufactured-homes`). The inventory wasn't built. **Status:** Joe to decide if he stocks modulars; if yes, source data + photos, add to `data/models.json`, enable filtering. If no, leave the educational page (SEO value remains).

7. **Sapphire + Pearl Placed-Home Models** — Joe mentioned "Sapphire" and "Pearl" are models he's placed but they don't appear in the 93-model catalog. **Status:** unclear if they're discontinued (Clayton's website doesn't list them) or just missing from his data. Ask Joe: "Are Sapphire and Pearl still in your inventory? If so, send photos + specs and I'll add them."

### **Next 90+ Days (Optimizations)**

8. **GBP Photo Bank → Auto-Posting** (Optional, builds on existing work)
   - The site has 188 geo-tagged home photos bucketed by town (Conway, Loris, MB, Aynor, Longs) in `projects/hplacer/gbp-bank/<town>/` with captions ready
   - Forturro has an auto-poster (Back At You/SocialBAY) that posts to FB/IG/LinkedIn/X; could extend to **GBP via Forturro's scheduler** or build a separate **Claude scheduled task**
   - **Why it's valuable:** Posting 2-3 real HP photos per week to GBP feeds the algorithm + shows home-placement proof
   - **Blocker:** Posting to live GBP (CID 3461988553332431879) is public-facing → needs Joe's explicit approval per batch or a standing policy
   - **Implementation:** reuse scripts in `/tmp` (bucket.mjs, gbp_captions.mjs) or write a scheduled task that pulls 2 random from a town + posts to GBP API

9. **Semrush SEO Audit** (Optional, if budget opens)
   - Site Audit: identify technical SEO gaps in the Next 16 build (crawl, indexing, Core Web Vitals)
   - Competitor analysis: keyword + backlink gaps vs other SC manufactured-home dealers (Clayton Direct, Cavco, regional competitors)
   - Local rank tracking: monitor visibility in Horry + Georgetown for key terms (manufactured homes Myrtle Beach, home land package SC, etc.)
   - **Cost:** ~$140/mo (Pro) or $250/mo (Guru); overlaps the in-house GBP suite + Gemini SEO pass but adds hard competitor + technical data
   - **Decision:** Joe to decide if the insight is worth it

10. **IndexNow + Crawler Optimization** (Quick win, future-proof)
    - Currently: IndexNow pings Bing/Yandex/DuckDuckGo on blog publishes
    - **Next step:** ensure all major pages (model details, locations, content) are reindexed after significant updates. Extend `scripts/indexnow.mjs` to accept a specific model slug + reindex all its URLs (model detail + related pages)
    - **Opportunity:** schedule a quarterly full-site crawl + reindex to catch any structural changes

11. **Search Optimization on /homes** (Build + Refine)
    - Currently: search works (model name + sqft range + price range filters)
    - **Opportunity:** add **location awareness** — "Homes placed in Conway" (pre-filter by town), or "Which town are you interested in?" → shows town-specific recently-placed + location page
    - **Data ready:** `data/placements.json` already maps cities; `placed-homes.json` has city + placement date
    - **Low lift:** expose city in the search UI, filter model results on a location page (`/locations/[slug]`)

### **Risks to Never Forget**

- **Never re-run build-models.mjs after edits.** It will wipe hand-finalized `floorPlans` + `tourUrl` fields. The script is a one-time init; edit `data/models.json` by hand.
- **Never use fs.readFileSync outside build time.** OG images, logos, etc. must be statically imported or base64-inlined. Workerd = no filesystem.
- **Cloudflare throttling is transient.** Rapid concurrent crawls can return 503; always retry sequentially.
- **City reassignments are canonical in TWO places.** When reassigning a placed home to a new city (e.g., Rabbit Ln → Conway): update BOTH `placed-homes.json` (card display) AND `placements.json` (map dots). Mismatches cause data inconsistency.
- **Keep carolina@hplacer.com accounts golden.** Don't accidentally move HP stuff to Forturro accounts. It's been painful to fix.

### **Shortcuts for the Next Claude**

1. **Use the preview server**, not `npm run dev`:
   - Dev mode rebuilds the manifest every file change (slower)
   - `npm run preview` builds once, then reuses the build (faster iteration)
   - Or use the `.claude/launch.json` preview server (reads from the server task)

2. **Always run `npm run deploy` from the repo root** (not nested directories; wrangler expects clean paths).

3. **Test forms locally with env vars:**
   ```bash
   export FUB_API_KEY=YOUR_KEY RESEND_API_KEY=YOUR_KEY
   npm run dev
   ```
   This self-arms the delivery without touching the code.

4. **Blog scheduling via `data/blog-posts.json`:**
   - New post? Add to the array with a future `date` field (ISO format: "2026-07-15")
   - Commit it
   - The scheduled task will pick it up automatically on/after that date
   - No manual deploy needed (the task does it)

5. **For photo updates:**
   - Drop JPEGs into `public/models/<slug>/`
   - Rename them numerically (01.jpg, 02.jpg, etc.) — build-models.mjs sorts -V, so 01 is hero
   - Redeploy
   - The build auto-detects local photos + overrides manufacturer renders

### **Red Flags to Watch**

- **Pricing still empty after 60+ days:** escalate to Joe + provide a 30-min async video walkthrough of how to edit `data/home-pricing.json` + redeploy
- **Blog queue count ≤ 2:** the task warns; Joe must refill or the auto-publish stops
- **Model photo folder becomes a FILE:** this happened once (sips --out typo). Always `mkdir -p` the directory first.
- **FUB leads NOT landing:** check `npm run logs` (Cloudflare Workers logs) for FUB auth errors or response codes. The `/api/lead` route logs everything; errors ≤ 500 bytes are visible there.
- **OG image shows emoji or broken CDN URL:** never put emoji in ImageResponse; always use base64-inlined assets.

---

## SECTION 15: Session Memory & Non-Obvious Facts

### **The Bing-Under-Wrong-Account Incident (Why Carolina@)**

**What happened:** Initial setup (2026-06-21) ran Bing Search Console + Google Business Profile under `info@forturro.com` (Joe's Forturro business email). This caused:
- Bing to think HP was a Forturro property (mixed brand signals)
- Account recovery issues (only info@ had access, not Carolina/ops team)
- Joe's account getting locked during the setup

**The fix:** Moved everything to **carolina@hplacer.com** (the Home Placer ops email, managed by Tara Dufour + team). This is now a **standing rule:** all HP infrastructure lives under carolina@, never Joe's personal accounts.

**Why it matters:** Next engineer must NEVER accidentally move HP accounts back to Forturro. Always verify the email before logging in or transferring access.

### **The OG Image fs.readFileSync Failure**

**What happened:** opengraph-image.tsx originally tried to read the hero photo at **request time** using `fs.readFileSync` → worked locally (Node.js filesystem), but **failed with HTTP 500 in Cloudflare Workers production** (no filesystem at runtime).

**The fix:** Generate `src/app/og-hero.ts` at build time with the base64-encoded JPEG:
```ts
export const OG_HERO = "data:image/jpeg;base64,/9j/4AAQSk..."
```
Then import + render:
```tsx
import { OG_HERO } from "./og-hero"
<img src={OG_HERO} />
```

**Why it matters:** Next engineer must never write image/file logic that uses `fs` at request time. All assets must be statically imported or bundled into `.open-next/assets`.

### **The Double-Brand-Title Bug**

**What happened:** Some pages showed two brand names in the title (e.g., "Clayton Clayton Ultra Flex 28×68"). This was a concatenation bug in the page title generation.

**Current status:** Fixed (via canonicalization + per-page title overrides in the layout), but a good reminder: always test title tags for duplication + readability in browser tab + SERP previews.

### **Stale Snapshot False Positives**

**Context:** The deployment process uses OpenNext + wrangler. Cloudflare's cache behavior can sometimes serve stale snapshots if the Worker is redeployed mid-request. This is **transient** (resolve with a retry or hard refresh), not a data bug.

**Learning:** If a user reports "the old home photo is still showing" after a model photo update, it's usually Cloudflare cache, not a code problem. Tell them to hard-refresh (Cmd+Shift+R) or wait 60 seconds for the cache TTL to expire.

### **First-Touch Attribution (Recently Added)**

The `/api/lead` endpoint captures **first-touch attribution** data from the browser:
- UTM parameters (source, medium, campaign, content, term)
- gclid + fbclid (for Google/Facebook click tracking)
- Referrer (external traffic source)
- Landing page (first URL the visitor landed on)

This is forwarded to FUB as:
1. **A human-readable block appended to the message** (visible on the person's timeline in FUB)
2. **Native FUB event fields** (pageUrl, referrer, campaign) so Joe can segment by source

**Why it matters:** Joe can now see WHERE each lead came from (organic search, a Facebook ad, direct, etc.). This feeds future retargeting + ad spend optimization. The data is optional (clients without JS or in privacy modes just omit it), so form submission never fails.

### **The Theme Pink-vs-Slate Saga**

**Original plan:** Tailwind brand colors = pine green + amber (from figma mocks)  
**What actually deployed:** slate gray (stone-bg) + white + pink accents (after Joe's feedback on warmth + approachability)

**Current colors:**
- **Background:** stone/slate gray (`bg-stone-bg`, `text-stone-ink`)
- **Accents:** pink/rose tones (buttons, hover states, badges)
- **Hero sections:** charcoal (warm, inviting, not corporate cold)

**Why it matters:** If you're tweaking colors, use Tailwind's slate/stone/pink ramps, not arbitrary hex. Consistency matters for brand recognition. If Joe wants a different vibe (e.g., "less pink, more blue"), ask for Figma/screenshot feedback before implementing.

### **MLS Photo Sourcing & Joe's "Finished" Rule**

Joe emphasized: **always use a photo of the home AFTER setup is complete** (skirted, foundation, landscaping visible). A bare-lot or mid-construction photo looks cheap; a finished home looks like real property.

**His example:** Pegasus exception — the 2025-04-19 shoot used for the photo is pre-skirting (porch installed, but bare lot). A finished Pegasus with skirting exists (at GPS 33.937,-78.911, Conway dev), but the exact photo + date are unknown. Joe promised to send it, but hasn't yet.

**How to prioritize photos:** If Joe sends a batch of photos without hero designation, ask: "Which one is the skirted/finished exterior? That's the hero."

### **Carolina's Role (Evolving)**

Carolina (Ops Mgr, also Tara Dufour) is the point person for:
- Day-to-day sales inquiries (leads routed to her inbox)
- Team coordination (warranty calls, scheduling)
- FUB account maintenance (user setup, permissions, field edits)
- Google Business Profile moderation (responding to reviews)

She's NOT on the public team page (not an intentional omission; Joe hasn't specified her public role). If her name should appear, ask Joe.

### **The Paused Domain Transfer State**

**Current:** Domain registration is at Priced Right Domains (GoDaddy reseller); nameservers are ALREADY at Cloudflare (barbara.ns.cloudflare.com, gabriel.ns.cloudflare.com). This means:
- **DNS is live at Cloudflare** (the site resolves correctly)
- **Registration is NOT yet** (still at GoDaddy)
- **Transfer is 50% done:** domain lock OFF, EPP code NOT yet retrieved

**Why it's paused:** Cloudflare enforces one login session per account. Joe was in the Forturro Cloudflare account; to log into Home Placer's account (to initiate the transfer), he'd have to log out + back in. He deprioritized this in favor of shipping the live site.

**Next steps (for the next Claude or Joe):**
1. Log into `dcc.secureserver.net` (carolina@ login)
2. Find hplacer.com settings → "Transfer to Another Registrar" (NOT "Another Priced Right Account")
3. Get the auth/EPP code
4. Log into Cloudflare (Home Placer account, NOT Forturro's)
5. Domain Registration → Transfer Domains → hplacer.com → paste EPP → confirm contacts → pay (~$10.44, adds a year)
6. Approve confirmation email (to carolina@)

### **FUB Warranty Routing (Safe by Design)**

Every service request (`/api/lead` type "service") is handled carefully:
- **NEW contact (201):** assigned to warranty owner (Brett, user id 39) + collaborators (Joe 1, Tara 35, Wade 46)
- **EXISTING contact (200):** NOT reassigned (respects their current owner, usually their sales agent). Instead, a TASK is created for the warranty team so they see + follow up without stealing the contact.

This is **intentional:** Joe's rule = "never reassign a lead that already has a relationship owner." A customer who bought from Agent A but calls the warranty line should NOT be reassigned to Warranty Owner B; both should collaborate.

### **The Blog Auto-Publish Scheduled Task**

**Name:** hplacer-blog-publish  
**Schedule:** Mon & Thu, 6:10 AM  
**What it does:**
1. Check which posts are due today (date field = today)
2. If any, run `npm run deploy` (rebuild + redeploy the site)
3. Run `node scripts/indexnow.mjs` (ping Bing/Yandex/DuckDuckGo immediately so new posts index fast)
4. Report which posts went live + the live blog index count

**Queue status (2026-07-01):** 36 posts scheduled, empties ~2026-08-06. If ≤2 future posts remain, the task warns. Joe must refill the queue by 2026-08-06 or auto-publishing stops.

**Why it works:** The `date` field is evaluated at BUILD time. A post scheduled for 2026-07-15 is hidden until the site rebuilds on/after 2026-07-15. The scheduled task automates the rebuild, so posts surface on their date without human intervention.

### **IndexNow Ownership Verification**

The public file `public/e0e445eaf75d61f3faee17b699eca3b9.txt` (an empty 0-byte file) proves to IndexNow that we control hplacer.com. This key is stored in `scripts/indexnow.mjs` and submitted with every IndexNow API call. If this file is deleted or moved, IndexNow rejects future pings with a 403 "SiteVerificationNotCompleted" (retry later, it usually clears).

### **The Forturro Land-Search Crossover**

Homepage + `/land-packages` page both link to **`search.forturro.com/land`** — a deep-link into the Forturro Group's land-only search. This keeps land-seekers in-house (they might not need a home, but HP + Forturro both benefit if they find land to develop).

**Why it's there:** Joe's philosophy = "we are a land + home company; if a customer only needs land, keep them in the Forturro family." It's a soft partnership between the two businesses.

---

## SECTION 16: Final Checklist for the Next Claude

Before picking up a big task on hplacer.com, verify:

- [ ] **You've read this file in full** (or at least sections 10, 14, 15)
- [ ] **You've scanned HANDOFF.md** (live state, TODOs, account rules)
- [ ] **You've checked git log** (recent commits, deployment history)
- [ ] **You know the repo is committed** (no uncommitted files as of 2026-07-01; if adding photos/models, commit + push before closing the session)
- [ ] **You've verified carolina@hplacer.com logins** (GSC, GBP, Bing, registrar) are live + accessible
- [ ] **You understand that wrangler auth** (to Cloudflare Workers) is separate from the web login; re-auth if deploy fails with 401
- [ ] **You know the blog queue** (check `data/blog-posts.json` length; warn if < 5 future posts remain)
- [ ] **You've run the preview server**, not just `npm run dev`, for faster iteration
- [ ] **You test forms with FUB_API_KEY set** to verify leads land (don't just assume)
- [ ] **You never re-run build-models.mjs** after hand-editing models.json
- [ ] **You never use emoji in opengraph-image.tsx or any ImageResponse**
- [ ] **You always base64-encode new OG images** in `src/app/og-hero.ts`
- [ ] **You remember: Cloudflare workers = no filesystem** (all data bundled, all assets static/imported)

---

## Closing

Home Placer is a **lean, high-ROI site**: 130+ pages, 93 models, 36 blog posts, date-gated publishing, zero database, zero maintenance overhead. It lives in code + JSON, ships as static + server-side rendering on Cloudflare Workers at $5-10/mo.

The big blockers are **pricing numbers** (Joe's call) and **domain transfer** (waiting for Joe's availability). Everything else is incremental: blog queue, photos, Bing verification, optional GBP auto-posting.

**The next Claude's superpower:** ask Joe clarifying questions about pricing + any new models/photos, then build incrementally. Don't wait for perfect; ship, iterate, measure.

Good luck.

---

**File location:** `/private/tmp/claude-501/-Users-spencer/8faff905-2d22-4296-8f1e-4ff656f03134/scratchpad/08-CONTEXT.md` (29.8 KB, ready for the handoff package)
