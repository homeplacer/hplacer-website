import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getLivePackageListings } from "@/lib/forturro-package-feed";
import { mlsPhotoResponse, type MlsImagesBinding } from "@/lib/mls-photo-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ listingKey: string; width: string }> }) {
  const { listingKey, width } = await params;
  let images: MlsImagesBinding | undefined;
  let waitUntil: ((promise: Promise<unknown>) => void) | undefined;
  try {
    const { env, ctx } = getCloudflareContext();
    images = (env as typeof env & { MLS_IMAGES?: MlsImagesBinding }).MLS_IMAGES;
    waitUntil = (promise) => ctx.waitUntil(promise);
  } catch { /* next start/dev without a Worker binding still has an original-photo fallback. */ }
  const cache = (globalThis as typeof globalThis & { caches?: CacheStorage & { default?: Cache } }).caches?.default;
  return mlsPhotoResponse(request, listingKey, width, { getListings: getLivePackageListings, images, cache, waitUntil });
}

// Next otherwise implements HEAD via GET, which could trigger unnecessary transformations.
export function HEAD() { return new Response(null, { status: 405, headers: { "Allow": "GET", "Cache-Control": "no-store" } }); }
