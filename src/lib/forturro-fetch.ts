import { getCloudflareContext } from "@opennextjs/cloudflare";

export const HPLACER_FEED_UA = "hplacer-app/1.0 (+https://hplacer.com)";

/** Identity headers Forturro's WAF skip rule requires for /api/hplacer/* and /api/img/*. */
export function forturroFeedHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  headers.set("user-agent", HPLACER_FEED_UA);
  let token: string | undefined;
  try {
    token = (getCloudflareContext().env as { FORTURRO_FEED_TOKEN?: string }).FORTURRO_FEED_TOKEN;
  } catch { /* outside a Worker request */ }
  token ??= process.env.FORTURRO_FEED_TOKEN;
  if (token) headers.set("x-hplacer-feed", token);
  return headers;
}
