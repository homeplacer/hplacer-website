# Home Placer — Website + Backend Deep Dive · FINAL REPORT

*Investigation + planning pass, 2026-07-09. Read-only — no production changes, no deploy.
This is the executive roll-up; each section points to a detailed companion doc in this folder.
Priority legend in `README.md`.*

---

## 1. Executive summary

Home Placer's website is **already good** — genuinely above the bar for a manufactured-home
dealer. It's a Next.js 16 site on Cloudflare Workers with ~240 prerendered pages, a deep
education layer (comparison pages, glossary, 22-item FAQ, 36 blog posts, 27 town pages), a
clean money-first homepage, and a **well-engineered lead pipeline** (`/api/lead` → Follow Up
Boss with retries, safe warranty routing, first-touch attribution, and a no-silent-loss
marker). **Typecheck and lint both pass. There are no P0 broken-code bugs.** A prior Claude
("Builder-Claude") already completed a Phase-0 hardening cycle (11 PRs) and documented it well.

The company is **not held back by its code — it's held back by business inputs and a few concrete
claim/consistency issues**:

- **No prices.** All 93 homes show "Call for pricing" (pricing files are empty). Biggest conversion drag. *(NEEDS JOE)*
- **No privacy policy / consistent consent.** Legal exposure **and** it blocks Google Ads. *(P0)*
- **No landowner/seller path** — the future lead type the business wants has zero route. *(NEEDS JOE)*
- **A visible bug:** NC town pages/footers render ", SC". *(P1)*
- **Claim inconsistencies** to reconcile: "Licensed in SC & NC" (unverified), warranty "1-year vs 2-10", "7 reviews" but 3 shown.
- **Reliability debt** already on the team's radar: ~950 hotlinked manufacturer images (no fallback) and a runtime unpkg Leaflet script.
- **The lead safety-net alert is unwatched** — wire it before turning on traffic.

Bad-lead (renter/tenant) risk is **low** — the content actively repels that audience. One watch item (the Forturro "Browse all listings" link). The backend roadmap is sound; **don't start it until live pricing + real traffic validate demand, and don't rebuild the CRM that Follow Up Boss already provides.**

## 2. Current system map

Full detail: **`current-system-map.md`**. In one line: Next.js 16 / React 19 / Tailwind 4,
deployed to **Cloudflare Workers via OpenNext** (not Vercel — the README is stale), static-JSON
data edited by redeploy, **no database / auth / admin**, one API route (`/api/lead` → FUB +
optional Resend), GA4 + IndexNow + a Forturro MLS cross-over. FUB is the CRM.

## 3. What appears to be working (don't touch)

- **Lead pipeline** — retries/backoff, E.164 phone normalization, safe warranty routing that never
  steals an owned lead, first-touch attribution on every form, `CRITICAL LEAD_NOT_DELIVERED` marker.
- **Security surfaces** — HTTPS middleware, security headers, markdown-XSS sanitized, JSON-LD escaped,
  `/api/lead` payload/field caps; no secrets committed.
- **SEO plumbing** — unique titles + self-canonicals everywhere, complete sitemap, broad valid schema,
  AI-crawler-friendly robots, `llms.txt`.
- **Education & trust content** — 4 comparison pages, glossary, deep FAQ, 36 posts, real reviews wired
  to schema, team page, "recently placed" proof with a map.
- **Accessibility baseline** — modals with focus trap/restore/Esc/scroll-lock; labeled controls.
- **"Call for pricing" handled gracefully** — each unpriced home becomes a lead-capture moment.
- **Quality gates green** — `tsc --noEmit` + `eslint` both pass.

## 4. Critical bugs / issues (P0)

There are **no P0 code bugs**. The P0s are **operational/legal**:

1. **Unwatched lead-failure marker** — if secrets are unset/invalid at go-live, every lead becomes an
   unread log line. Wire an alert first. *(lead-flow L1; NEEDS ACCESS: Cloudflare)*
2. **No privacy policy / TCPA-grade consent** — collecting PII + running GA with no policy; consent is
   inconsistent fine print. Legal exposure + blocks Google Ads. *(compliance C-1/C-2)*
3. **[External finding — flagged by a concurrent session, not this pass] OpenNext no-op cache.**
   A separate session's `OPENNEXT-CACHE-AUDIT.md` (repo root, untracked) reports that
   `open-next.config.ts` uses `defineCloudflareConfig()` with **no incremental cache** → the
   adapter falls back to the `"dummy"` cache, so every request re-renders the full page in the
   Worker (claimed ~23% cache rate, ~366 ms CPU P90, and `1102` "Worker exceeded CPU" errors under
   load). **I verified the config line (`open-next.config.ts:6`); I did *not* verify the live
   metrics** — those are that session's. If accurate, this is a **P0 live-performance issue** with a
   claimed one-file fix (`static-assets-incremental-cache`). **Do not action blindly** — it belongs
   to the other session; coordinate before anyone edits `open-next.config.ts`. See §"Coordination note".

