# 07-ROADMAP.md — Home Placer Feature Roadmap & Dependencies

**Last updated:** 2026-07-01  
**Overview:** Feature roadmap, prioritized work buckets, known blockers, and dependency chains. Ground truth: see HANDOFF.md §4–5 for paused work and account rules.

---

## 9. Current TODO (Prioritized Roadmap)

The roadmap splits into five priority buckets, each with estimated timeline, implementation notes, and what it unblocks.

### 🔴 IMMEDIATE — Ship within 1–2 weeks (blocking other features)

#### 9.1 **Pricing data → unlock price sort + filters** (JOE)
- **Status:** BLOCKED (awaiting Joe)
- **What:** Fill in `data/home-pricing.json` and `data/setup-pricing.json` with actual numbers.
  - Both files currently empty (`{}`). Data structure: keyed by model slug.
  - Example:
    ```json
    {
      "ultra-flex-28-52": { "price": 245000, "setupPrice": 275000 },
      "horizon-32-52": { "price": 235000, "setupPrice": 265000 }
    }
    ```
- **Why now:** The price sort (lines 42–43 of `src/components/homes-browser.tsx`) and filter UI (lines 231–240) are already built, but dormant: they only work if `displayPrice(h)` returns a value (see `src/lib/home-types.ts:85–86`). Currently all 93 models fall back to "Call for pricing." Filling in the pricing data lights up the entire price-discovery flow on `/homes`.
- **Implementation:**
  - Prices go into JSON, not the database — `npm run deploy` sends them live.
  - Joe quotes home-only prices (`price` field) and full-setup quotes (`setupPrice`; preferred for display per line 86 of home-types.ts).
  - No re-run of `scripts/build-models.mjs` — edit the JSON files by hand.
  - After update, `npm run dev` locally to verify price sort/filters work; then `npm run deploy`.
- **Impact:** Unlocks lead capture on price-discovery path; conversion rates tied to pricing transparency.
- **Unblocks:** price sort in prod, price-range filtering on `/homes`.

#### 9.2 **Domain transfer: hplacer.com registration → Cloudflare Registrar** (JOE)
- **Status:** PAUSED (domain lock is OFF; awaiting Step (1) below)
- **What:** Move registration from **Priced Right Domains** (GoDaddy reseller at `dcc.secureserver.net`) to **Cloudflare Registrar** (at-cost). DNS is already on Cloudflare (nameservers barbara/gabriel.ns.cloudflare.com), so the site is unaffected; this is purely registration.
- **Steps:**
  1. **Priced Right Domains:** hplacer.com settings → **"Transfer to Another Registrar"** → get **auth/EPP code**. ⚠️ **Domain Privacy is ON** (Domains By Proxy) — may need to toggle OFF first to see the transfer option. Approval email → joe@forturro.com.
  2. **Cloudflare (Home Placer account):** Domain Registration → **Transfer Domains** → hplacer.com → paste EPP → confirm contacts → **pay** (~$10.44/yr at cost; adds a year). Confirm before paying.
  3. Approve the confirmation email.
- **Blocker:** Cloudflare only allows **one account login at a time**, and Joe was in Forturro's CF account. Solution: sign out of Forturro's CF account first, then log into Home Placer's CF (zone hplacer.com).
- **Timeline:** ~10 min hands-on work; ~1–2 hrs for domain to settle at CF.
- **Unblocks:** HSTS hardening (see 9.3 below).
- **References:** HANDOFF.md §4A, CF registrar dashboard.

#### 9.3 **Enable HSTS** (auto after domain lands at Cloudflare)
- **Status:** PAUSED (blocked by 9.2)
- **What:** Configure HSTS (HTTP Strict Transport Security) to force HTTPS at the browser level for all future requests, even if a visitor types `http://hplacer.com`. (The site already forces HTTPS via 308 redirect + valid TLS 1.3 cert; HSTS is a hardening, not a blocker.)
- **Implementation:** Cloudflare dashboard → SSL/TLS → Edge Certificates → scroll to "HSTS" → Enable with max-age ≥ 31536000 seconds (1 year). Standard practice: include subdomains, preload list optional.
- **Timeline:** 1 min; takes effect ~5 min.
- **Why:** SEO + security best practice (Google favors it; users are more protected from downgrade attacks).
- **Dependencies:** Must happen **after** domain transfer (9.2) so Cloudflare Registrar owns the domain and can issue HSTS headers.

