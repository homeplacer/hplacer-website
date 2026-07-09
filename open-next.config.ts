import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Site is 100% static (SSG, no ISR/on-demand revalidation), so we serve the
// build-time prerendered pages from Workers static assets (the existing ASSETS
// binding) instead of re-rendering on every request. Without this the adapter
// falls back to the "dummy" no-op cache: every hit is x-nextjs-cache: MISS and
// re-runs the full React server render in the Worker, driving CPU P90 up and the
// 1102 "Worker exceeded CPU" errors under load. Read-only cache — if we ever add
// ISR/revalidating data, switch to r2-incremental-cache + an R2 binding.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
