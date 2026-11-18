import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';

// Two levels up from this file, so it is found from src/db/ and from a build that keeps the layout (dist/db/).
export const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

export type Db = ReturnType<typeof openDb>;
/** A transaction on a Db, for helpers that run inside one. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** A SQLite file with its Drizzle schema, its folder created with mode 0700 (the data is personal), its pragmas set,
 * migrated from `migrationsFolder` to the latest schema. */
export function openSqlite<S extends Record<string, unknown>>(
  file: string,
  tables: S,
  migrationsFolder: string,
  pragmas: string[] = [],
) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const client = new Database(file);
  for (const pragma of pragmas) client.pragma(pragma);
  const db = drizzle(client, { schema: tables });
  migrate(db, { migrationsFolder });
  return db;
}

/** The database in `file`, through `openSqlite`. */
export function openDb(file: string) {
  return openSqlite(file, schema, MIGRATIONS);
}