## 5. High-priority fixes (P1)

1. **NC towns render ", SC"** — `locations/[slug]:77,175`, `site-footer:128`, `land-packages:105`; fix via `getCounty(loc.countyKey)?.stateAbbr`. *(website / SEO-1)*
2. **"Licensed in SC & NC" unverified** — reconcile vs. SC-only source of truth; show license number(s). *(website / compliance C-5)*
3. **Warranty contradiction** — `/warranty` says "2-10"; everywhere else says "1-year." Reconcile to the verified truth. *(compliance C-4)*
4. **Hotlinked images: no `onError` fallback** — a CDN 404 shows a broken-image icon. *(technical B2)* And, larger: **mirror the ~950 images to R2** *(R1 — keystone; unlocks CSP tightening + perf)*.
5. **Self-host Leaflet** — drop the runtime unpkg script. *(technical R2)*
6. **Reviews mismatch** — "7 reviews / 5.0★" advertised, 3 shown; sync to live GBP; drop the off-message testimonial. *(compliance C-7 / website)*
7. **Lead spam protection** — add a honeypot + light rate-limit to `/api/lead`. *(lead-flow L2)*
8. **Landowner/seller intake** — a page + form + distinct FUB tag (cheap; serves a stated goal). *(needs J2)*

## 6. Medium-priority improvements (P2)

Rewrite `DEPLOY.md`/`README` for Cloudflare (currently point an operator at Vercel — genuinely
risky); fix the one `http://` image; add `FAQPage` to `/land-packages` + `ItemList` to `/homes`;
surface education/locations in nav + a sticky "Get your price" CTA; internal-link pass (Loris/Longs/
Aynor + location↔money-page + topical blog links); click-to-text if the line is SMS-capable; sitemap
`lastModified` from content; purge stale GitHub-Pages/Vercel comments + dead `BASE_PATH`; update the
stale About-page stats. *(details across website / technical / SEO docs)*

## 7. Low-priority / nice-to-have (P3)

Double-submit guard + phone `pattern` on all 5 forms; 44px hamburger tap target; `aria-pressed` on
brand/width filter tabs; gate GA to prod + drop the no-op `anonymize_ip`; `width`/`height` on gallery
images (CLS); `aria-hidden` on decorative icons; iframe tour-host allowlist at build time; pin `marked`;
delete leftover Next starter SVGs in `public/`. *(technical audit)*

## 8. Backend / admin opportunities

Full detail: **`backend-opportunities.md`**. Two governing truths: **(a)** launch-readiness before
platform build (D-HP-002) — most backend is "useful later, trigger = validated demand"; **(b)** FUB is
already the CRM — **don't rebuild leads/pipeline/tasks/notes in-app.** Sequencing: *around launch* —
missed-lead alerting + the light landowner intake; *Phase 1* — D1 → Auth/RBAC → `/api/v1` → **Admin UI
for inventory + pricing** (kills the redeploy bottleneck; the keystone); *Phase 2* — **Package Builder**
+ financing estimator + quotes; *Phase 3–4* — construction/permit/delivery/closing trackers + document
checklist + customer portal (where a land-home dealer actually loses time). **Do not build:** a second
CRM, a custom analytics dashboard pre-spend, customer SMS/email without approval, or multi-tenant SaaS.

## 9. SEO / content opportunities

Full detail: **`seo-content-opportunities.md`**. Plumbing is excellent; gaps are strategic:
a **landowner "sell/develop your land" hub** (biggest; needs J2), a **Horry County hub page**, a
browsable **"available now"** page (needs a live MLS feed), `FAQPage`/`ItemList` schema wins, an
internal-linking pass (Loris/Longs/Aynor are under-linked), and topical blog interlinking. Coverage
table shows most buyer queries are already **Covered**; the **Gaps are all seller/landowner + live
availability.**

## 10. Lead-flow gaps

Full detail: **`lead-flow-audit.md`**. The pipeline core is strong; gaps are at the edges: unwatched
failure marker (P0), no bot protection (P1), inconsistent consent + no privacy link (P1, compliance),
double-submit only button-guarded (P2), no customer autoresponder (parked — needs approval), no
seller/landowner lead type/routing (P2), and no offline-conversion loop back to Ads (P2, later). No
in-app visibility — everything lives in FUB, so **verify FUB automations exist for every source/tag.**

## 11. Compliance / legal-review flags

