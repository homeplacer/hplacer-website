# Home Placer Employee Portal

The employee portal lives at `portal.hplacer.com` as a **separate Cloudflare
Worker** from the public website. It is deliberately isolated from the marketing
site so employee data, documents, and field photos are never public assets.

The production portal is deployed at `https://portal.hplacer.com` and is
protected by Cloudflare Access with Home Placer Google Workspace sign-in. The
Worker has its own D1 database and private R2 photo bucket; it is separate from
the public marketing site.

---

## What it manages

- **Subdivisions and lots** — Google Maps directions, the Drive plat and permit
  for each lot, the paperwork folder, and every document filed against them.
  Any employee can create and name a subdivision; editing lots stays with
  supervisors
- **Manufactured homes**, keyed by serial number — delivery report, setup
  report, final inspection, and the full repair and bill-back history, plus an
  optional site address and owner of record that field crews can edit. Each
  home also has an extensible workflow checklist, beginning with its planned
  delivery date
- **Equipment**, keyed by asset tag with a serial number or VIN behind it —
  excavators, skid steers, bulldozers, trailers, dump trucks, and pickups
- **Daily pre-use inspections** — checklist per machine type, hour or odometer
  capture, defects, and automatic tag-out on a critical failure
- **Service tracking** — intervals by hours, miles, or calendar days, with a
  morning sweep that tells supervisors what is coming due
- **Supervisor-assigned tasks** — due dates, status, and the photo or note
  evidence that closes one out
- **Repair tickets** — raised from an inspection defect or a field report, with
  photos, labor, materials, a named responsible party, and Tara's billing queue
- **Inventory** — preferred vendor URL and cost, quantities, reorder points,
  low-stock alerts, and material requests raised off a ticket or an inspection
