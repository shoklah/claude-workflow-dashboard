import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';
import { LABELLER_DEFAULTS } from '@cwd/shared';
import { openSqlite } from '../db/open.ts';
import type { AccountFiles } from './account-files.ts';
import * as schema from './schema.ts';
import {
  accounts,
  collectorTokens,
  invites,
  labellerSettings,
  sessions,
  viewerGrants,
} from './schema.ts';
import { sealKey } from './secret.ts';

// Two levels up from this file, as openDb's.
const MIGRATIONS = fileURLToPath(new URL('../../drizzle-hosted', import.meta.url));
// A session's lifetime, for its stored expiry and its cookie alike.
export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
/** The session cookie's name, which createApp's middleware reads. */
export const SESSION = 'edward_session';
/** The session cookie's options, for setting and clearing it alike. */
export const SESSION_COOKIE = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const;

export type AccountsDb = ReturnType<typeof openAccountsDb>;
export type Account = { id: number; login: string };

/** The accounts database in `file`, its folder created with mode 0700, foreign keys on, migrated to the latest schema. */
export function openAccountsDb(file: string) {
  return openSqlite(file, schema, MIGRATIONS, ['foreign_keys = ON']);
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

/** Whether `login` is the admin's (`EDWARD_ADMIN`), case-insensitive. */
export function isAdmin(login: string, admin: string): boolean {
  return login.toLowerCase() === admin.toLowerCase();
}

/**
 * The account of a GitHub user: an existing one by id while its stored login is invited or is `admin`, its login
 * updated and its invite moved to the new login; a new one when the login is invited or is `admin` (case-insensitive);
 * else null.
 */
export function signInAccount(db: AccountsDb, user: Account, admin: string, at: Date): Account | null {
  return db.transaction((tx) => {
    const existing = tx.select({ login: accounts.login }).from(accounts).where(eq(accounts.id, user.id)).get();
    const login = user.login.toLowerCase();
    if (existing) {
      const stored = existing.login.toLowerCase();
      const invite = tx.select().from(invites).where(eq(invites.login, stored)).get();
      if (!invite && !isAdmin(stored, admin)) return null;
      if (invite && stored !== login) {
        tx.delete(invites).where(eq(invites.login, stored)).run();
        tx.insert(invites).values({ login, addedAt: invite.addedAt }).onConflictDoNothing().run();
      }
      tx.update(accounts).set({ login: user.login }).where(eq(accounts.id, user.id)).run();
    } else {
      const invited = tx.select().from(invites).where(eq(invites.login, login)).get();
      if (!invited && !isAdmin(login, admin)) return null;
      tx.insert(accounts).values({ id: user.id, login: user.login, createdAt: at }).run();
    }
    // Grants made to this login before it had an account are its from now on.
    tx.update(viewerGrants)
      .set({ viewerId: user.id })
      .where(and(eq(viewerGrants.viewerLogin, login), isNull(viewerGrants.viewerId)))
      .run();
    return { id: user.id, login: user.login };
  });
}

/** The invited logins, lower-case, in order, each with whether an account's login is it. */
export function listInvites(db: AccountsDb): { login: string; addedAt: Date; signedIn: boolean }[] {
  return db
    .select({
      login: invites.login,
      addedAt: invites.addedAt,
      signedIn: sql<number>`exists (select 1 from accounts where lower(accounts.login) = invites.login)`,
    })
    .from(invites)
    .orderBy(invites.login)
    .all()
    .map((invite) => ({ ...invite, signedIn: !!invite.signedIn }));
}

/** Removes `login`'s invite (any case) and the sessions and collector tokens of the accounts whose login it is; their
 * data stays until they are deleted, and signInAccount refuses them meanwhile. */
export function removeInvite(db: AccountsDb, login: string): void {
  const lower = login.toLowerCase();
  const held = db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(sql`lower(${accounts.login})`, lower));
  db.transaction((tx) => {
    tx.delete(invites).where(eq(invites.login, lower)).run();
    tx.delete(sessions).where(inArray(sessions.accountId, held)).run();
    tx.delete(collectorTokens).where(inArray(collectorTokens.accountId, held)).run();
  });
}

