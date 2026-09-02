import { config as loadDotenv } from "dotenv";
import type { Config } from "drizzle-kit";

loadDotenv({ path: [".env.local", ".env"] });

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
} satisfies Config;
