import path from "node:path";

/** Resolve a script path env var against the app directory. */
export function resolvePath(raw: string | undefined, fallback: string): string {
  return path.resolve(process.cwd(), raw?.trim() ?? fallback);
}

export function readOptionalChatId(): number | undefined {
  const raw = process.env.IMPORT_CHAT_ID?.trim();
  if (!raw) {
    return undefined;
  }

  const chatId = Number(raw);
  if (!Number.isInteger(chatId)) {
    throw new Error("IMPORT_CHAT_ID must be an integer");
  }

  return chatId;
}

export function requireDatabaseUrl(): string {
  const databaseUrl =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required (set DATABASE_URL or DATABASE_URL_UNPOOLED in .env.local or the shell)",
    );
  }

  return databaseUrl;
}
