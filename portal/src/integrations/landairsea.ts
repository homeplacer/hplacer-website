/** Read-only LandAirSea Tracking API. Never log requests, responses, or credentials. */
export interface LandAirSeaCredentials {
  clientToken: string;
  username: string;
  password: string;
}
export interface TrackerPosition {
  deviceId: string;
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
export function parseTrackerPositions(payload: unknown): TrackerPosition[] {
  const root = record(payload);
  if (record(root?.message)?.result !== true || !Array.isArray(root?.DeviceDetails)) {
    throw new Error("GPS provider did not return a successful device list");
  }
  if (root.DeviceDetails.length > 1000) throw new Error("GPS device list exceeds limit");
  const seen = new Set<string>();
  return root.DeviceDetails.map((item: unknown) => {
    const device = record(item);
    const id = device?.DeviceId;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || seen.has(id)) {
      throw new Error("GPS provider returned an invalid or duplicate device identifier");
    }
    seen.add(id);
    const lat = numeric(device?.Latitude, -90, 90);
    const lon = numeric(device?.Longitude, -180, 180);
    return {
      deviceId: id,
      latitude: lat !== null && lon !== null ? lat : null,
      longitude: lat !== null && lon !== null ? lon : null,
      reportedAt: timestamp(device?.LastLocationTimestamp),
      speedKmh: numeric(device?.Speed_kmh, 0, 1000),
      voltage: numeric(device?.Voltage, 0, 100),
    };
  });
}
export async function fetchTrackerPositions(credentials: LandAirSeaCredentials, fetcher: typeof fetch = fetch): Promise<TrackerPosition[]> {
  if (Object.values(credentials).some(value => !value.trim())) throw new Error("GPS credentials are incomplete");
  let response: Response;
  try {
    response = await fetcher(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ClientId: "homeplacer-portal-gps" },
      body: JSON.stringify(credentials),
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch { throw new Error("GPS provider connection failed"); }
  if (!response.ok) throw new Error("GPS provider request failed");
  if (!response.body) throw new Error("GPS provider returned an empty response");
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
    return parseTrackerPositions(JSON.parse(text));
  } catch { throw new Error("GPS provider returned an invalid response"); }
  finally { reader.releaseLock(); }
}
