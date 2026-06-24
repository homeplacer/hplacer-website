import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Pure SSR + SSG (build-time pre-render) — no ISR/on-demand revalidation here,
// so no R2 incremental cache binding is needed. Add an incrementalCache
// override later if we introduce revalidating data.
export default defineCloudflareConfig();
