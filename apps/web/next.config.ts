import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  reactStrictMode: true,
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
};

export default nextConfig;
