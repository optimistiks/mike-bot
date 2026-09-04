import type { Config } from "drizzle-kit";

import { config as loadDotenv } from "dotenv";

import { unpooledDatabaseUrl } from "#src/env.js";

loadDotenv({ path: [".env.local", ".env"] });

// eslint-disable-next-line import/no-default-export -- drizzle-kit config
export default {
  dbCredentials: {
    url: unpooledDatabaseUrl(),
  },
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/bot/db/schema.ts",
} satisfies Config;
