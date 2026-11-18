import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { and, eq, gte, lt } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.ts';
import { accounts, collectorTokens, invites, sessions } from './schema.ts';

// Two levels up from this file, as openDb's.
const MIGRATIONS = fileURLToPath(new URL('../../drizzle-hosted', import.meta.url));
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccountsDb = ReturnType<typeof openAccountsDb>;
export type Account = { id: number; login: string };

/** The accounts database in `file`, its folder created with mode 0700, foreign keys on, migrated to the latest schema. */
export function openAccountsDb(file: string) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const client = new Database(file);
  client.pragma('foreign_keys = ON');
  const db = drizzle(client, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  return db;
}

/** A secret's SHA-256 in hex: the only form a session ID or collector token is stored or looked up in. */
export function hashSecret(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** 32 random bytes, base64url. */
export function newSecret(): string {
  return randomBytes(32).toString('base64url');
}

const accountColumns = { id: accounts.id, login: accounts.login };

export function addInvite(db: AccountsDb, login: string, at: Date): void {
  db.insert(invites).values({ login: login.toLowerCase(), addedAt: at }).onConflictDoNothing().run();
}

/**
 * The account of a GitHub user: an existing one by id, its login updated; else a new one when the login is invited or
 * is `admin` (case-insensitive); else null.
 */
export function signInAccount(db: AccountsDb, user: Account, admin: string, at: Date): Account | null {
  return db.transaction((tx) => {
    const existing = tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, user.id)).get();
    if (existing) {
      tx.update(accounts).set({ login: user.login }).where(eq(accounts.id, user.id)).run();
      return { id: user.id, login: user.login };
    }
    const login = user.login.toLowerCase();
    const invited = tx.select().from(invites).where(eq(invites.login, login)).get();
    if (!invited && login !== admin.toLowerCase()) return null;
    tx.insert(accounts).values({ id: user.id, login: user.login, createdAt: at }).run();
    return { id: user.id, login: user.login };
  });
}

/** A new session for the account, valid for 30 days from `at`; returns its raw ID, stores only its hash. */
export function createSession(db: AccountsDb, accountId: number, at: Date): string {
  const raw = newSecret();
  db.delete(sessions).where(lt(sessions.expiresAt, at)).run();
  db.insert(sessions)
    .values({ idHash: hashSecret(raw), accountId, expiresAt: new Date(at.getTime() + SESSION_DAYS * DAY_MS) })
    .run();
  return raw;
}

/** The account of an unexpired session, by its raw ID's hash. */
export function sessionAccount(db: AccountsDb, raw: string, at: Date): Account | null {
  return (
    db
      .select(accountColumns)
      .from(sessions)
      .innerJoin(accounts, eq(accounts.id, sessions.accountId))
      .where(and(eq(sessions.idHash, hashSecret(raw)), gte(sessions.expiresAt, at)))
      .get() ?? null
  );
}

export function deleteSession(db: AccountsDb, raw: string): void {
  db.delete(sessions).where(eq(sessions.idHash, hashSecret(raw))).run();
}

/** A new collector token, `ed_` and a secret; returns it raw, stores only its hash. */
export function createToken(db: AccountsDb, accountId: number, at: Date): string {
  const raw = `ed_${newSecret()}`;
  db.insert(collectorTokens).values({ hash: hashSecret(raw), accountId, createdAt: at }).run();
  return raw;
}

export function listTokens(
  db: AccountsDb,
  accountId: number,
): { id: number; createdAt: Date; lastUsedAt: Date | null }[] {
  return db
    .select({ id: collectorTokens.id, createdAt: collectorTokens.createdAt, lastUsedAt: collectorTokens.lastUsedAt })
    .from(collectorTokens)
    .where(eq(collectorTokens.accountId, accountId))
    .orderBy(collectorTokens.id)
    .all();
}

/** Deletes the account's token `id`; false when it isn't that account's. */
export function revokeToken(db: AccountsDb, accountId: number, id: number): boolean {
  const result = db
    .delete(collectorTokens)
    .where(and(eq(collectorTokens.id, id), eq(collectorTokens.accountId, accountId)))
    .run();
  return result.changes > 0;
}

/** The account of a collector token, by its hash; records the token's use at `at`. */
export function tokenAccount(db: AccountsDb, raw: string, at: Date): Account | null {
  const hash = hashSecret(raw);
  const account = db
    .select(accountColumns)
    .from(collectorTokens)
    .innerJoin(accounts, eq(accounts.id, collectorTokens.accountId))
    .where(eq(collectorTokens.hash, hash))
    .get();
  if (!account) return null;
  db.update(collectorTokens).set({ lastUsedAt: at }).where(eq(collectorTokens.hash, hash)).run();
  return account;
}

export function setLastCollect(db: AccountsDb, accountId: number, at: Date): void {
  db.update(accounts).set({ lastCollectAt: at }).where(eq(accounts.id, accountId)).run();
}

export function getAccount(
  db: AccountsDb,
  id: number,
): (Account & { createdAt: Date; lastCollectAt: Date | null }) | null {
  return db.select().from(accounts).where(eq(accounts.id, id)).get() ?? null;
}
