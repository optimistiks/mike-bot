import { defineConfig, globalIgnores } from "eslint/config";
import {
  typeScriptFiles,
  typeScriptRuleOverrides,
} from "@mike-bot/eslint-config/base";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

const typeCheckedConfigs = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
].map((config) => ({
  ...config,
  files: typeScriptFiles,
}));

export default defineConfig(
  ...nextVitals,
  {
    settings: {
      react: { version: "19.2.8" },
    },
  },
  ...typeCheckedConfigs,
  {
    files: typeScriptFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: typeScriptRuleOverrides,
  },
  prettier,
  globalIgnores([
    "eslint.config.mjs",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "drizzle/**",
  ]),
);
