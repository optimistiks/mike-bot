import { defineConfig, globalIgnores } from "eslint/config";
import { createTypescriptStrictConfigs } from "@mike-bot/eslint-config/base";
import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

export default defineConfig(
  ...nextVitals,
  {
    settings: {
      react: { version: "19.2.8" },
    },
  },
  ...createTypescriptStrictConfigs(tseslint),
  globalIgnores([
    "eslint.config.mjs",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
  ]),
);
