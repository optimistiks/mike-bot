import type { AppDatabase } from "./pglite.js";
import type { ProductionDatabase } from "./production.js";

export type BotDatabase = AppDatabase | ProductionDatabase;

export type BotSession = Pick<BotDatabase, "insert" | "select" | "update">;
