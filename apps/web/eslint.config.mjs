import { defineConfig, globalIgnores } from "eslint/config";
import { baseConfig } from "@mike-bot/eslint-config/base";
import { nextConfig } from "@mike-bot/eslint-config/next";

export default defineConfig(
  ...nextConfig,
  {
    settings: {
      react: { version: "19.2.8" },
    },
  },
  ...baseConfig,
  globalIgnores([
    "eslint.config.mjs",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
    "public/mockServiceWorker.js",
  ]),
);