/** Every account by id, with its times, never anything of its tokens or sessions. */
export function listAccounts(
  db: AccountsDb,
): { id: number; login: string; createdAt: Date; lastCollectAt: Date | null }[] {
  return db
    .select({ ...accountColumns, createdAt: accounts.createdAt, lastCollectAt: accounts.lastCollectAt })
    .from(accounts)
    .orderBy(accounts.id)
    .all();
}

/** The account whose login is `login` (case-insensitive; the newest, if several have it), if any. */
export function accountByLogin(db: AccountsDb, login: string): Account | null {
  return (
    db
      .select(accountColumns)
      .from(accounts)
      .where(eq(sql`lower(${accounts.login})`, login.toLowerCase()))
      .orderBy(desc(accounts.createdAt), desc(accounts.id))
      .get() ?? null
  );
}

/** A new session for the account, valid for 30 days from `at`; returns its raw ID, stores only its hash. */
export function createSession(db: AccountsDb, accountId: number, at: Date): string {
  const raw = newSecret();
  db.delete(sessions).where(lt(sessions.expiresAt, at)).run();
  db.insert(sessions)
    .values({ idHash: hashSecret(raw), accountId, expiresAt: new Date(at.getTime() + SESSION_MS) })
    .run();
  return raw;
}

/**
 * The account of an unexpired session, by its raw ID's hash, and the owner it views: null for its own, and null too
 * once that owner isn't in its viewableAccounts (the grant removed, or the owner neither invited nor the admin).
 */
export function sessionAccount(
  db: AccountsDb,
  raw: string,
  admin: string,
  at: Date,
): { account: Account; viewing: Account | null } | null {
  const row = db
    .select({ ...accountColumns, viewingId: sessions.viewingId })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(and(eq(sessions.idHash, hashSecret(raw)), gte(sessions.expiresAt, at)))
    .get();
  if (!row) return null;
  const account = { id: row.id, login: row.login };
  const viewing =
    row.viewingId === null
      ? null
      : (viewableAccounts(db, account, admin).find((owner) => owner.id === row.viewingId) ?? null);
  return { account, viewing };
}

/** Sets the owner a session views, null for its own account; false, changing nothing, when the owner gave its account
 * no grant. */
export function setViewing(db: AccountsDb, raw: string, ownerId: number | null): boolean {
  const idHash = hashSecret(raw);
  if (ownerId !== null) {
    const session = db
      .select({ accountId: sessions.accountId })
      .from(sessions)
      .where(eq(sessions.idHash, idHash))
      .get();
    const viewer = session && getAccount(db, session.accountId);
    const grant =
      viewer && db.select().from(viewerGrants).where(and(eq(viewerGrants.ownerId, ownerId), grantedTo(viewer))).get();
    if (!grant) return false;
  }
  db.update(sessions).set({ viewingId: ownerId }).where(eq(sessions.idHash, idHash)).run();
  return true;
}

/** Grants to the account: bound to its id, or not bound yet and naming its login. */
function grantedTo(account: Account) {
  return or(
    eq(viewerGrants.viewerId, account.id),
    and(isNull(viewerGrants.viewerId), eq(viewerGrants.viewerLogin, account.login.toLowerCase())),
  );
}

/** Grants `login` (case-insensitive) a view of the owner's account, bound to the account that holds that login now
 * (the newest, if several have it), if any. */
export function addViewer(db: AccountsDb, ownerId: number, login: string): void {
  const viewerLogin = login.toLowerCase();
  const viewer = accountByLogin(db, viewerLogin);
  db.insert(viewerGrants)
    .values({ ownerId, viewerLogin, viewerId: viewer?.id ?? null })
    .onConflictDoNothing()
    .run();
}

