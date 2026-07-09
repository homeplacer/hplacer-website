// Normalizes an asset reference to a URL the browser can load. Currently a
// passthrough — remote URLs, data: URIs, and local /public paths are all served
// as-is on Cloudflare Workers. Kept as a single choke point so a future move to a
// CDN or base path only needs to change this one function, not every call site.
// (The old NEXT_PUBLIC_BASE_PATH prefixing was for a since-removed GitHub Pages
// static export and never set in the current deploy, so asset() was already an
// identity function.)
export function asset(p?: string | null): string {
  return p || "";
}
