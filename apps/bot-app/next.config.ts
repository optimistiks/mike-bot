import type { NextConfig } from "next";

import path from "node:path";

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
