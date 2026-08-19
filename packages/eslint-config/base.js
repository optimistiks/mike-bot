import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

const typeScriptFiles = ["**/*.{ts,tsx}"];

const typeCheckedConfigs = [
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
].map((config) => ({
  ...config,
  files: typeScriptFiles,
}));

/** Framework-agnostic TypeScript ESLint flat config for monorepo packages. */
export const baseConfig = [
  ...typeCheckedConfigs,
  {
    files: typeScriptFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
  prettier,
];
