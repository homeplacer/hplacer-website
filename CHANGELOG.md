# Home Placer — Changelog

*What shipped, newest first. Companion: `ROADMAP.md`, `DECISIONS.md`, `TODO.md`.*

## 2026-08-24 — Provisional homes, verified fleet list, equipment photos

- New homes may be created before any identity detail is known. The portal uses
  an internal unique placeholder, names every missing field, permits later
  supervisor edits, and still rejects duplicate real serial numbers.
- The main equipment list now contains verified imports and staff-created real
  assets only. Unresolved imports are segregated into Source review; generic
  imported rows with neither serial nor VIN are retired without deleting their
  records, documents, or history.
- Equipment detail pages now have a private photo manager. The verified fleet
  list shows protected thumbnails when present and a clean fallback otherwise.

## 2026-08-24 — Complete per-home operations workflow

- Expanded the home checklist into an ordered delivery-to-finish workflow with
  estimated and actual milestones, install, permits, meter, inspection,
  electric, sewer/septic, foundation, home inspection, HVAC, skirting, sod or
  rock, driveway, and mailbox steps.
- Added conditional private paperwork slots for building and septic permits,
  sewer receipts, final inspection reports, foundation certificates, and home
  inspections, plus shared Site map and Plat areas at the top.
- Site map and Plat deletion now requires explicit confirmation on the server.
  Every checklist value change has visible, append-only attribution and history.

## 2026-08-24 — Per-home workflow checklist

- Every home now has a workflow checklist beginning with a planned delivery
  date, editable with a native date picker and recorded with who last changed it.
- The planned date remains separate from the existing delivery report and its
  actual `delivered_on` milestone, preserving the current home reporting flow.
- Workflow editing is an explicit permission available to every active portal
  role; all existing home write and report permissions remain unchanged.

## 2026-08-24 — Portable John operations workflow

- Employees can request a Portable John delivery or pickup and identify exactly
  one subdivision, home, or equipment location, with date, quantity, directions,
  and notes.
- Requests route through configurable notification routing to operations.
  Supervisors see the full queue and can record scheduling, completion, or
  cancellation notes; employees see their own requests.

## 2026-08-21 — Warranty intake, subdivisions, notification routing, Monday discovery

Second pass on the portal (`portal/`), plus the first public-site surface that
talks to it. Still nothing deployed.

- **Warranty requests from hplacer.com** — new `/warranty-request` page and form
  (serial optional, address, photos). The marketing Worker forwards it
  server-side to the portal's one public route, which is guarded by a shared
  bearer token compared in constant time, fails closed when unset, only writes,
  and answers with a reference number and nothing else so it cannot be used to
  probe what we know. If the portal is unreachable the request falls back to the
  existing lead pipeline (minus photos) rather than being lost.
- **Matching, deliberately conservative** — a request is attached to a home only
  when exactly one home is implicated and nothing contradicts it. Serial number,
  normalized address, and normalized phone are each strong enough alone; a
  customer name never is, and only breaks a tie. A subdivision-level address
  match is treated as ambiguous by design. Anything else lands in the review
  queue at `/warranty` with the candidates it considered. A confident match
  becomes a repair ticket in Tara's bill-back queue with the homeowner's photos
  attached.
- **Home site address** — optional street address, owner of record, phone, and
  directions on every home, editable by field crews (not just supervisors), with
  normalized matching keys derived on write by the same code the portal uses at
  runtime.
- **Jobs are Subdivisions** — everywhere a person can see. The table stays
  `jobs`; `/jobs` and `/api/jobs` stay registered as aliases. Any employee can
  now create and name one; editing lots remains a supervisor's job.
- **Configurable notification recipients** — `notification_categories` +
  `notification_routes`, administered at `/admin/notifications`. Each category
  falls back to a default role, so a category can never silently notify nobody.
  `notifications.category` is now a foreign key rather than a CHECK, so adding
  one is an INSERT.
- **Monday.com** — still no outbound writes. Added a full-access-token adapter
  that reads the token from the macOS Keychain (`homeplacer-monday-api` /
  `homeplacer-portal`) at the moment of use and never prints it; a client that
  refuses any document containing a mutation before a byte leaves the process;
  and `portal/ops/monday-discover.ts`, a read-only discovery pass that maps
  board items to portal canonical ids and classifies each one. Only unambiguous,
  unconflicted matches are writable, and only into `monday_links`, only with
  `--import-links`.
