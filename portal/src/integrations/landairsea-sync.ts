import type { PortalEnv } from "../platform/types.ts";
import { fetchTrackerPositions, GpsError } from "./landairsea.ts";
/** No name-based guesses, no machine status/meter/location changes, no provider writes. */
export async function runConfiguredGpsSync(env: PortalEnv, fetcher: typeof fetch = fetch) {
  if (env.GPS_SYNC_ENABLED !== "true") return { enabled: false, devices: 0 };
  if (!env.LANDAIRSEA_CLIENT_TOKEN || !env.LANDAIRSEA_USERNAME || !env.LANDAIRSEA_PASSWORD) {
    throw new GpsError("GPS credentials are incomplete", "configuration");
  }
  const positions = await fetchTrackerPositions({ clientToken: env.LANDAIRSEA_CLIENT_TOKEN, username: env.LANDAIRSEA_USERNAME, password: env.LANDAIRSEA_PASSWORD }, fetcher);
  const fetchedAt = new Date().toISOString();
  const statements = [env.PORTAL_DB.prepare(`UPDATE gps_devices SET returned_in_last_poll=0
    WHERE NOT EXISTS (SELECT 1 FROM gps_sync_state WHERE id='landairsea')
       OR ? >= (SELECT last_success_at FROM gps_sync_state WHERE id='landairsea')`).bind(fetchedAt)];
  statements.push(...positions.map(p => env.PORTAL_DB.prepare(`
    INSERT INTO gps_devices (device_id, provider_name, latitude, longitude, reported_at, speed_kmh, voltage, fetched_at, last_returned_at, returned_in_last_poll)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(device_id) DO UPDATE SET
      provider_name=CASE WHEN gps_devices.reported_at IS NULL OR (excluded.reported_at IS NOT NULL AND excluded.reported_at >= gps_devices.reported_at) THEN excluded.provider_name ELSE gps_devices.provider_name END,
      latitude=CASE WHEN gps_devices.reported_at IS NULL OR (excluded.reported_at IS NOT NULL AND excluded.reported_at >= gps_devices.reported_at) THEN excluded.latitude ELSE gps_devices.latitude END,
      longitude=CASE WHEN gps_devices.reported_at IS NULL OR (excluded.reported_at IS NOT NULL AND excluded.reported_at >= gps_devices.reported_at) THEN excluded.longitude ELSE gps_devices.longitude END,
      reported_at=CASE WHEN gps_devices.reported_at IS NULL OR (excluded.reported_at IS NOT NULL AND excluded.reported_at >= gps_devices.reported_at) THEN excluded.reported_at ELSE gps_devices.reported_at END,
      speed_kmh=CASE WHEN gps_devices.reported_at IS NULL OR (excluded.reported_at IS NOT NULL AND excluded.reported_at >= gps_devices.reported_at) THEN excluded.speed_kmh ELSE gps_devices.speed_kmh END,
      voltage=CASE WHEN gps_devices.reported_at IS NULL OR (excluded.reported_at IS NOT NULL AND excluded.reported_at >= gps_devices.reported_at) THEN excluded.voltage ELSE gps_devices.voltage END,
      fetched_at=excluded.fetched_at, last_returned_at=excluded.last_returned_at, returned_in_last_poll=1
    WHERE excluded.fetched_at >= gps_devices.fetched_at
  `).bind(p.deviceId, p.name, p.latitude, p.longitude, p.reportedAt, p.speedKmh, p.voltage, fetchedAt, fetchedAt)));
  statements.push(env.PORTAL_DB.prepare(`INSERT INTO gps_sync_state (id, last_success_at, device_count)
    VALUES ('landairsea', ?, ?) ON CONFLICT(id) DO UPDATE SET
    last_success_at=excluded.last_success_at, device_count=excluded.device_count
    WHERE excluded.last_success_at >= gps_sync_state.last_success_at`).bind(fetchedAt, positions.length));
  try { await env.PORTAL_DB.batch(statements); } catch { throw new GpsError("GPS observations could not be saved", "database"); }
  return { enabled: true, devices: positions.length };
}
