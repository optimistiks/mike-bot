import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.join(webRoot, "..", "..");

/** Load `.env` / `.env.local` from repo root and `apps/web` (later files override). */
export function loadEnvFiles(): void {
  for (const file of [
    path.join(repoRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(webRoot, ".env"),
    path.join(webRoot, ".env.local"),
  ]) {
    loadDotenv({ path: file, override: true });
  }
}

/** Direct Neon URL for DDL and bulk scripts; pooled `DATABASE_URL` is the fallback. */
export function resolveDatabaseUrl(): string {
  return process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";
}
