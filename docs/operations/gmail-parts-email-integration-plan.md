# Gmail receipts and parts tracking integration

**Status:** local implementation is ready for review. Gmail is still disconnected and disabled; no mailbox has been read, no OAuth client or refresh token has been provisioned, and no migration or code has been deployed.

## Intended behavior

- Connect the internal Home Placer portal to Brandon's `@hplacer.com` Google Workspace mailbox through Google OAuth and Gmail API.
- Detect vendor order confirmations, receipts/invoices, shipment notices, and tracking updates.
- Save receipt attachments privately to the portal's R2 storage and show them in an employee review queue.
- Extract carrier, tracking number, tracking URL, and vendor order number where present. Link to a carrier's official tracking page, not an arbitrary URL embedded in an email.
- Match an email to a material request only when the evidence is strong. Put uncertain matches in a review queue; do not silently attach a receipt or tracking number to the wrong machine/order.
- When a part is ordered, show its ordered status and tracking link on the request so employees can see it.
- Keep only message identifiers and useful headers/extracted fields in D1; avoid retaining complete message bodies. Preserve Gmail as the source of truth for email.

## Access and security constraints

The proposed package-receipt and delivery-tracking use is within Google's stated Gmail use case for reporting or monitoring package-delivery status for the user's benefit. The integration uses only `https://www.googleapis.com/auth/gmail.readonly`; it does not send, label, modify, or delete mail. Google classifies this scope as restricted.

The production approval path depends on facts that are not yet confirmed. If this app is used **only by people in the Home Placer Google Workspace or Cloud Identity organization**, its Google Cloud project is **owned by that same organization**, and its OAuth consent-screen audience is set to **Internal**, Google's internal-use exception says restricted-scope OAuth verification is not required. This exception does not waive Google's API user-data policy or Workspace controls: an organization administrator may still need to approve or allowlist the app, and the company must set appropriate employee transparency, access, and retention rules.

If external users will use the app, or any of those organization/project/audience conditions is not met, use the standard restricted-scope verification path; server-side storage or transmission of restricted-scope data may also require Google's security assessment. Before choosing a path, confirm the Workspace/Cloud Identity organization, Cloud project ownership, intended user audience (including any external users), OAuth audience setting, administrator approval/allowlisting requirements, and company retention rules.

**Gate:** Gmail remains disconnected and disabled until those facts and any required administrator approval and company policy decisions are confirmed. No OAuth client or refresh token has been provisioned. Do not access the mailbox, provision or store credentials, apply the migration remotely, deploy, merge, or submit a Google verification until separately authorized.

Keep the OAuth client secret and refresh token in Cloudflare Worker secrets, never source control, D1, or logs. Do not store plain email bodies or arbitrary email-provided tracking links.

## Recommended first release

Use the Cloudflare Worker scheduled trigger to poll Gmail every 15 minutes, with Gmail search queries constrained to order/receipt/shipping terms and a D1 time cursor with five-minute overlap, persisted pagination token, and message-ID dedupe. This avoids an initial Cloud Pub/Sub dependency. Google documents `messages.list` query filtering and pagination; Pub/Sub watch needs renewal at least every seven days and can miss notifications, so it is a later optimization with polling fallback.

Material requests now have order number, carrier, tracking number/link, expected-arrival, and update-time fields. A private vendor-email queue stages allowlisted PDF/JPEG/PNG/HEIC attachments in R2. Staff must select or confirm the material-request match before tracking fields are applied or attachments become portal documents. The first pass suggests a match only on a unique exact vendor order number; all emails remain in the review queue. Tracking URLs are rebuilt from allowlisted carrier templates and validated numbers; arbitrary email URLs are ignored. D1 holds Gmail message/thread IDs, sender/subject/date, extracted fields, and generic error codes, never message bodies.

## Implementation checklist

1. **Policy/account facts (blocked):** confirm the Workspace/Cloud Identity organization, Cloud project ownership, whether any external users need access, OAuth audience setting, administrator approval or allowlisting, and retention policy. Choose the internal-only exception only if all three internal-use criteria above are met; otherwise plan for standard restricted-scope verification and any required security assessment. Only after this is resolved, create a Google OAuth client with `gmail.readonly` and offline access, and verify the granted Gmail profile is exactly `brandon@hplacer.com`.
2. Provision `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and `GMAIL_REFRESH_TOKEN` as Cloudflare Worker secrets; set `GMAIL_ALLOWED_MAILBOX=brandon@hplacer.com` and `GMAIL_INGEST_ENABLED=true` only after those prerequisites are cleared. No credentials belong in D1 or Git.
3. Review this implementation. Apply migration `0014_vendor_email_parts_tracking.sql` and deploy only after an explicit user instruction, per `AGENTS.md`.
4. After deployment and credential setup, verify revoked-token behavior, malformed MIME, duplicate messages, attachment limits, ambiguous matches, unsafe links, cursor/page-token recovery, and review idempotency against a test mailbox or approved sample data.
5. Later: add a secure admin connect/disconnect UI if operations need it; add a Pub/Sub watch only if 15-minute polling proves inadequate; extend matching to vendor + SKU/part/description only with unique, explainable evidence; consider expected-arrival extraction after collecting real vendor formats.

## Current repo facts

The portal has material-request statuses, private R2 receipt storage, a scheduled Worker, and audit/security patterns. This branch adds a read-only Gmail client, guarded 15-minute poller, exact-mailbox profile check, staged attachment handling, message dedupe, carrier URL construction, a review queue, tracking fields, and requester/repair-assignee notifications. `npm run portal:check` covers the implementation. There is no OAuth connect/disconnect UI and no live Gmail/Cloudflare secrets. Migration 0014 is local only; do not apply it remotely or deploy without an explicit instruction.

## Separate equipment-tracking integration candidate: SilverCloud

The user provided `https://portal.gps-tracking.com/default.aspx`. The public login identifies the service as **SilverCloud**, and LandAirSea's public product materials describe real-time location maps, geofence alerts, and historical playback. The publicly available material reviewed so far does not establish a supported customer API or export path. Do not automate the login page or store a user password in the portal. Ask LandAirSea for supported API/export options and confirm which tracker/device serial maps to each company asset before proposing a location integration. If there is no API, the portal can keep a link to the SilverCloud device/account or employee-entered last-known location rather than scraping the web UI.

References: [SilverCloud portal](https://portal.gps-tracking.com/default.aspx), [LandAirSea device-management overview](https://landairsea.com/device-management/), [GPS tracking features](https://landairsea.com/pages/gps-tracking-features), [LandAirSea documentation](https://landairsea.com/pages/support-documentation).

Gmail implementation and policy references: [Gmail OAuth scopes](https://developers.google.com/workspace/gmail/api/auth/scopes), [Google Workspace API user-data policy and approved use cases](https://developers.google.com/workspace/workspace-api-user-data-developer-policy), [Google restricted-scope verification FAQ and internal-use exception](https://support.google.com/cloud/answer/13464323?hl=en), [OAuth audience configuration](https://support.google.com/cloud/answer/15549945?hl=en), [messages.list query and pagination](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list), and [push watch and expiry limitations](https://developers.google.com/workspace/gmail/api/guides/push).