/** Removes the owner's grant listed as `login` (as listViewers shows it, any case). */
export function removeViewer(db: AccountsDb, ownerId: number, login: string): void {
  const shown = login.toLowerCase();
  for (const grant of grantsOf(db, ownerId).filter((grant) => grant.shown === shown)) {
    db.delete(viewerGrants)
      .where(and(eq(viewerGrants.ownerId, ownerId), eq(viewerGrants.viewerLogin, grant.viewerLogin)))
      .run();
  }
}

/** The logins the owner granted a view, lower-case, each once, in order: a bound grant's viewer's current login, an
 * unbound one's as granted. */
export function listViewers(db: AccountsDb, ownerId: number): string[] {
  return [...new Set(grantsOf(db, ownerId).map((grant) => grant.shown))].sort();
}

// The owner's grants, each with the login it shows as (listViewers).
function grantsOf(db: AccountsDb, ownerId: number): { viewerLogin: string; shown: string }[] {
  return db
    .select({
      viewerLogin: viewerGrants.viewerLogin,
      shown: sql<string>`coalesce(lower(${accounts.login}), ${viewerGrants.viewerLogin})`,
    })
    .from(viewerGrants)
    .leftJoin(accounts, eq(accounts.id, viewerGrants.viewerId))
    .where(eq(viewerGrants.ownerId, ownerId))
    .all();
}

/** The owners the account may view, each once: those that granted it (grantedTo), and whose own login is invited or
 * `admin`. */
export function viewableAccounts(db: AccountsDb, account: Account, admin: string): Account[] {
  const ownerLogin = sql`lower(${accounts.login})`;
  return db
    .selectDistinct(accountColumns)
    .from(viewerGrants)
    .innerJoin(accounts, eq(accounts.id, viewerGrants.ownerId))
    .leftJoin(invites, eq(invites.login, ownerLogin))
    .where(and(grantedTo(account), or(isNotNull(invites.login), eq(ownerLogin, admin.toLowerCase()))))
    .orderBy(accounts.id)
    .all();
}

/**
 * Deletes the account: its file first, so a failed removal leaves a live account its owner can delete again, then its
 * row, with its sessions, tokens, labeller settings and the grants it gave and received by cascade (a received grant
 * isn't unbound, since its login may since belong to someone else).
 */
export function deleteAccount(db: AccountsDb, files: AccountFiles, id: number): void {
  files.remove(id);
  db.delete(accounts).where(eq(accounts.id, id)).run();
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

/** The account's labeller: whether a key is set, never the key, its model and its daily max (the defaults with none). */
export function getLabeller(db: AccountsDb, accountId: number): { keySet: boolean; model: string; dailyMax: number } {
  const row = db.select().from(labellerSettings).where(eq(labellerSettings.accountId, accountId)).get();
  return {
    keySet: !!row?.sealedKey,
    model: row?.model ?? LABELLER_DEFAULTS.model,
    dailyMax: row?.dailyMax ?? LABELLER_DEFAULTS.dailyMax,
  };
}

/** Sets the account's labeller; its key is stored only sealed under `secret`: undefined keeps the stored one, null
 * removes it. */
export function setLabeller(
  db: AccountsDb,
  accountId: number,
  settings: { key?: string | null; model: string; dailyMax: number },
  secret: Buffer,
): void {
  const { key, model, dailyMax } = settings;
  const values = {
    model,
    dailyMax,
    ...(key === undefined ? {} : { sealedKey: key === null ? null : sealKey(secret, key, accountId) }),
  };
  db.insert(labellerSettings)
    .values({ accountId, ...values })
    .onConflictDoUpdate({ target: labellerSettings.accountId, set: values })
    .run();
}

/** The accounts with a key, its key still sealed, for the label job. */
export function labellerAccounts(
  db: AccountsDb,
): { accountId: number; sealedKey: string; model: string; dailyMax: number }[] {
  return db
    .select()
    .from(labellerSettings)
    .where(isNotNull(labellerSettings.sealedKey))
    .orderBy(labellerSettings.accountId)
    .all() as { accountId: number; sealedKey: string; model: string; dailyMax: number }[];
}
