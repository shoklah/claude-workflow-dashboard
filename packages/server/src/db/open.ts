import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';

// Two levels up from this file, so it is found from src/db/ and from a build that keeps the layout (dist/db/).
const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

export type Db = ReturnType<typeof openDb>;
/** A transaction on a Db, for helpers that run inside one. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** The database in `file`, its folder created with mode 0700 (the data is personal), migrated to the latest schema. */
export function openDb(file: string) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = drizzle(new Database(file), { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}
