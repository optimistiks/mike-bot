import { attachDatabasePool } from '@vercel/functions';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePostgres } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import { Pool } from 'pg';

import { schema, type Schema } from './schema';

export type Database = ReturnType<typeof drizzleNodePostgres<Schema>>;

let productionDb: Database | undefined;

/** Production Neon client: TCP `Pool` + Vercel Fluid lifecycle via `attachDatabasePool`. */
export function getProductionDb(connectionString: string): Database {
  if (!productionDb) {
    const pool = new Pool({ connectionString });
    attachDatabasePool(pool);
    productionDb = drizzleNodePostgres({ client: pool, schema });
  }

  return productionDb;
}

export type PgliteDatabase = {
  db: ReturnType<typeof drizzlePglite<Schema>>;
  client: PGlite;
};

/** Local dev and tests: in-memory PGlite with the same schema as production. */
export async function createPgliteDb(
  migrationsFolder = './drizzle',
): Promise<PgliteDatabase> {
  const client = new PGlite();
  const db = drizzlePglite({ client, schema });
  await migratePglite(db, { migrationsFolder });
  return { db, client };
}

export async function closePgliteDb({ client }: PgliteDatabase): Promise<void> {
  await client.close();
}