#### 9.4 **Bing Places PIN verify** (JOE)
- **Status:** CLAIMED, PIN pending
- **What:** Finish verifying the Bing Places listing for Home Placer (already claimed under carolina@hplacer.com; correct NAP, "Mobile home dealer", hours).
- **Steps:**
  1. Go to **bing.com/forbusiness** → log in as carolina@hplacer.com → find "Home Placer" listing.
  2. Click **"Verify now"** → Phone/SMS verify to (843) 849-4663 (business phone).
  3. Enter PIN when it arrives.
  4. Fields unlock; you can now edit hours, description, and upload photos.
- **Timeline:** ~5 min + waiting for the SMS PIN.
- **Unblocks:** full Bing Places profile (photos, hours, business description, call-to-action buttons); leads from Bing local search.
- **References:** HANDOFF.md §4B.

### 🟡 NEXT SPRINT — Weeks 3–4

#### 9.5 **Blog queue refill** (JOE + Gemini/Claude)
- **Status:** ACTIVE → needs content
- **Current state:** 36 posts published + scheduled through ~**2026-08-06**. Auto-publishing runs 2×/week (Mon & Thu) via the `hplacer-blog-publish` scheduled task (runs `npm run deploy` + pings IndexNow). Queue then goes dry.
- **What:** Write ~12 more SEO posts to maintain the 90-day / 2×/wk cadence (Gemini's original plan). Candidates:
  - Land-ownership topics (owned vs. leased, real property vs. personal property, land-lease parks vs. owned-land communities)
  - Location deep-dives (Conway, Surfside, Aynor neighborhoods; USDA eligibility pockets)
  - Financing guides (FHA 3.5% down, VA zero-down, USDA zero-down, conventional; what "pre-approval" means)
  - Objection-led content ("won't the HOA reject it", "how do I know it'll pass permitting", "what if I can't get financed")
  - Buyer-journey content (timeline from first tour to move-in; how to tour a model home; questions to ask before buying)
- **Implementation:**
  - Write + SEO-review each post (see memory file `feedback_seo_geo_gemini.md` for the pass checklist).
  - Use `scripts/build-blog.mjs` to ingest + gate by future date (dates in the script, lines 12–13, control when posts surface).
  - Commit to `data/blog-posts.json` + deploy.
  - After Aug 6, schedule the next batch of 12 posts to cover another ~90 days (or set up a recurring Claude workflow to write + deploy 2 posts/week).
- **Timeline:** ~3–4 weeks (1–2 posts/week).
- **Why:** Blog is driving SEO and topical authority; queue is the funnel. Refill now = organic lead-gen stays healthy through Q3.
- **Unblocks:** sustained blog traffic; topical authority on "affordable manufactured homes SC".
- **References:** HANDOFF.md §3, memory `project_hplacer_rebuild.md` for past 36 posts.

#### 9.6 **Apple Business Connect recovery** (JOE)
- **Status:** PAUSED (Joe locked out of Apple ID)
- **What:** Unlock Joe's Apple ID or create a Home Placer Apple ID, then claim/complete the Business Connect listing.
  - `businessconnect.apple.com` → Maps place-card under the Maps icon on Apple's app.
  - Listing shows phone, hours, photos, reviews (pulled from Yelp cross-post + first-party).
- **Steps:**
  1. Joe recovers or creates an Apple ID tied to Home Placer (not personal).
  2. Go to `businessconnect.apple.com` → sign in → find "Home Placer" listing → claim.
  3. Verify ownership (email or phone PIN), complete profile (hours, photos, description).
- **Timeline:** Once Apple ID is live, ~10 min to claim + fill profile.
- **Why:** Apple Maps + Spotlight search = local discovery for iOS users (significant market share in affluent buyer segments on the Grand Strand).
- **Unblocks:** Apple Maps listing, Siri results, Apple Business Search.
- **Dependencies:** Joe's Apple ID recovery (external).
- **References:** HANDOFF.md §4C.

### 🟢 FUTURE ENHANCEMENTS — Post-Aug 6

#### 9.7 **Modulars catalog** (DEFERRED by Joe)
- **Status:** DEFERRED (not a revenue priority yet)
- **What:** Build out an inventory of modular homes (factory-built to local building code, not HUD Code). Educational page exists (`/education/modular-vs-manufactured`); no catalog yet.
- **Why deferred:** Joe's priority is manufactured-home placement (HUD Code, lower cost entry). Modulars are a smaller, higher-margin subset; Joe chose to defer until manufactured homes are the market leader.
- **When:** Revisit Q3 2026 if Joe wants to expand into modular offerings.
- **References:** HANDOFF.md §5, models.json (currently only manufactured homes).

#### 9.8 **Sapphire + Pearl placed-home models** (DEFERRED)
- **Status:** INVENTORY ONLY (models exist in catalog, no recent placements)
- **What:** Sapphire and Pearl are premium placed-home models from Clayton; they exist in `/homes` but have no entries in `placed-homes.json`. Adding them would diversify the "recently placed" showcase.
- **Why deferred:** Joe's focus is on mid-tier Clayton/Cavco/Champion (low $200s) placements. Sapphire/Pearl are higher-priced, lower-volume. When inventory shows more of them placed, add to showcase.
- **When:** As placements come in.

#### 9.9 **Resend email backup for leads** (OPTIONAL)
- **Status:** NOT CONFIGURED (optional)
- **What:** Set `RESEND_API_KEY` as a Cloudflare Worker secret so every lead that lands in Follow Up Boss also sends an email to leads@hplacer.com. Currently leads DO reach FUB (api/lead route works), but no email copy.
- **Implementation:**
  1. Get Resend API key from resend.com → API Keys.
  2. Set as Cloudflare Worker secret: `wrangler secret put RESEND_API_KEY`.
  3. Redeploy: `npm run deploy`.
  4. Code already handles it (see `src/app/api/lead/route.ts` — Resend call is guarded by `if (process.env.RESEND_API_KEY)`).
- **Timeline:** ~5 min setup.
- **Why:** Team email backup (useful if FUB has an outage, or for email audit trail). Not critical since FUB is the primary system.
- **References:** `.env.example`, HANDOFF.md §3.

#### 9.10 **Live-inventory IDX feed** (FUTURE)
- **Status:** NOT STARTED
- **What:** Real-time MLS sync from an IDX provider (e.g., Paragon, Fathom, HomeLight) → synced to `/recently-placed` and map. Currently placed-homes.json is hand-curated; live feed would auto-populate + auto-expire as homes are sold.
- **Why deferred:** Joe's current workflow is manual (Python script extracts from Paragon CSV, curated to ~73 homes). Automating would require API integration + webhook receiver on Cloudflare Workers (feasible, not urgent).
- **When:** If lead volume grows and manual curation becomes a bottleneck.

---

## 12. Dependencies Between Features

Feature launch order matters. Below is the dependency graph (what must complete before what):

### Critical Path (blocking others)

```
Domain transfer (9.2)
  ├→ HSTS (9.3)
  └→ SEO confidence (affects crawl patterns)

Pricing data (9.1)
  ├→ Price sort + filters go live on /homes
  ├→ Conversion funnel (discovery → leads)
  └→ Follow-up messaging ("starting at $X")

Blog queue refill (9.5)
  ├→ SEO topical authority (long-term)
  ├→ Organic lead funnel (continuous)
  └→ Team content workload (if manual, needs scheduling)
```

### Non-blocking (can run in parallel)

- Bing Places verify (9.4) — independent; improves local discovery but doesn't affect site.
- Apple Business Connect (9.6) — independent; same as Bing.
- Email backup (9.9) — independent; nice-to-have after FUB works.
- Modulars/Sapphire/Pearl (9.7–9.8) — independent; Joe's choice to defer.

### Sequencing logic

| Phase | Feature | Reason | Timing |
|-------|---------|--------|--------|
| **Week 1** | 9.1 (Pricing), 9.2 (Domain), 9.4 (Bing PIN) | High-impact, unblock others. | ASAP |
| **Week 2** | 9.3 (HSTS after domain settles), 9.6 (Apple ID recovery) | Dependent on earlier work or external. | ~48 hrs after 9.2 |
| **Weeks 3–4** | 9.5 (Blog refill) | Continuous content needed by Aug 6; start now. | Immediate |
| **Q3+** | 9.7–9.10 (Future enhancements) | Low urgency; revisit based on business need. | TBD |

---

## TECHNICAL DEBT & KNOWN BUGS

### Inherited gotchas (don't relearn these)

See HANDOFF.md §7 for full list. Highlights:

1. **next/og OG images:** workerd (Cloudflare runtime) has no fs → OG hero photo is inlined as base64 in `src/app/og-hero.ts`, imported by `src/app/opengraph-image.tsx`. Any `fs.readFileSync` → HTTP 500 in prod + missing og:image. To change the photo, regenerate og-hero.ts (resize to 1200w @ q62 + base64 inline).

2. **models.json edit rules:** Never re-run `scripts/build-models.mjs` — it omits floorPlans/tourUrl and wipes hand-finalized fields. Edit `data/models.json` by hand.

3. **Blog date-gating:** Future-dated posts in `blog-posts.json` are hidden until their date; a redeploy on/after the date surfaces them. See `src/lib/blog.ts`.

4. **Cloudflare throttling:** Rapid concurrent crawls of hplacer.com return transient 503s (not real errors). Retry sequentially.

5. **JSX whitespace:** Inline `</strong>`/`</a>` followed by text on the same line strips the space → use `{" "}` after closing tags. Example: `<strong>bold</strong>{" "}word` renders as "bold word", not "boldword".

### Open issues & workarounds

#### One-login-at-a-time (Cloudflare account switching)
- **Issue:** Cloudflare only allows one account to be logged in per browser. If Joe is in Forturro's CF account, he must sign out before accessing Home Placer's account.
- **Workaround:** Use separate browsers/profiles (Chrome profile 1 = Forturro, profile 2 = Home Placer).
- **Permanent fix:** Not available at CF level; workaround is the standard practice.

#### Apple ID lockout
- **Issue:** Joe is locked out of his personal Apple ID (used for Business Connect).
- **Status:** External to codebase. Joe needs to recover via Apple ID account recovery flow or create a new Home Placer Apple ID.
- **Unblocks:** Business Connect claim (9.6).

#### Pricing gating conversion
- **Issue:** All 93 models show "Call for pricing"; conversion rates are lower for price-transparent competitors.
- **Status:** Blocked on Joe providing numbers (9.1).
- **Workaround:** Lead capture still works; FUB receives all inquiries (even "call for pricing" clicks).
- **Impact:** Estimated 15–25% lift in conversion once pricing is live.

---

## NICE-TO-HAVE (not on roadmap)

- Seller financing / rent-to-own options (business model decision, not tech).
- Trade-in appraisal calculator (depends on partnering with a lender).
- Virtual 3D tour builder (most models have Matterport links already in tourUrl).
- Automated phone-lead routing (would need Twilio + CRM integration; FUB handles current volume).
- Multi-language site (Spanish) — Spanish-speaking market exists around Myrtle Beach, but Joe's priority is English-first.

---

## Deployment & Rollout Strategy

### 9.1 Pricing rollout
- **QA steps:** Run `npm run dev`, browse `/homes`, verify price sort/filters respond correctly.
- **Deployment:** `npm run deploy` (builds + deploys to Cloudflare Workers).
- **Monitoring:** Check IndexNow ping fires (verifies deploy succeeded). Spot-check a few home detail pages to confirm prices display.

### 9.2–9.3 Domain + HSTS
- **QA:** Test domain resolves to Cloudflare IP before and after transfer.
- **Deployment:** Domain transfer is manual (registrar); HSTS is a toggle in CF dashboard (no code change).
- **Monitoring:** DNS propagation checker (whois.net); HSTS header check (curl -I https://hplacer.com | grep Strict-Transport-Security).

### 9.4–9.6 Local business listings (Bing, Apple)
- **QA:** Verify phone number formats, hours, address all match GBP (Google Business Profile; source of truth).
- **Deployment:** Manual profile updates on Bing/Apple dashboards (no code).
- **Monitoring:** Check listings surface correctly in local search results; monitor for review/rating changes.

### 9.5 Blog queue refill
- **QA:** Proofread new posts; run SEO pass (Gemini review); date-gate correctly in `build-blog.mjs`.
- **Deployment:** Add posts to `data/blog-posts.json` (hand-edit or via `build-blog.mjs`), commit, push, `npm run deploy`.
- **Monitoring:** Analytics watch (GA4 session duration, pages/session on blog posts); verify posts surface on correct publish date.

---

## Resources & References

- **HANDOFF.md:** §4 (paused work), §5 (open TODOs), §7 (gotchas).
- **Memory files:** `project_hplacer_rebuild.md` (full project log), `feedback_seo_geo_gemini.md` (SEO review checklist).
- **Stack:** Next.js 16.2.9, React 19, Tailwind v4, Cloudflare Workers (OpenNext).
- **Deployment:** `npm run deploy` (build-manifests → opennextjs-cloudflare build → deploy).
- **Data files:** `data/models.json` (93 models), `data/placed-homes.json` (73), `data/blog-posts.json` (36 posts).
- **Pricing files:** `data/home-pricing.json`, `data/setup-pricing.json` (currently empty; see 9.1).
- **Scheduled task:** `hplacer-blog-publish` (if re-creating on new machine: runs `npm run deploy` + `scripts/indexnow.mjs` 2×/week Mon/Thu).

---

**Prepared for:** Seamless handoff to another engineer or Claude with zero context.  
**Last verified:** 2026-07-01 (code + account state).
