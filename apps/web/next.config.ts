import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['pg', '@electric-sql/pglite'],
};

export default nextConfig;
