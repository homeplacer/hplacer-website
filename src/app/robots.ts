import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

export const dynamic = "force-static";

// Explicitly welcome all crawlers — including AI crawlers (GPTBot, ClaudeBot,
// PerplexityBot, Google-Extended), which many sites accidentally block.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
