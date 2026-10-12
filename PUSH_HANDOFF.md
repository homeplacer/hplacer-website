# Portal phone alerts (Web Push) — handoff

Branch `codex/portal-iphone-push-20261012` (base `440f5aa`). Not committed, pushed,
or deployed by the implementing session. **No live push has been sent**: all delivery
tests use a recording `fetch` stand-in and an independent OpenSSL decryptor.

## What it does

Employees who install the portal on the iPhone Home Screen (iOS/iPadOS 16.4+), or
use a desktop/Android browser, can turn on **task-assignment alerts** from
**Notifications → Phone alerts**. When a supervisor assigns them a task (on create
or reassignment, including self-assignment and multi-assignee tasks), each of their
registered devices gets a lock-screen alert:

> **Home Placer** — You have a new task assignment. (or "new urgent task assignment")

Tapping it opens `/tasks/<id>` through normal Cloudflare Access sign-in. The in-app
bell and the optional task email are unchanged.

## Design

| Concern | Implementation |
|---|---|
| Transport | `portal/src/integrations/web-push.ts`. RFC 8291 payload encryption (RFC 8188 `aes128gcm`, single 4096-byte record) and RFC 8292 VAPID ES256 JWT, built only from WebCrypto (`ECDH`, `HKDF`, `AES-GCM`, `ECDSA`), the same in Workers and Node. No new dependencies. |
| Verification of crypto | Byte-exact RFC 8291 Appendix A published vector; independent decryption with Node `createECDH`+`hkdfSync`+`createDecipheriv`; VAPID JWT verified with Node `crypto.verify` (`ieee-p1363`). |
| VAPID token reuse | Cached per push origin+key+subject in the isolate. `exp` is 12 h and the token is reused until under 1 h remains, so it refreshes at most once every ~11 h per origin per isolate (Apple asks for no more than hourly). Memory only, never persisted. |
| SSRF | Endpoint must be `https:`, default port, no userinfo/fragment/backslash, ≤1024 chars, and host must be `*.push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com` / `*.push.services.mozilla.com`, or `*.notify.windows.com`. Re-validated at send time. `redirect: "manual"`, and any 3xx is a terminal rejection. 10 s timeout. Response bodies are never read. |
| Keys | `p256dh` must be a 65-byte on-curve P-256 point (import-checked); `auth` must be 16 bytes. |
| Subscription ownership | `push_subscriptions.endpoint_hash` is UNIQUE, so one endpoint maps to exactly one employee. If a different employee subscribes the same endpoint (shared phone, account switch), the old binding is deleted and its queued alerts are cancelled in the same D1 batch. The client detects "this device is subscribed but not to you" and offers an explicit **Get my alerts on this device** button. All reads and deletes are scoped to the caller; even admins cannot remove someone else's device. At most 10 devices per employee. |
| Privacy | Payload is generic: no task title, address, or names. Endpoints, keys, and VAPID private material are never returned by any route, rendered, or logged. Stored errors are fixed codes like `http_503`. Cron logs counts only. |
| Outbox | `push_deliveries`, one row per (notification, device). Rows are written **in the same D1 batch** as the `notifications` insert (`notify(..., pushEligible: true)`) and only for devices registered at that moment, so turning push on or adding a device never replays history. Rows older than 12 h expire unsent; TTL is the remaining window. |
| Claiming | Atomic conditional `UPDATE` claims each row with a 2 min lease and a random `claim_token`. Every outcome write is fenced on `status='sending' AND claim_token=?`, so a sender whose lease was reclaimed cannot overwrite the newer result or mark the device failed. A fresh clock is read per row. |
| Dispatch-time rechecks | Employee still active; device still bound to the notification's employee; notification is `task_assigned`/`work_task`; employee is **still an assignee** of a task that is open, in progress, or blocked. Otherwise the row is `skipped` with a reason. |
| Retries | 429/5xx/408/network: back off 1 m → 5 m → 15 m → 60 m, or `Retry-After` if longer (capped at 1 h), max 5 attempts, then `failed`. 404/410: subscription deleted and its other queued rows cancelled. Other 4xx (e.g. 403 bad VAPID) fail with no retry. |
| Dedupe | Lease plus fencing (sent once even with concurrent drains); `UNIQUE(notification_id, subscription_id)`; Web Push `Topic` = hash of the notification id, so the push service collapses re-sends; notification `tag` = `ntf-<notification id>`, so the device replaces rather than stacks. |
| When it sends | Immediately after task create/assign via `ctx.waitUntil`. Bounded to 10 rows **and** a 12 s claim budget, so worst case ≈ 12 s + one 10 s send, inside Workers' ~30 s `waitUntil` limit. The existing `*/5` cron drains the rest. |
| Service worker | `/sw.js` has **no `fetch` handler**: it never caches portal pages and never stands between a navigation and Access. Every `push` event shows a notification from the decrypted payload alone (no network), so it works when the Access session has expired; WebKit requires a visible notification for every push. Clicks open only a same-origin path (else `/notifications`). |
| Opt-in UI | Notifications page only. `pushManager.subscribe()` is called directly in the tap handler (Safari's user-gesture rule). Buttons: Turn on, Get my alerts on this device, Send test alert (rate limited to one per 30 s), Turn off on this device. Plus a device list with Remove. A global `[hidden]{display:none !important}` rule keeps hidden controls hidden despite the button `display` rule. |
| CSRF | Every push mutation requires `Origin` equal to the portal origin and `Sec-Fetch-Site` (when present) of `same-origin`. JSON routes require `Content-Type: application/json` (415 otherwise), so a cross-site form cannot reach them. All routes stay behind Cloudflare Access plus the active-employee check; nothing was made public. |
| CSP | Global CSP gains `manifest-src 'self'`. Only the notifications page, when push is configured, adds `script-src 'self'; connect-src 'self'; worker-src 'self'` for the same-origin `/push-client.js`. Still no inline script anywhere. |
| Home Screen app | `/manifest.webmanifest` (`display: standalone`, `id: "/"`) linked with `crossorigin="use-credentials"` so the fetch carries the Access cookie, plus `apple-touch-icon` and app-capable meta tags on every page. Icons (180/192/512 PNG) are generated from `src/app/apple-icon.png` with `sips -z` and bundled as base64 in `portal/src/ui/app-icons.ts` (Workers have no filesystem). The marketing site is not modified. |

## Changed files

New:
- `portal/migrations/0023_web_push.sql` adds the `push_subscriptions` and `push_deliveries` tables.
- `portal/src/integrations/web-push.ts` has the encryption, VAPID, endpoint/key validation, sender, and config loader.
- `portal/src/domain/push.ts` has subscriptions, the outbox enqueue, the leased dispatcher, test alerts, and `runWebPush`.
- `portal/src/features/push.ts` has the routes, CSRF guard, static app-shell files, and `drainPushSoon`.
- `portal/src/ui/app-shell.ts` has the manifest, service worker, and opt-in script.
- `portal/src/ui/app-icons.ts` holds the bundled PNG icons.
- `portal/ops/generate-vapid-keys.ts` is the key generator.
- `portal/tests/push-helpers.ts`, `portal/tests/web-push-transport.test.ts`, and `portal/tests/push-alerts.test.ts` are the tests.
- `PUSH_HANDOFF.md` is this file.

Modified:
- `portal/src/domain/notifications.ts`: `pushEligible` option; notification and outbox rows are written in one batch.
- `portal/src/domain/tasks.ts`: create/assign notifications set `pushEligible: true`. The completion notice does not.
- `portal/src/features/tasks.ts`: `drainPushSoon(ctx)` after create and assign.
- `portal/src/features/dashboard.ts`: the Phone alerts panel on `/notifications`.
- `portal/src/app.ts`: `registerPush`, plus the `waitUntil` option passed into `RequestContext`.
- `portal/src/api/context.ts`: optional `waitUntil`.
- `portal/src/api/responses.ts`: `push_device_removed` flash.
- `portal/src/worker.ts`: `fetch` passes `ctx.waitUntil`; the `*/5` cron runs `runWebPush` when enabled.
- `portal/src/platform/types.ts`: `WEB_PUSH_*` env contract.
- `portal/src/ui/layout.ts`: manifest/icon/meta tags, `manifest-src`, the push-page CSP, and the `pushClient` option.
- `portal/src/ui/styles.ts`: the `[hidden]` rule.
- `portal/wrangler.jsonc`: `"WEB_PUSH_ENABLED": "true"` for the approved production release; the code remains inert without valid VAPID configuration.
- `portal/README.md`: a pointer to this handoff in the operations notes.

There are no changes to package dependencies, the lockfile, GPS, Monday, the public site, or Access configuration.

## Env contract (portal Worker)

| Name | Kind | Value |
|---|---|---|
| `WEB_PUSH_ENABLED` | var | `"true"` in the approved production configuration. Set to `"false"` to disable; absent is also disabled. |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | var or secret (not sensitive) | base64url 65-byte uncompressed P-256 point |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | **secret only** | base64url 32-byte private scalar |
| `WEB_PUSH_SUBJECT` | var or secret | `mailto:<ops mailbox>` or an `https:` URL. Apple rejects malformed subjects. |

Push is inert unless the flag is `"true"` **and** all three keys are present **and**
the key pair verifies (a sign/verify round trip). Until then: `/api/push/config` reports
`enabled:false`, subscribe and test return 503, no script is served on the page, no
subscriptions can exist, and so no outbox rows are created.

## Schema contract

- `push_subscriptions(id, employee_id→employees CASCADE, endpoint, endpoint_hash UNIQUE, push_host, p256dh, auth_secret, created_at, updated_at, last_success_at, last_failure_at, failure_count, last_test_at)`.
- `push_deliveries(id, notification_id→notifications CASCADE, subscription_id→push_subscriptions SET NULL, employee_id→employees CASCADE, status ∈ {pending, sending, sent, failed, gone, skipped, expired, cancelled}, attempts, next_attempt_at, lease_until, claim_token, last_status, last_error, created_at, sent_at, UNIQUE(notification_id, subscription_id))`.
- Timestamps use the portal's `YYYY-MM-DD HH:MM:SS` UTC format.

## API contract (all behind Access + active employee)

| Method and path | Body | Result |
|---|---|---|
| `GET /api/push/config` | — | `{enabled, publicKey}` |
| `POST /api/push/subscriptions` | JSON `{endpoint, keys:{p256dh, auth}}` (flat `p256dh`/`auth` also accepted) | 201 or 200 `{id, transferred}` |
| `POST /api/push/subscriptions/check` | JSON `{endpoint}` | `{registered}`: the caller's own binding only |
| `POST /api/push/subscriptions/remove` | JSON `{endpoint}` | `{removed}`: the caller's own only |
| `POST /api/push/devices/:id/delete` | form | 303 to `/notifications?ok=push_device_removed`; 404 if not the caller's |
| `POST /api/push/test` | JSON `{}` | `{devices, sent, failed, removed}`; 429 within 30 s; 503 when off |
| `GET /sw.js`, `/push-client.js`, `/manifest.webmanifest`, `/apple-touch-icon.png`, `/app-icon-192.png`, `/app-icon-512.png` | — | static |

## Commands run (local only)

```bash
npm ci                                   # locked deps, no package changes
npm run portal:typecheck                 # clean
npm run portal:test                      # 415 tests, 415 pass (382 existing + 33 new)
npx eslint portal                        # 0 errors; 1 pre-existing warning in monday-homes-import.ts
npx wrangler deploy --dry-run -c portal/wrangler.jsonc --outdir <scratch>   # bundles, 671 KiB / 182 KiB gzip
CI=1 npx wrangler d1 migrations apply hplacer-portal --local --persist-to <scratch> -c portal/wrangler.jsonc  # 0001..0023 apply on workerd D1; enqueue SQL checked
```

## Deploy steps (for the owner; not done)

1. Apply migration `0023_web_push.sql` to the production D1 database (`wrangler d1 migrations apply hplacer-portal --remote -c portal/wrangler.jsonc`).
2. Generate keys: `node portal/ops/generate-vapid-keys.ts /tmp/vapid.key`. This prints the public key and writes the private key to a mode-600 file.
3. `npx wrangler secret put WEB_PUSH_VAPID_PRIVATE_KEY -c portal/wrangler.jsonc < /tmp/vapid.key`, then `rm /tmp/vapid.key`.
4. Set `WEB_PUSH_VAPID_PUBLIC_KEY` and `WEB_PUSH_SUBJECT` (vars or secrets), and verify the reviewed production configuration has `WEB_PUSH_ENABLED` set to `"true"`.
5. Deploy. Rotating the VAPID key invalidates existing subscriptions: push services reject them, and devices must turn alerts off and on again.

## Phone test steps (iPhone, after deploy)

1. In Safari on iOS 16.4+, open `https://portal.hplacer.com` and sign in through Access.
2. Tap Share → Add to Home Screen → Add. Open **HP Portal** from the Home Screen and sign in if prompted.
3. Go to Notifications (bell) → Phone alerts. Only **Turn on phone alerts** should be visible. Tap it and Allow.
4. The status should read "Phone alerts are on". The device list should show "iPhone, iPad, or Mac (Apple)".
5. Tap **Send test alert**. Lock the phone; an alert "Test alert: phone alerts are working." should arrive within seconds.
6. From another account (or a desktop as a supervisor), assign a task to this employee. A generic "You have a new task assignment." alert should arrive with no task details on the lock screen. Tapping it opens the task; if the Access session has expired, sign in and you should land on the task.
7. Assign a task to two people plus yourself. Each person's devices get exactly one alert.
8. Shared phone: sign in as another employee in the same Home Screen app and open Notifications. It should offer "Get my alerts on this device". After tapping, only the new employee gets alerts there.
9. Turn off on this device. Assign another task and confirm no alert arrives.
10. Check Worker logs: only count summaries such as `task-assignment push delivery complete`, with no endpoints or keys.

## Known limits / blockers

- **Not live-tested.** No push has been sent to Apple, Google, or Mozilla. Real-device delivery needs the deploy steps above.
- Fetching the manifest and icons behind Access depends on iOS sending the Access cookie (`crossorigin="use-credentials"` is set). If iOS fetches the icon without cookies, the Home Screen falls back to a page snapshot icon. This is cosmetic only.
- The VAPID token cache is per isolate. A new isolate signs a fresh token, which is still well under Apple's hourly guidance in normal traffic.
- `pushsubscriptionchange` is not handled. If a browser rotates an endpoint, the old one returns 410 and is cleaned up, and the Notifications page shows Turn on or Get my alerts again.
- Deactivating an employee does not delete their device rows; delivery is skipped at send time. A cleanup sweep can be added later.

## Coordinator verification before release

- Independently ran all 415 tests, typecheck, lint (one existing unrelated warning), and deployment dry-run.
- Independently decrypted synthetic payloads with Node/OpenSSL and verified VAPID signatures.
- Ran synthetic transport inside local Cloudflare workerd: passed, zero external push calls.
- Checked the notifications screen at 390px width; only the correct opt-in button appears, readable setup, no browser errors.
- Perplexity Desktop source-only review found no confirmed blocker. Missing-context questions were checked directly: unique endpoint/FK migration, same-origin referrer policy, timestamp format, credentialed manifest, atomic notification/outbox and task-route hook.
- Production database backup saved before release. No real device delivery has been verified yet.
