// `pnpm account:import <login> <file>`: a local dashboard.sqlite copied into an existing, empty hosted account's file,
// run on the server with the hosted server stopped.
import { existsSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { platformDefaults } from '../config.ts';
import { MIGRATIONS } from '../db/open.ts';
import { accountByLogin, openAccountsDb } from './accounts.ts';
import { accountFiles } from './account-files.ts';

export type AccountImport = { ok: true; accountId: number } | { ok: false; reason: string };

/** The newest migration this server knows, as drizzle's migrator reads it and writes it to `created_at`. */
function newestMigration(): number {
  return Math.max(...readMigrationFiles({ migrationsFolder: MIGRATIONS }).map((migration) => migration.folderMillis));
}

/** Why `source` can't be imported, or null: not an edward database (unreadable, or no migrations or `units` table), or
 * migrated past this server. */
function sourceRefusal(source: Database.Database): string | null {
  try {
    const tables = source
      .prepare("select name from sqlite_master where type = 'table' and name in ('__drizzle_migrations', 'units')")
      .all();
    if (tables.length !== 2) return 'the file is not an edward database';
    const { newest } = source.prepare('select max(created_at) as newest from __drizzle_migrations').get() as {
      newest: number | null;
    };
    return newest !== null && Number(newest) > newestMigration()
      ? "the file's migrations are newer than this server's"
      : null;
  } catch {
    return 'the file is not an edward database';
  }
}

/** Whether the account file at `file` holds a unit or an import, read without opening it for writing. */
function holdsData(file: string): boolean {
  if (!existsSync(file)) return false;
  const db = new Database(file, { readonly: true });
  try {
    const { held } = db
      .prepare('select exists(select 1 from units) or exists(select 1 from imports) as held')
      .get() as { held: number };
    return held === 1;
  } finally {
    db.close();
  }
}

/**
 * Copies the edward database in `file` into the account signed in as `login`, whose file must hold no unit and no
 * import; any refusal changes nothing. The copy is `VACUUM INTO` a temporary file beside the account's, renamed into
 * place, then opened once through `accountFiles`, which migrates an older file and rebuilds its derived values; a
 * failed copy or first open leaves the account with no file.
 */
export function importAccountFile(opts: { dataDir: string; login: string; file: string }): AccountImport {
  const { dataDir, login, file } = opts;
  // No accounts database means no account; it isn't opened, so a mistaken run creates none.
  const accountsFile = join(dataDir, 'accounts.sqlite');
  let account = null;
  if (existsSync(accountsFile)) {
    const accounts = openAccountsDb(accountsFile);
    account = accountByLogin(accounts, login);
    accounts.$client.close();
  }
  if (!account) return { ok: false, reason: `no account for ${login}: sign in first` };

  let source: Database.Database;
  try {
    source = new Database(file, { readonly: true, fileMustExist: true });
  } catch {
    return { ok: false, reason: 'the file is not an edward database' };
  }
  const files = accountFiles(dataDir);
  try {
    const refusal = sourceRefusal(source);
    if (refusal) return { ok: false, reason: refusal };
    const target = files.file(account.id);
    if (holdsData(target)) return { ok: false, reason: `account ${login} already holds data` };
    files.remove(account.id);
    const temporary = `${target}.import`;
    rmSync(temporary, { force: true });
    try {
      source.prepare('VACUUM INTO ?').run(temporary);
      renameSync(temporary, target);
    } catch (error) {
      rmSync(temporary, { force: true });
      throw error;
    }
    try {
      files.db(account.id);
    } catch (error) {
      // A copy that can't be migrated or rebuilt is taken out again, so the account stays empty.
      files.remove(account.id);
      throw error;
    }
    return { ok: true, accountId: account.id };
  } finally {
    source.close();
    files.close();
  }
}

if (import.meta.main) {
  const [login, file] = process.argv.slice(2);
  if (!login || !file) {
    console.error('usage: pnpm account:import <login> <file>');
    process.exitCode = 1;
  } else {
    const dataDir = platformDefaults(process.platform, process.env, homedir()).dataDir;
    const result = importAccountFile({ dataDir, login, file });
    if (result.ok) console.log(`imported into account ${login}`);
    else {
      console.error(result.reason);
      process.exitCode = 1;
    }
  }
}
