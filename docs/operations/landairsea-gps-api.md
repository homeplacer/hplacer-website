# LandAirSea GPS connection — October 6, 2026

User authorized proceeding with the GPS integration. Confirmed tracker-to-machine associations must remain unchanged; unidentified devices must not be assigned by guesswork.

## Verified source

LandAirSea's October 1 reply to Brandon supplied an account client token and two PDF guides, REPORTING_API_12Feb2026.pdf and TRACKING_API_15Feb2023.pdf. The Tracking guide documents a read-only POST to https://gateway.landairsea.com/Track/MyDevices with clientToken, username, password; Content-Type application/json and a stable ClientId header. The reporting API is unnecessary for the initial location poll. No provider write or report-email method is used.

## Backend contract

- Worker secrets: LANDAIRSEA_CLIENT_TOKEN, LANDAIRSEA_USERNAME, LANDAIRSEA_PASSWORD. Do not commit or print values.
- GPS_SYNC_ENABLED must equal true; default is off. Poll uses the existing fifteen-minute cron.
- Migration 0022 adds gps_devices and gps_sync_state. Device-to-asset links are optional and unique. Polling does not create or modify those links.
- GET /api/equipment-gps is authenticated and requires asset.write (fleet managers). Returns devices, optional linked asset names, fetched/report times, nullable position, speed, voltage, and the last successful sync. Private/no-store response. The follow-up /equipment-gps view and Equipment link use the same fleet-manager permission.
- Fetch time is not report time. Explicitly zoned ISO timestamps and the live provider’s explicitly UTC field are normalized. Ambiguous timestamps remain unknown until real provider responses establish their format/timezone. Unknown voltage remains null; GPS never changes machine availability, meter readings, or assigned site.
- Provider failures retain prior observations. Older observations cannot replace newer ones. Bounded requests reject redirects, oversized responses, duplicate or malformed identifiers. Logs contain only counts or generic failure notices.

## Remaining live validation / rollout gate

Live validation succeeded October 6 after the user re-entered the working password. MyDevices returned eleven devices; all eleven have valid positions and explicitly UTC report times. The newest observation is September 17, 2026, so none of these readings proves a current location. Earlier authentication failures were superseded by this successful check. A support inquiry had already been sent; no credential values were included.

The live response uses devicedetails, deviceId, name, latitude, longitude, speed_kmh, voltage, and utctime. utctime uses M/D/YYYY h:mm:ss AM/PM and is parsed explicitly as UTC with calendar validation. usertime is not used. lastlocation contains an address, not a timestamp. The parser supports the original documented PascalCase variant as well. Provider names are display labels only, never automatic asset links.

Release remains gated on reviewed code, database backup/migration, secure Worker secret provisioning, and verification of a scheduled production sync. The user subsequently authorized the phone GPS view directly; it is prepared in a separate follow-up branch.

After credential validation: review the PR, back up D1, apply migration, provision secrets securely, deploy portal only, enable polling, verify the first sync, and insert only confirmed asset matches. Keep unidentified trackers unmapped. Coordinate GPS display work with the customer-facing account using the above JSON contract. Do not label this feature live or available on the phone until that display and production checks are complete.


## Customer-facing integration handoff

The follow-up adds a manager-only GPS view using asset.write, matching the API gate. Existing equipment pages are employee-readable, so do not expose GPS there without that separate permission. A server-rendered /equipment-gps page avoids the equipment detail route collision and works with the current content-security policy. Show device name, optional mapped machine, last-reported time, and a user-initiated map link, with last successful API check separately. Mark old/unknown observation times clearly; do not call readings live. No real asset-ID mappings were found in this branch; preserve existing confirmed links and leave uncertain devices unassigned.


## October 6 rollout evidence

Backend release is deployed and migration0022 applied. Credentials are stored in Cloudflare and the password in the Mac login Keychain; temporary password forms were stopped and the plaintext password file removed. Initial manual production sync saved eleven readings; the automatic scheduled run is still being verified separately. Three unique existing SilverCloud labels were linked to portal assets (Bobcat T66, Ford F150, Gooseneck40ft), with audit records. All ambiguous labels remain unmapped; no provider labels, tracker settings, asset status, or assigned sites were changed.

The phone-view follow-up also disables the pre-existing MONDAY_WRITE_SYNC_ENABLED setting to honor the user's standing read-only instruction. Monday home imports remain enabled. This changes only portal configuration, not Monday boards.
