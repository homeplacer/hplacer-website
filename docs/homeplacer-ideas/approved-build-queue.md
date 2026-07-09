# Approved Build Queue

> ⛔ **NOTHING HERE IS APPROVED YET.** Per the audit's operating rules, this file stays a
> **candidate** list until Joe explicitly moves an item into "Approved." A rough idea in this
> folder is **not** a build task. No feature work starts until Joe says go.

**How an item graduates:** Joe reviews the candidates below (and `questions-for-joe.md`),
answers any gating question, and changes an item's **Status** from `PROPOSED` to `APPROVED —
<date>`. A future Claude build session should build **only** `APPROVED` rows, top of the list first.

## Candidate queue (PROPOSED — recommended order)

Each row is scoped to be build-ready. Full detail lives in the linked audit doc.

| # | Item | Sev | Status | Gated by | Source |
|---|---|---|---|---|---|
| 1 | **Wire an alert to `CRITICAL LEAD_NOT_DELIVERED`** (Logpush/Tail → email/Slack, or a Worker Queue outbox) | P0 | PROPOSED | A1 (Cloudflare) | lead-flow L1 |
| 2 | **Privacy Policy + Terms pages + standardized form consent** (drafted w/ legal; link from footer + all 5 forms) | P0 | PROPOSED | J10 + legal | compliance C-1/C-2 |
| 3 | **Fix NC towns labeled ", SC"** — `getCounty(loc.countyKey)?.stateAbbr` at `locations/[slug]:77,175`, `site-footer:128`, `land-packages:105` | P1 | PROPOSED | J3 (confirm NC scope) | website P1 / SEO-1 |
| 4 | **Resolve the "Licensed in SC & NC" claim** — verify NC license; show license number(s); reconcile copy | P1 | PROPOSED | J3, J4 | website P1 / compliance C-5 |
| 5 | **Reconcile the warranty story** (1-yr vs 2-10) across all pages to the verified truth | P1 | PROPOSED | J5 | compliance C-4 |
| 6 | **Add `onError` placeholder fallback to all hotlinked `<img>`** | P1 | PROPOSED | — | technical B2 |
| 7 | **Sync reviews** — show all real GBP reviews; make `reviewCount`/rating match live GBP; drop off-message testimonial | P1 | PROPOSED | J6 | compliance C-7 / website |
| 8 | **Add a honeypot + light rate-limit to `/api/lead`** (spam protection) | P1 | PROPOSED | — | lead-flow L2 |
| 9 | **Landowner/seller intake page + form + distinct FUB tag/routing** | P1 | PROPOSED | J2 (define offer) | website P1 / SEO / lead-flow |
| 10 | **Rewrite `DEPLOY.md` + `README.md` for Cloudflare** (currently describe Vercel) | P2 | PROPOSED | — | technical D2 |
| 11 | **Fix the `http://` model image → `https://`** (`dutch-elite-1676-01`) | P2 | PROPOSED | — | technical B1 |
| 12 | **Add `FAQPage` schema to `/land-packages`; `ItemList` to `/homes`** | P2 | PROPOSED | — | SEO-2/SEO-4 |
| 13 | **Nav: surface education + locations; add a sticky "Get your price" CTA** | P2 | PROPOSED | — | website P2 |
| 14 | **Internal-link pass** — Loris/Longs/Aynor into footer; location↔money-page + blog↔topical links | P2 | PROPOSED | — | SEO internal-linking |
| 15 | **Add click-to-text (`sms:`)** next to click-to-call | P2 | PROPOSED | J7 | website P3 / lead-flow |
| 16 | **Sitemap `lastModified` from content; purge stale GH-Pages/Vercel comments + dead `BASE_PATH`** | P2/P3 | PROPOSED | — | technical B5/D1 |
| 17 | **Mirror ~950 hotlinked manufacturer images to R2/`public`** (unlocks CSP tightening + perf) | P1 (large) | PROPOSED | — | technical R1 |
| 18 | **Self-host Leaflet** (drop unpkg runtime script) | P1 | PROPOSED | — | technical R2 |
| 19 | **Form polish** — double-submit guard + phone `pattern` on all 5; 44px hamburger; `aria-pressed` on brand/width tabs; gate GA to prod | P3 | PROPOSED | — | technical B3/B4/A1/A2/S4 |

## Approved (empty)

*(No rows yet. Joe moves items here.)*

---

*Backend/platform items (D1, Auth, API, Admin UI, Package Builder, trackers, portal) are **not**
in this queue — they're Phase 1+ and gated on validated demand (D-HP-002). See
`backend-opportunities.md` and `parking-lot.md`.*
