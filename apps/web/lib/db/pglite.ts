import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';

import { schema, type Schema } from './schema';

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

export type PgliteDatabase = {
  db: ReturnType<typeof drizzlePglite<Schema>>;
  client: PGlite;
};

/** Local dev and tests: in-memory PGlite with the same schema as production. */
export async function createPgliteDb(
  migrationsDir = migrationsFolder,
): Promise<PgliteDatabase> {
  const client = new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder: migrationsDir });
  return { db, client };
}

export async function closePgliteDb({ client }: PgliteDatabase): Promise<void> {
  await client.close();
}
