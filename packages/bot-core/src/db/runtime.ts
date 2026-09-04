import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type { AppDatabase } from "./pglite.js";
import type { Schema } from "./schema.js";

type BotDatabase = AppDatabase | NodePgDatabase<Schema>;

type BotSession = Pick<BotDatabase, "insert" | "select" | "update">;

export type { BotDatabase, BotSession };
