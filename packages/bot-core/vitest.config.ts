import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const srcDir = fileURLToPath(new URL("src", import.meta.url));

// eslint-disable-next-line import/no-default-export -- vitest config
export default defineConfig({
  resolve: {
    alias: {
      "#src": srcDir,
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