Full detail: **`compliance-review-flags.md`** (13 flags; not legal advice). **P0:** privacy/terms +
TCPA consent. **P1:** financing "$0 down" ad language, warranty 2-10 substantiation, license numbers/NC,
"placed & sold" MLS accuracy + data-use, 7-vs-3 reviews. **P2:** monthly-payment offers, "apply for
financing" wording, "every home qualifies," Fair-Housing pass on "family" copy, GA consent, RESPA on the
Forturro referral. **Verified fine:** wall-finish wording, "not a lender" disclaimer, HUD mobile-vs-
manufactured accuracy, hedged pricing, no rental/property-management wording anywhere.

## 12. Bad-lead risks

**Low.** No `for rent`/`rental`/`tenant`/`rent-to-own` surface exists (grep-confirmed); the content
actively frames *against* renting ("we've never put a family on leased land, and we never will"). Two
notes: the "mobile home" SEO term pulls some rent/park intent but pages pivot to ownership (right call —
add renter negative keywords in any Ads campaign), and the **Forturro "Browse all listings" link is
unfiltered** — confirm it doesn't surface rentals (J9). When the seller path is built, give it its own
lead type so owner leads don't blend into buyer leads.

## 13. Questions for Joe

Full list: **`questions-for-joe.md`**. Top of the pile: **prices (J1)**, **landowner offer (J2)**,
**NC license reality + number (J3/J4)**, **warranty truth (J5)**, **real reviews (J6)**, **SMS-capable
line? (J7)**, **approve the privacy/consent layer (J10)**. Access blockers: Cloudflare, FUB, GSC/GA4,
GBP, MLS feed, registrar.

## 14. Recommended build queue

Full list: **`approved-build-queue.md`** — **currently all `PROPOSED`, nothing approved.** Nothing gets
built until Joe moves an item to `APPROVED`. Recommended order starts: (1) lead-failure alert, (2)
privacy/consent, (3) NC-"SC" fix, (4) license claim, (5) warranty reconcile, (6) image `onError`, (7)
review sync, (8) spam protection, (9) landowner intake — then the P2 batch, then the image-mirroring +
Leaflet reliability keystone.

## 15. Parking lot

Full list: **`parking-lot.md`**. Deferred (not lost): customer SMS/email autoresponder + review-request
(need approval), Package Builder + financing estimator (Phase 2), construction/permit/closing trackers +
portal (Phase 3–4), custom reporting/attribution dashboard, offline-conversion export, modulars catalog,
CSP enforce (blocked on image mirroring), multi-tenant SaaS (out of scope).

## 16. Suggested next Claude sessions

Sequenced so each is self-contained and respects "no build until Joe approves":

1. **Session A — Launch-blocker code fixes (no Joe input needed):** NC-"SC" bug, image `onError`
   fallback, `/api/lead` spam protection, `DEPLOY.md`/`README` Cloudflare rewrite, `http://` image,
   `FAQPage`/`ItemList` schema, sitemap `lastModified`, stale-comment purge. Safe, high-signal, unblocked.
2. **Session B — Compliance layer:** privacy policy + terms + standardized consent (with legal review;
   gated on J10). Unblocks Google Ads.
3. **Session C — Go-live truth pass:** load pricing (J1), reconcile warranty (J5), sync reviews (J6),
   resolve the license claim + show the number (J3/J4). Turns the dormant price sort/filter on.
4. **Session D — Landowner/seller funnel:** page + form + FUB routing + SEO hub (gated on J2).
5. **Session E — Reliability keystone:** mirror the ~950 images to R2, self-host Leaflet, then promote
   CSP to enforcing.
6. **Session F — Ops hardening (needs Cloudflare/FUB access):** wire the lead-failure alert, verify FUB
   automations, set/verify secrets, finish domain + HSTS.
7. **Session G — (later, only when traffic validates demand) Phase 1 platform design:** D1 schema +
   Auth/RBAC + `/api/v1` + Admin UI — brought as a design for review *before* feature code (D-HP-005).

---

## Coordination note (important)

During this audit, two untracked files appeared/were-updated in the repo root at ~15:44 that are
**not** part of this pass: `OPENNEXT-CACHE-AUDIT.md` (names a different session — "Home Placer
Website Stabilization / OpenNext Cache Audit") and `LAUNCH-READINESS.md` (an earlier Builder-Claude
report). This strongly implies **another Claude session is working the same working tree
concurrently.** Because **deploys build from the working tree, not git** (`HANDOFF.md:68`), two
sessions editing the same tree can clobber each other or ship half-finished work. **Recommendation:**
before any build session, confirm with Joe which session owns what, and consider committing/branching
to isolate work. This audit deliberately left both files untouched.

---

*End of report. Per the operating rules: no features were built, nothing was deployed, no external
communications were sent. The only changes this pass are the markdown files in `docs/homeplacer-ideas/`
(and both pre-existing untracked root files were left untouched). Await Joe's decisions before any
build session.*
