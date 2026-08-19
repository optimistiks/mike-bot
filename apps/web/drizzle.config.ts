import type { Config } from "drizzle-kit";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: [".env.local", ".env"] });

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
