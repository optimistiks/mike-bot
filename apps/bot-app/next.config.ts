import type { NextConfig } from "next";

import path from "node:path";

import "./src/env";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: [
      {
        hostname: "**",
        protocol: "https",
      },
    ],
  },
  outputFileTracingRoot: path.join(import.meta.dirname, "../.."),
};

export default nextConfig;
