import type { AppDatabase } from "./pglite.js";
import type { ProductionDatabase } from "./production.js";

type BotDatabase = AppDatabase | ProductionDatabase;

type BotSession = Pick<BotDatabase, "insert" | "select" | "update">;

export type { BotDatabase, BotSession };
