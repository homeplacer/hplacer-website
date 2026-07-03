import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project — there's a stray package-lock.json
  // in the home directory that otherwise confuses Next's root inference.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
