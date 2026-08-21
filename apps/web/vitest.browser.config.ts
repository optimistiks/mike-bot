import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  optimizeDeps: {
    include: [
      "react/jsx-dev-runtime",
      "react",
      "vitest-browser-react",
      "@tma.js/sdk-react",
      "zod",
    ],
  },
  test: {
    include: ["**/*.browser.test.{ts,tsx}"],
    testTimeout: 10_000,
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
