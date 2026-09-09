import { PGlite } from "@electric-sql/pglite";
import { schema } from "@mike-bot/bot-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import path from "node:path";

const migrationsFolder = path.join(import.meta.dirname, "../../bot-core/drizzle");

interface TestDatabase {
  client: PGlite;
  db: ReturnType<typeof drizzlePglite<typeof schema>>;
}

async function createTestDb(): Promise<TestDatabase> {
  const client = new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder });
  return { client, db };
}

async function closeTestDb({ client }: TestDatabase): Promise<void> {
  await client.close();
}

export { closeTestDb, createTestDb, type TestDatabase };
