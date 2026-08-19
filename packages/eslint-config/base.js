import prettier from "eslint-config-prettier/flat";

export const typeScriptFiles = ["**/*.{ts,tsx}"];

/**
 * Framework-agnostic TypeScript strict lint configs.
 * Pass the app's `typescript-eslint` import so plugin instances stay deduped
 * when composed with framework configs in the consuming package.
 */
export function createTypescriptStrictConfigs(tseslint) {
  const typeCheckedConfigs = [
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
  ].map((config) => ({
    ...config,
    files: typeScriptFiles,
  }));

  return [
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
}
