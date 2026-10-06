import type { PortalEnv } from "../platform/types.ts";
import { fetchTrackerPositions } from "./landairsea.ts";
/** No name-based guesses, no machine status/meter/location changes, no provider writes. */
export async function runConfiguredGpsSync(env: PortalEnv, fetcher: typeof fetch = fetch) {
  if (env.GPS_SYNC_ENABLED !== "true") return { enabled: false, devices: 0 };
  if (!env.LANDAIRSEA_CLIENT_TOKEN || !env.LANDAIRSEA_USERNAME || !env.LANDAIRSEA_PASSWORD) {
    throw new Error("GPS credentials are incomplete");
  }
  const positions = await fetchTrackerPositions({ clientToken: env.LANDAIRSEA_CLIENT_TOKEN, username: env.LANDAIRSEA_USERNAME, password: env.LANDAIRSEA_PASSWORD }, fetcher);
  const fetchedAt = new Date().toISOString();
  const statements = positions.map(p => env.PORTAL_DB.prepare(`
    INSERT INTO gps_devices (device_id, provider_name, latitude, longitude, reported_at, speed_kmh, voltage, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      provider_name=excluded.provider_name,
      latitude=excluded.latitude, longitude=excluded.longitude, reported_at=excluded.reported_at,
      speed_kmh=excluded.speed_kmh, voltage=excluded.voltage, fetched_at=excluded.fetched_at
    WHERE (gps_devices.reported_at IS NULL OR excluded.reported_at >= gps_devices.reported_at)
      AND excluded.fetched_at >= gps_devices.fetched_at
  `).bind(p.deviceId, p.name, p.latitude, p.longitude, p.reportedAt, p.speedKmh, p.voltage, fetchedAt));
  statements.push(env.PORTAL_DB.prepare(`INSERT INTO gps_sync_state (id, last_success_at, device_count)
    VALUES ('landairsea', ?, ?) ON CONFLICT(id) DO UPDATE SET
    last_success_at=excluded.last_success_at, device_count=excluded.device_count
    WHERE excluded.last_success_at >= gps_sync_state.last_success_at`).bind(fetchedAt, positions.length));
  await env.PORTAL_DB.batch(statements);
  return { enabled: true, devices: positions.length };
}
