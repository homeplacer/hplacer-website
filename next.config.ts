import type { NextConfig } from "next";
import path from "node:path";

// GitHub Pages static-export mode — enabled only when PAGES_BUILD=1 so the
// default (Vercel/dev) build keeps the lead API + root paths intact.
const pages = process.env.PAGES_BUILD === "1";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project — there's a stray package-lock.json
  // in the home directory that otherwise confuses Next's root inference.
  turbopack: {
    root: path.join(__dirname),
  },
  ...(pages
    ? {
        output: "export" as const,
        basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