- **Warranty requests from hplacer.com** — matched to a home on serial number,
  address, phone, or name; a confident match becomes a repair ticket in the
  bill-back queue, anything else waits for a person. See
  [Warranty requests](#warranty-requests)
- **Notification routing** — who hears about what is configuration, per
  category, editable at `/admin/notifications`
- **Portable John requests** — any employee can request delivery or pickup,
  tie it to a subdivision, home, or equipment location, and route it to the
  operations queue for scheduling and completion
- **Monday.com link registry and read-only discovery** — which serial number or
  VIN corresponds to which Monday item id. See [Monday.com](#mondaycom).

### A note on "subdivision"

Home Placer calls a placement a **subdivision** — one private lot or a whole
phase — and that is the word the portal uses everywhere a person can see it. The
database still calls the table `jobs`, and the columns are still `job_id` /
`job_number`: renaming a table adds migration risk without adding meaning, so
the rename stops at the surface. `/jobs` and `/api/jobs` remain registered as
aliases of `/subdivisions` and `/api/subdivisions`, and the JSON list returns
both keys, so an old bookmark or a saved script keeps working.

## Running it locally

No Cloudflare account and no credentials of any kind are required.

```bash
npm run portal:dev
```

That starts a Node host on <http://127.0.0.1:8788> backed by `node:sqlite` in
place of D1 and an in-memory bucket in place of R2, with
[`seed/dev-seed.sql`](seed/dev-seed.sql) loaded. It signs you in as
`greg@hplacer.com`; change who you are with the environment variable or a header:

```bash
PORTAL_DEV_IDENTITY=tara@hplacer.com npm run portal:dev
```

```bash
curl -H 'X-Portal-Dev-Identity: dale@hplacer.com' http://127.0.0.1:8788/
```

The local seed has fictional staff solely for development. It is never applied
to production. Production access is controlled by the active employee records
and verified Google Workspace identities.

Other commands:

```bash
npm run portal:check
```

which runs `portal:typecheck`, `portal:test` (239 tests, `node --test`), and
`eslint portal`. `npm run portal:migrate -- ./portal/.local/portal.sqlite --seed`
builds a local database file that survives a restart; point the dev server at it
with `PORTAL_DB_PATH`.

## How it is put together

```
portal/
  wrangler.jsonc          Separate Worker: no assets, no workers.dev, its own D1 + R2
  migrations/             D1 schema, applied in filename order
  seed/dev-seed.sql       Demonstration data — never applied to production
  src/
    worker.ts             Cloudflare entry point (fetch + scheduled)
    app.ts                The request pipeline: verify → resolve → route → audit
    platform/             D1 and R2 abstractions, ids, errors, local SQLite adapter
    auth/                 Access JWT verification, session loading, role matrix
    domain/               Jobs, homes, equipment, inspections, tasks, repairs,
                          inventory, documents, defects, notifications, audit
    integrations/         Monday link registry, read-only client, discovery planner,
                          and the Keychain credential source
  ops/                    Operator CLIs (Monday discovery). Node-only.
    features/             HTTP routes + the pages they render, one file per area
    ui/                   Escaping HTML helper, layout, stylesheet
  dev/                    Node-only: local database bootstrap and dev host
  tests/                  node:test suite
```

The Worker serves server-rendered HTML and plain form posts — there is no client
JavaScript at all, which is why the Content-Security-Policy can be
`default-src 'none'`. Pages are mobile-first: one column, 44 px controls, a
sticky bottom nav, and a light/dark palette that follows the phone.

Every page has a JSON twin. `GET /homes` renders the list; `GET /api/homes` with
`Accept: application/json` returns the same data. Both go through the same
permission checks.

### Storage boundaries

| Data | Where it lives | How the portal treats it |
| --- | --- | --- |
| Operational records | D1 (`PORTAL_DB`) | System of record |
| Field photos, receipts, inspection evidence | R2 (`PORTAL_PHOTOS`), private | Metadata in D1; bytes streamed back through an authorized route, never a stored URL |
| Plats, permits, factory paperwork | Google Drive | File id and `webViewLink` only — nothing is copied, and Drive keeps enforcing its own sharing |
| Homeowner photos from the warranty form | R2 (`PORTAL_PHOTOS`), private | Same bucket, same authorized route; `uploaded_by` is NULL because a homeowner is not an employee |

## Security model

Cloudflare Access is the outer gate, and the Worker does not trust it alone.

1. **Access policy** on `portal.hplacer.com` — an unauthenticated request never
   reaches the Worker.
2. **The Worker verifies the assertion itself.** `Cf-Access-Jwt-Assertion` (or
   the `CF_Authorization` cookie) is checked for RS256 signature against the
   team JWKS, issuer, audience, and expiry on every request. If
   `ACCESS_TEAM_DOMAIN` or `ACCESS_AUD` is missing, the Worker returns 503
   rather than letting anything through — a removed or misconfigured Access
   application fails closed.
3. **Access proves identity; it does not grant access.** An admin has to create
   the employee record first. An unknown address gets a 403 with an explanation,
   and the attempt is written to the audit log.
4. **Roles are enforced server-side, per action.** `employee`, `supervisor`,
   `billing`, `admin`, plus additional grants (Tara is supervisor *and* billing).
   The UI hides controls a role cannot use, but that is cosmetic — posting
   straight to the endpoint hits the same `assertCan` check.
5. **Row-level scoping** on top of that. Without `task.read.all` an employee sees
   only tasks assigned to or raised by them; the same for repair tickets, and a
   ticket's photos inherit the ticket's visibility, so guessing a document id
   does not work.
6. **Audit log.** Every write and every refusal is recorded with actor, action,
   record, and outcome.

**One route is public**, and only one: `POST /api/public/warranty-requests`,
which hplacer.com's server calls when a homeowner submits the warranty form. It
is matched by exact path before any identity is resolved, needs a shared bearer
token compared in constant time (unset ⇒ 503, fail closed), only ever *writes* a
warranty request, and answers with a reference number and nothing else — so it
cannot be used to find out whether a serial number, an address, or a phone
number is one of ours. Every call is audited. In production it should also sit
behind an Access service-token policy; the token check does not depend on that.

The development identity path is guarded twice — it requires a non-production
`PORTAL_ENVIRONMENT` *and* a loopback request URL — so a config slip alone
cannot turn a deployed portal into an open one.

Other hardening: `Content-Security-Policy: default-src 'none'`, `X-Frame-Options:
DENY`, `nosniff`, `Cache-Control: no-store, private`, and `noindex` on every
response; uploads limited to JPEG/PNG/WEBP/HEIC/PDF at 15 MB with filenames
sanitised and non-images served as `attachment`; redirect targets restricted to
same-origin paths; and stored links restricted to `http(s)`.

**The portal is never served from `hplacer.com`.** It is a different Worker with
its own route, its own bindings, and `workers_dev: false`. The public Next.js app
neither imports nor proxies anything in this directory.

## Warranty requests

A homeowner fills in the form at `/warranty-request` on hplacer.com. The
marketing Worker's `/api/warranty-request` route forwards it here server-side —
the browser never touches the portal, and the portal's hostname is never exposed
to it.

Intake then tries to work out which home they mean, and the rule it follows is
the whole point:

> **Never attach a request to a home unless exactly one home is implicated and
> nothing contradicts it.**

Putting a stranger's repair history on someone else's serial number is a worse
outcome than asking a person to spend thirty seconds on it, so ambiguity
resolves to the review queue, never to a best guess.

### What it matches on

| Signal | Strong enough alone? | Notes |
| --- | --- | --- |
| Serial number | Yes | Exact after normalization; a fragment of 6+ characters counts only if it hits exactly one home |
| Address | Yes | Normalized (see below), checked against the home's site address, then its lot, then its subdivision. A *subdivision* address covers many homes, so it is treated as ambiguous by design |
| Phone number | Yes | Ten digits after normalization; matches the owner of record or a previous confidently-matched request |
| Customer name | **No** | Too weak on its own. Used only to break a tie an address or a phone number left open |

Addresses are normalized before comparison, so `12 Bend Road`, `12 BEND RD`, and
`12 Bend Rd, Vilas NC 28692` are one key. Only the trailing word is treated as a
street suffix — abbreviating every token would turn "Mill Creek Road" into
"ML CRK RD" and stop it matching "Mill Creek Rd". Units are folded into the
street (`Lot 12`, `#12`, `Unit 12` all agree), directionals and spelled-out
ordinals are standardized, and the city or ZIP becomes a locality qualifier that
is only required when the caller supplied one.

Phone numbers reduce to ten digits; a seven-digit fragment is refused outright
rather than matched loosely. Names are compared as a sorted token set with
honorifics, suffixes, and middle initials dropped, so "Pruitt, Ray" and
"Mr. Ray Pruitt Jr." agree.

### What happens next

- **Confident match** → a repair ticket on that home, responsible party
  `manufacturer`, bill-back status `review_needed`. It is in Tara's queue
  immediately. The homeowner's photos move onto the ticket.
- **Ambiguous, or no match** → an unlinked warranty request at `/warranty`, with
  the candidate homes and the reason recorded. A reviewer links it to a home in
  one tap, which opens the same ticket, or closes it with a reason.

Either way the `warranty_request` notification category fires immediately —
urgent when it needs review, a warning when it matched.

The normalized matching keys are derived by the application on every write and
are never typed by hand. `backfillMatchKeys()` recomputes them all, which is what
the seed uses and what to run after a bulk import or a change to the rules.

## Monday.com

There is still **no outbound integration**: nothing in this repository writes to
Monday, and the portal Worker makes no Monday calls at runtime. What exists is a
link registry plus a read-only discovery tool an operator runs by hand.

### The link registry

- Links are keyed on a **canonical business key** — the home's serial number,
  the machine's VIN (or serial number, or asset tag), the subdivision number,
  the ticket number — never on a portal row id or an item's name.
- `monday_links` enforces both directions: one record links to at most one item,
  and one item is claimed by at most one record. A board configured to key on
  VIN refuses a record whose key is a serial number.
- `monday_sync_queue` records the changes a real integration would push.
- Board ids and item ids are entered by an administrator at `/admin/monday`.

### The token

The API token is **full access**, so the safety lives on our side. It is stored
in the operator's macOS Keychain and read at the moment of use:

```
service  homeplacer-monday-api
account  homeplacer-portal
```

Store it once, by hand — `-w` with no value prompts, so it never reaches shell
history:

```bash
security add-generic-password -U -s homeplacer-monday-api -a homeplacer-portal -w
```

It is never committed, never written to a file, never placed in an environment
variable, and never printed. `src/integrations/monday-credentials.ts` returns it
as an opaque `MondayToken` whose `toString` and `toJSON` both render `***`, so an
accidental interpolation or a `JSON.stringify` cannot leak it; every error
message and subprocess stream is passed through `redact()` first; and nothing
outside that one file ever holds the raw string — the client asks for an
`Authorization` header, not for a token. There are tests for each of those
claims.

### Read-only by construction

`MondayClient` parses every document it is given and **refuses anything that is
not a query** — mutations, subscriptions, and a mutation aliased behind a
batched document all throw before a byte leaves the process. Enabling writes
takes an explicit `allowMutations: true` at a call site, and nothing in this
repository passes it. Adding an outbound write is therefore a visible, reviewable
change, not something that can happen by accident.

### Discovery, then import

```bash
node portal/ops/monday-discover.ts --board homes --db ./portal/.local/portal.sqlite
```

Default mode reads the board, maps each item to a portal record on its canonical
key, prints what it found, records a `monday_discovery_runs` row, and changes
nothing. Every item is classified:

| Outcome | Meaning | Writable? |
| --- | --- | --- |
| `match` | Exactly one portal record, nothing else claims it | Yes |
| `already_linked` | The link already exists and agrees | No — nothing to do |
| `ambiguous` | The item's key hits more than one portal record | **No** |
| `unmatched` | No canonical key on the item, or no portal record for it | No |
| `conflict` | The record is linked to a different item, or two items claim it | **No** |

Only `match` items are writable. Add `--import-links` to write those into
`monday_links` — a **portal-side write only**; nothing is sent to Monday, then
or ever. `--write-to-monday` exists solely to refuse and point here. Useful
flags: `--key-column <id|title>` to trust one column for the key,
`--fixture <file.json>` to run against a saved payload instead of the live API,
`--out <file>` for the full JSON report, `--limit`.

Recent runs are listed at `/admin/monday`.

### If an outbound write is ever wanted

It is deliberately not a configuration flag. It would mean: implementing
`MondaySyncPort` against the Monday GraphQL API, constructing a client with
`allowMutations: true` at that one call site, draining `monday_sync_queue`,
deciding what happens on a conflict, and reviewing all of it. Nothing above
`src/integrations/monday.ts` has to change.

## Provisioning: what still has to be created

None of the following exists yet. Each is a deliberate act for an account owner —
nothing in this repository creates, requests, or stores any of it.

### 1. Cloudflare resources

| Resource | Command | Then |
| --- | --- | --- |
| D1 database | `npx wrangler d1 create hplacer-portal` | Put the returned id in `database_id` in `portal/wrangler.jsonc` (it is currently `REPLACE_WITH_D1_DATABASE_ID`) |
| R2 bucket | `npx wrangler r2 bucket create hplacer-portal-photos` | Leave public access **off**. Do not attach a custom domain or an `r2.dev` URL — the portal streams objects itself |
| Worker | `npx wrangler deploy` from `portal/` | Creates the `hplacer-portal` script |
| Custom domain | Cloudflare dashboard → Workers → hplacer-portal → Domains | `portal.hplacer.com`, which also creates the DNS record |

Apply the schema once the database exists:

```bash
npx wrangler d1 migrations apply hplacer-portal --remote
```

Do **not** apply `seed/dev-seed.sql` to the production database.

### 2. Cloudflare Access

Create a self-hosted Access application covering `portal.hplacer.com`, with a
policy allowing the Home Placer staff identity provider (Google Workspace, or an
email-list policy while the team is small). Session duration of 8–24 hours suits
a field crew.

Then set the two values the Worker verifies against:

- `ACCESS_TEAM_DOMAIN` — the team name, e.g. `homeplacer` for
  `https://homeplacer.cloudflareaccess.com`
- `ACCESS_AUD` — the application's **Application Audience (AUD) tag**, copied
  from the Access application's overview page

Both are plain settings, not secrets; they go in the `vars` block of
`portal/wrangler.jsonc`, which currently ships them empty so the Worker fails
closed.

Add a **service-token policy** only if an automated client ever needs in. There
is no such client today.

### 3. The first employee record

Access authenticates; the employee row authorizes. Neither exists yet, and the
portal deliberately will not create one for whoever signs in first. Insert the
first administrator by hand, once:

```bash
npx wrangler d1 execute hplacer-portal --remote --command \
  "INSERT INTO employees (id, access_subject, email, display_name, role, active, created_at, updated_at)
   VALUES ('emp_bootstrap', 'pending:you@hplacer.com', 'you@hplacer.com', 'Your Name', 'admin', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);"
```

`access_subject` is a placeholder — the real Access subject binds to the row on
that person's first sign-in. Everyone else is added from `/admin` in the portal.

Supervisors to create: **Brandon, Joe, Tara, Greg, Brett** (Tara also needs the
`billing` role, from the same screen).

### 4. The warranty intake token

The public warranty form needs one shared secret, set identically on **both**
Workers:

```bash
# in portal/ — the portal side
npx wrangler secret put PORTAL_INTAKE_TOKEN
```

```bash
# in the repo root — the marketing site side
npx wrangler secret put PORTAL_INTAKE_TOKEN
```

Generate it with something like `openssl rand -base64 48`. It is a Worker
**secret**, never a `var`, and it is not in this repository. Also set
`PORTAL_INTAKE_URL` on the marketing site (see `.env.example`); until both are
set the form still works and falls back to the existing lead pipeline, minus
photos, logging `WARRANTY_PORTAL_FALLBACK`.

Optionally add a **service-token** Access policy on the portal application
scoped to `/api/public/warranty-requests`, and give the marketing Worker
`PORTAL_ACCESS_CLIENT_ID` and `PORTAL_ACCESS_CLIENT_SECRET`. That is a second,
independent gate; the bearer-token check does not depend on it.

### 5. Credentials summary

| Secret | Needed? | Notes |
| --- | --- | --- |
| Cloudflare API token | For deploying only | An account-scoped token with Workers Scripts, D1, and R2 edit permissions, used by whoever runs `wrangler deploy`. Never stored in this repo |
| `PORTAL_INTAKE_TOKEN` | For the warranty form | A shared secret, set on both Workers. Generated by whoever provisions; never in this repo |
| Monday API token | For discovery only | Full-access, in the operator's macOS Keychain, read at runtime by `portal/ops/monday-discover.ts` and never by the Worker. Not required to run the portal. A least-privilege, board-scoped token would be better if Monday ever offers one |
| Google Drive credentials | **No** | The portal stores links, not files, and never calls the Drive API. Drive's own sharing controls who can open a plat or permit |
| Follow Up Boss, Resend, or any marketing-site key | **No** | The portal reads none of them. The marketing site's `/api/warranty-request` uses its own existing lead pipeline only as a fallback |

So the portal runs with **one** application secret — the warranty intake token —
plus the deploy-time Cloudflare token. The Monday token is operator tooling and
is never needed by the deployed Worker.

### 6. Optional, once it is live

- Keep the cron trigger in `wrangler.jsonc` (`0 11 * * *`, 07:00 Eastern in
  summer) for the low-stock and service-due sweep; the same sweep can be run by
  hand from `/admin`.
- Point notifications at email or SMS. `notifications.delivered_at` is the hook —
  the table already carries a severity and a dedupe key.
- Turn on Access logging retention, and mirror it against the portal's own audit
  log at `/admin/audit`.
- Set an R2 lifecycle rule if field photos need to age out.

### 7. Known gaps

- **Migrations 0002 and 0004 recreate tables** earlier migrations created,
  because SQLite cannot amend a table CHECK constraint. That is safe only
  because no database has been provisioned yet. Once these have been applied
  somewhere real, do not reorder or edit them — add `0005`. Migration 0004 swaps
  the `notifications.category` CHECK for a foreign key into
  `notification_categories`, so adding a category is an INSERT from now on
  rather than another rebuild.
- **Address matching is tuned for US addresses**, and abbreviates only the
  trailing street suffix. `12 BND RD` will not match `12 Bend Rd` — the
  abbreviation is in the street *name*, not the suffix. That case lands in the
  review queue, which is the intended failure direction.
- **Migration 0002 contains a trigger.** `wrangler d1 migrations apply` handles
  `CREATE TRIGGER … BEGIN … END;` correctly on current versions; confirm the
  trigger `trg_inventory_movement_applies_to_stock` exists after the first apply,
  since `parts.quantity_on_hand` depends on it.
- **The warranty intake is the only unauthenticated route**; there is still no
  health check. If uptime
  monitoring is wanted, add an Access bypass policy for one path and a matching
  route rather than loosening the Worker.
- Photo uploads are a single request (up to 15 MB). Larger media would want
  presigned multipart uploads directly to R2.

---

## Reference

### Roles

| | employee | supervisor | billing | admin |
| --- | --- | --- | --- | --- |
| File inspections, report defects, raise repairs | ✅ | ✅ | — | ✅ |
| Request materials, upload photos | ✅ | ✅ | ✅ | ✅ |
| Create and name a subdivision | ✅ | ✅ | — | ✅ |
| Edit a home's site address and owner | ✅ | ✅ | — | ✅ |
| See all tasks and tickets | — | ✅ | ✅ | ✅ |
| Assign tasks, approve repairs, manage equipment | — | ✅ | — | ✅ |
| Review the warranty queue | — | ✅ | ✅ | ✅ |
| Bill-back queue, purchasing, stock management | — | — | ✅ | ✅ |
| Staff, roles, notification routing, Monday links, audit log | — | — | — | ✅ |

### Migrations

| File | Contents |
| --- | --- |
| `0001_initial.sql` | Employees, jobs, homes, assets, tasks, inspections, repairs, parts, movements, material requests, documents, notifications |
| `0002_portal_operations.sql` | Role grants, lots, checklist templates, defects, service tracking, meter readings, repair labor/materials/history, Monday registry, audit log; recreates `documents`, `notifications`, `part_compatibility` |
| `0003_checklist_reference_data.sql` | The inspection checklists themselves — Home Placer's own procedures, not employee or customer data |
| `0004_warranty_and_routing.sql` | Home site address and owner of record, address matching keys, warranty requests, notification categories and routing, Monday discovery runs; recreates `documents` and `notifications` |

`seed/dev-seed.sql` is demonstration data for local work only. No employee names,
credentials, vendor accounts, photos, or customer data are checked into source
control.
