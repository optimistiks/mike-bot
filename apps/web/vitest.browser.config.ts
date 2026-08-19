import { playwright } from "@vitest/browser-playwright";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  optimizeDeps: {
    include: ["@tma.js/sdk-react"],
  },
  test: {
    include: ["**/*.browser.test.tsx"],
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
