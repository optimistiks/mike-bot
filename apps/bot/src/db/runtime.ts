import type { AppDatabase } from "./pglite";
import type { ProductionDatabase } from "./production";

export type BotDatabase = AppDatabase | ProductionDatabase;

export type BotSession = Pick<BotDatabase, "insert" | "select" | "update">;