- **Verification** — `npm run portal:check`: 239 tests, `tsc` and `eslint` clean
  on both the portal and the marketing app; `npm run build` still green.

## 2026-08-21 — Employee operations portal (`portal/`)

Built the field-operations portal for **portal.hplacer.com** as a **separate
Cloudflare Worker** from this marketing site — its own script, route, D1
database, and private R2 bucket. Nothing is deployed; `portal/README.md` lists
the exact resources, settings, and credentials a real deployment still needs.

- **Schema** — migrations `0002` (role grants, lots with plat/permit Drive links,
  checklist templates, defects, equipment service tracking and meter readings,
  repair labor/materials/history, the Monday link registry, audit log) and `0003`
  (the inspection checklists themselves). `0002` recreates `documents`,
  `notifications`, and `part_compatibility` — SQLite cannot amend a table CHECK,
  and nothing has been provisioned yet.
- **Field workflows** — daily pre-use inspections per machine type with hour or
  odometer capture, automatic defect creation, and tag-out on a critical failure;
  home delivery / setup / final-inspection reports that advance the home's
  milestones; supervisor-assigned tasks with photo-or-note completion evidence;
  repair tickets from a defect or a field report; material requests off a ticket.
- **Billing** — the bill-back queue (Tara's) with a responsible party, labor and
  material costing to the cent, and a status ladder that refuses to bill an
  unfinished repair or one with no responsible party named.
- **Inventory** — signed movement ledger with the balance maintained by a
  trigger, reorder points, vendor URL and cost, and low-stock alerts that fire
  once per shortage and re-arm after a restock.
- **Security** — Cloudflare Access verified in the Worker (signature, issuer,
  audience, expiry) and failing closed when unconfigured; Access proves identity
  while the employee record grants access; per-action role checks plus row-level
  scoping on tasks, tickets, and their photos; private R2 objects streamed
  through an authorized route rather than a stored URL; audit log of every write
  and every refusal.
- **Monday.com** — link registry and sync queue keyed on serial number, VIN, job
  number, or ticket number. No network calls and no API token, by design.
- **Verification** — `npm run portal:check`: 144 `node --test` tests, `tsc`
  clean, `eslint` clean. `npm run portal:dev` runs the whole thing locally on
  `node:sqlite` with no Cloudflare account.

## 2026-07-03 — Phase 0 launch-readiness (Builder-Claude, CTO)

Hardened the marketing/lead site to launch quality behind a production build + a
three-way audit (SEO/routing · leads/CRM · mobile/perf/security). Governance:
`ROADMAP.md`, `DECISIONS.md` (D-HP-001…005), `TODO.md`.

- **Conversion** — homepage inline "Get your price" lead capture (#4); land-packages
  rebuilt into a conversion page with cost transparency, real photos, FAQs, inline
  form (#5); inventory "Call for pricing" → "Get this home's price" lead moments,
  price sort/filter hidden while unpriced (#6).
- **Lead pipeline** — FUB delivery resilience: retry + warranty-id validation +
  `LEAD_NOT_DELIVERED` safety marker (#1); no silent lead loss on validation reject
  (all 5 forms show a retryable error) + parallelized warranty routing (#9); pricing
  loader hardened against malformed input (#2).
- **Security** — response headers (CSP report-only + HSTS/frame/nosniff/referrer),
  blog-markdown XSS sanitization, `/api/lead` payload/field caps + email escaping,
  Leaflet popup escaping (#8).
- **SEO** — canonicals on 14 pages, `BlogPosting` + `BreadcrumbList` schema, logo fix,
  removed the stale GitHub-Pages export path that dropped security middleware (#10).
- **Robustness** — styled 404 + global error boundary, mobile table scroll (#11).
- **Repo** — promoted the real production branch to `main`; recorded the Builder-Claude
  charter + platform-request for a Forturro read-only land API (open, D-021).

Result: production build green; security/lead/SEO/robustness audit items closed.
Remaining before traffic = ops gates (Worker secrets, `LEAD_NOT_DELIVERED` alert,
promote CSP to enforcing) + Joe's items (pricing, domain, listings). See TODO.md.
