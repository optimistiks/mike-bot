import type { NextConfig } from "next";

import { withSentryConfig } from "@sentry/nextjs/config";
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

function isCi(): boolean {
  // eslint-disable-next-line node/no-process-env -- CI is a build-time flag
  const ci = process.env.CI;
  if (ci === undefined || ci === "") {
    return false;
  }
  return true;
}

export default withSentryConfig(nextConfig, {
  silent: !isCi(),
  widenClientFileUpload: true,
});
