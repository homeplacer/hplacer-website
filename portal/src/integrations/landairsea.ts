export class GpsError extends Error {
  readonly stage: string;
  constructor(message: string, stage: string) { super(message); this.stage = stage; }
}
export function gpsFailureStage(error: unknown): string {
  return error instanceof GpsError ? error.stage : "unexpected";
}
/** Read-only LandAirSea Tracking API. Never log requests, responses, or credentials. */
export interface LandAirSeaCredentials {
  clientToken: string;
  username: string;
  password: string;
}
export interface TrackerPosition {
  deviceId: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
  reportedAt: string | null;
  speedKmh: number | null;
  voltage: number | null;
}
const ENDPOINT = "https://gateway.landairsea.com/Track/MyDevices";
const MAX_BYTES = 1_000_000;
function numeric(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;
}
function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
/** Reject ambiguous local timestamps: a successful fetch is not proof of a recent fix. */
function timestamp(value: unknown): string | null {
  if (typeof value !== "string" || !/T.*(?:Z|[+-]\d\d:\d\d)$/i.test(value)) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
/** The live API explicitly labels this US-formatted field as UTC. */
function providerUtc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const iso = timestamp(value);
  if (iso) return iso;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2}):(\d{2}) (AM|PM)$/.exec(value);
  if (!m) return null;
  const [, month, day, year, hour, minute, second, period] = m;
  const h = Number(hour);
  if (h < 1 || h > 12 || Number(minute) > 59 || Number(second) > 59) return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), h % 12 + (period === "PM" ? 12 : 0), Number(minute), Number(second)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) return null;
  return date.toISOString();
}
export function parseTrackerPositions(payload: unknown): TrackerPosition[] {
  const root = record(payload);
  const devices = root?.devicedetails ?? root?.DeviceDetails;
  if (record(root?.message)?.result !== true || root?.suspended === true || !Array.isArray(devices)) {
    throw new Error("GPS provider did not return a successful device list");
  }
  if (devices.length > 1000) throw new Error("GPS device list exceeds limit");
  const seen = new Set<string>();
  return devices.map((item: unknown) => {
    const device = record(item);
    const id = device?.deviceId ?? device?.DeviceId;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || seen.has(id)) {
      throw new Error("GPS provider returned an invalid or duplicate device identifier");
    }
    seen.add(id);
    const lat = numeric(device?.latitude ?? device?.Latitude, -90, 90);
    const lon = numeric(device?.longitude ?? device?.Longitude, -180, 180);
    return {
      deviceId: id,
      name: typeof device?.name === "string" ? device.name.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120) || null : null,
      latitude: lat !== null && lon !== null ? lat : null,
      longitude: lat !== null && lon !== null ? lon : null,
      reportedAt: device?.utctime !== undefined ? providerUtc(device.utctime) : timestamp(device?.LastLocationTimestamp),
      speedKmh: numeric(device?.speed_kmh ?? device?.Speed_kmh, 0, 1000),
      voltage: numeric(device?.voltage ?? device?.Voltage, 0, 100),
    };
  });
}
export async function fetchTrackerPositions(credentials: LandAirSeaCredentials, fetcher: typeof fetch = fetch): Promise<TrackerPosition[]> {
  if (Object.values(credentials).some(value => !value.trim())) throw new GpsError("GPS credentials are incomplete", "configuration");
  let response: Response;
  try {
    response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ClientId: "homeplacer-portal-gps" },
      body: JSON.stringify(credentials),
      // Workers supports manual redirects; reject 3xx below without forwarding credentials.
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new GpsError("GPS provider connection failed", "connection"); }
  if (!response.ok) throw new GpsError("GPS provider request failed", `http_${response.status}`);
  if (!response.body) throw new GpsError("GPS provider returned an empty response", "empty_response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BYTES) { await reader.cancel(); throw new Error("limit"); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { throw new GpsError("GPS provider returned an invalid response", "json"); }
    if (record(record(parsed)?.message)?.result !== true) throw new GpsError("GPS provider returned an invalid response", "provider_rejected");
    try { return parseTrackerPositions(parsed); } catch { throw new GpsError("GPS provider returned an invalid response", "device_format"); }
  } catch (error) { if (error instanceof GpsError) throw error; throw new GpsError("GPS provider returned an invalid response", "response_stream"); }
  finally { reader.releaseLock(); }
}
