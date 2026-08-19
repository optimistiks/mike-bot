/** Shared TypeScript ESLint settings for monorepo packages. */
export const typeScriptFiles = ["**/*.{ts,tsx}"];

export const typeScriptRuleOverrides = {
  "@typescript-eslint/no-unused-vars": "warn",
  "@typescript-eslint/no-unused-expressions": "warn",
};
