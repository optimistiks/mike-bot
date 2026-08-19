import type { Config } from "drizzle-kit";

import { loadEnvFiles, resolveDatabaseUrl } from "./lib/load-env-files";

loadEnvFiles();

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: resolveDatabaseUrl(),
  },
} satisfies Config;
