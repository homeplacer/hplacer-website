# LandAirSea GPS connection — October 6, 2026

User authorized proceeding with the GPS integration. Confirmed tracker-to-machine associations must remain unchanged; unidentified devices must not be assigned by guesswork.

## Verified source

LandAirSea's October 1 reply to Brandon supplied an account client token and two PDF guides, REPORTING_API_12Feb2026.pdf and TRACKING_API_15Feb2023.pdf. The Tracking guide documents a read-only POST to https://gateway.landairsea.com/Track/MyDevices with clientToken, username, password; Content-Type application/json and a stable ClientId header. The reporting API is unnecessary for the initial location poll. No provider write or report-email method is used.

## Backend contract

- Worker secrets: LANDAIRSEA_CLIENT_TOKEN, LANDAIRSEA_USERNAME, LANDAIRSEA_PASSWORD. Do not commit or print values.
- GPS_SYNC_ENABLED must equal true; default is off. Poll uses the existing fifteen-minute cron.
- Migration 0022 adds gps_devices and gps_sync_state. Device-to-asset links are optional and unique. Polling does not create or modify those links.
- GET /api/equipment-gps is authenticated and requires asset.write (fleet managers). Returns devices, optional linked asset names, fetched/report times, nullable position, speed, voltage, and the last successful sync. Private/no-store response. No UI changes are included in this backend PR.
- Fetch time is not report time. Only explicitly zoned ISO timestamps are normalized in the initial adapter. Ambiguous timestamps remain unknown until real provider responses establish their format/timezone. Unknown voltage remains null; GPS never changes machine availability, meter readings, or assigned site.
- Provider failures retain prior observations. Older observations cannot replace newer ones. Bounded requests reject redirects, oversized responses, duplicate or malformed identifiers. Logs contain only counts or generic failure notices.

## Remaining live validation / rollout gate

No live GPS API call or portal deployment has been completed. Cloudflare credential-name inspection found no GPS settings. A hidden-input macOS dialog requests the SilverCloud password; the entered value is held temporarily in restricted local setup storage, outside Git, pending secure credential provisioning. Do not print it. The provider token remains in the source mailbox. The code cannot be enabled until a live API sample verifies credentials, response shape, and timestamp representation.

After credential validation: review the PR, back up D1, apply migration, provision secrets securely, deploy portal only, enable polling, verify the first sync, and insert only confirmed asset matches. Keep unidentified trackers unmapped. Coordinate GPS display work with the customer-facing account using the above JSON contract. Do not label this feature live or available on the phone until that display and production checks are complete.
