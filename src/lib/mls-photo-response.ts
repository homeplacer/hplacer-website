import { isMlsListingKey, isMlsPhotoSource, MLS_PHOTO_CACHE_SECONDS, MLS_PHOTO_WIDTHS } from "./mls-photo";

// Structural binding types keep this helper usable in offline, intercepted tests.
export interface MlsImagesBinding {
  info(stream: ReadableStream<Uint8Array>): Promise<{ width?: number; height?: number; format?: string }>;
  input(stream: ReadableStream<Uint8Array>): {
    transform(options: { width: number; fit: "scale-down" }): {
      output(options: { format: "image/webp"; quality: number }): Promise<{ response(): Response }>;
    };
  };
}

type PhotoListing = { listingKey: string; photoUrl?: string };
type PhotoCache = Pick<Cache, "match" | "put">;
type Dependencies = {
  getListings(): Promise<PhotoListing[]>;
  images?: MlsImagesBinding;
  cache?: PhotoCache;
  fetch?: typeof fetch;
  waitUntil?: (promise: Promise<unknown>) => void;
};

const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 3 * 1024 * 1024;
const RASTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function failure(status: number) {
  return new Response("MLS photo unavailable", {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}

async function boundedBytes(response: Response, limit: number) {
  const length = response.headers.get("Content-Length");
  if (length && (!/^[0-9]+$/.test(length) || Number(length) > limit)) throw new Error("Image exceeds byte limit");
  if (!response.body) throw new Error("Empty image body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 7_000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("Image exceeds byte limit");
      chunks.push(value);
    }
    if (timedOut) throw new Error("Image stream timed out");
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  if (!size) throw new Error("Empty image body");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

function stream(bytes: Uint8Array) {
  return new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } });
}

async function deadline<T>(operation: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Image processing timed out")), 7_000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

/** Dynamic route only. Active membership is checked before every media cache hit. */
export async function mlsPhotoResponse(request: Request, listingKey: string, widthValue: string, dependencies: Dependencies) {
  if (request.method !== "GET") return failure(405);
  const url = new URL(request.url);
  const width = Number(widthValue);
  if (!isMlsListingKey(listingKey) || !MLS_PHOTO_WIDTHS.some((candidate) => candidate === width) ||
      widthValue !== String(width) || url.search || url.pathname !== `/api/mls-photo/${listingKey}/${width}`) return failure(400);
  try {
    const listing = (await dependencies.getListings()).find((item) => item.listingKey === listingKey);
    if (!listing || !isMlsPhotoSource(listingKey, listing.photoUrl)) return failure(404);
    if (!dependencies.images) return failure(503);
    // Fixed namespace/origin prevents host, query and encoding variations from growing cache keys.
    const cacheKey = new Request(`https://hplacer.com/__mls-photo-cache/v1/${listingKey}/${width}`);
    let cached: Response | undefined;
    try { cached = await dependencies.cache?.match(cacheKey); } catch { /* Cache failures must not break photos. */ }
    if (cached) {
      const age = Math.max(0, Math.floor((Date.now() - Date.parse(cached.headers.get("Date") ?? "")) / 1000));
      if (Number.isFinite(age) && age < MLS_PHOTO_CACHE_SECONDS) {
        const headers = new Headers(cached.headers);
        headers.set("Age", String(age));
        return new Response(cached.body, { headers });
      }
    }
    const upstream = await (dependencies.fetch ?? fetch)(listing.photoUrl, {
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(7_000),
    });
    if (upstream.status !== 200 || !RASTER_TYPES.has(upstream.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? "")) return failure(502);
    const source = await boundedBytes(upstream, MAX_SOURCE_BYTES);
    const info = await deadline(dependencies.images.info(stream(source)));
    if (!RASTER_TYPES.has(info.format ?? "") || !Number.isInteger(info.width) || !Number.isInteger(info.height) || !info.width || !info.height ||
        info.width < 1 || info.height < 1 || info.width > 10_000 || info.height > 10_000 || info.width * info.height > 40_000_000) return failure(502);
    // Never label scale-down's smaller output as a larger width descriptor or upscale a source.
    if (width > info.width) return failure(422);
    const result = await deadline(dependencies.images.input(stream(source))
      .transform({ width, fit: "scale-down" }).output({ format: "image/webp", quality: 75 }));
    const output = result.response();
    if (output.status !== 200 || output.headers.get("Content-Type") !== "image/webp") return failure(502);
    const bytes = await boundedBytes(output, MAX_OUTPUT_BYTES);
    const actual = await deadline(dependencies.images.info(stream(bytes)));
    if (actual.format !== "image/webp" || actual.width !== width || !Number.isInteger(actual.height) ||
        !actual.height || actual.height < 1 || actual.height > 10_000 || width * actual.height > 40_000_000) return failure(502);
    const response = new Response(bytes, { headers: {
      "Content-Type": "image/webp", "Content-Length": String(bytes.byteLength),
      "Cache-Control": `public, max-age=${MLS_PHOTO_CACHE_SECONDS}`,
      "Date": new Date().toUTCString(), "X-Content-Type-Options": "nosniff",
    } });
    if (dependencies.cache) {
      const put = dependencies.cache.put(cacheKey, response.clone()).catch(() => {});
      if (dependencies.waitUntil) dependencies.waitUntil(put); else await put;
    }
    return response;
  } catch { return failure(503); }
}
