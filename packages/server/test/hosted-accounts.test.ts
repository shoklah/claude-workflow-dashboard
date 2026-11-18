import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  accountByLogin,
  addInvite,
  listAccounts,
  listInvites,
  removeInvite,
  addViewer,
  createSession,
  createToken,
  deleteSession,
  getAccount,
  hashSecret,
  listViewers,
  openAccountsDb,
  removeViewer,
  revokeToken,
  sessionAccount,
  setLastCollect,
  setViewing,
  signInAccount,
  tokenAccount,
  listTokens,
  viewableAccounts,
  type AccountsDb,
} from '../src/hosted/accounts.ts';
import { invites } from '../src/hosted/schema.ts';

const AT = new Date('2026-11-18T10:00:00Z');
const LATER = new Date('2026-11-19T10:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const ADMIN = 'Owner-Login';

const dirs: string[] = [];
const dbs: AccountsDb[] = [];

function fresh(): { db: AccountsDb; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cwd accounts '));
  dirs.push(dir);
  const file = join(dir, 'data dir', 'accounts.sqlite');
  const db = openAccountsDb(file);
  dbs.push(db);
  return { db, file };
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.$client.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('signInAccount', () => {
  test('returns null for a login with no invite', () => {
    const { db } = fresh();
    expect(signInAccount(db, { id: 11, login: 'stranger' }, ADMIN, AT)).toBeNull();
  });

  test('creates an account for an invited login, case-insensitively', () => {
    const { db } = fresh();
    addInvite(db, 'Mika-Ito', AT);
    expect(signInAccount(db, { id: 12, login: 'mika-ito' }, ADMIN, AT)).toEqual({ id: 12, login: 'mika-ito' });
  });

  test('creates an account for the admin with no invite', () => {
    const { db } = fresh();
    expect(signInAccount(db, { id: 13, login: 'owner-login' }, ADMIN, AT)).toEqual({ id: 13, login: 'owner-login' });
  });

  test('a second sign-in with the same id keeps the account, updates its login and moves its invite', () => {
    const { db } = fresh();
    addInvite(db, 'mika-ito', AT);
    signInAccount(db, { id: 12, login: 'mika-ito' }, ADMIN, AT);
    expect(signInAccount(db, { id: 12, login: 'Mika-Renamed' }, ADMIN, LATER)).toEqual({
      id: 12,
      login: 'Mika-Renamed',
    });
    expect(listInvites(db)).toEqual([{ login: 'mika-renamed', addedAt: AT, signedIn: true }]);
    expect(signInAccount(db, { id: 12, login: 'Mika-Renamed' }, ADMIN, LATER)).toEqual({ id: 12, login: 'Mika-Renamed' });
  });

  test('a rename onto a login already invited keeps one invite', () => {
    const { db } = fresh();
    addInvite(db, 'mika-ito', AT);
    signInAccount(db, { id: 12, login: 'mika-ito' }, ADMIN, AT);
    addInvite(db, 'mika-new', LATER);
    signInAccount(db, { id: 12, login: 'mika-new' }, ADMIN, LATER);
    expect(listInvites(db).map((invite) => invite.login)).toEqual(['mika-new']);
  });

  test('refuses an existing account whose login is no longer invited; the admin needs none', () => {
    const { db } = fresh();
    addInvite(db, 'mika-ito', AT);
    signInAccount(db, { id: 12, login: 'mika-ito' }, ADMIN, AT);
    removeInvite(db, 'mika-ito');
    expect(signInAccount(db, { id: 12, login: 'mika-ito' }, ADMIN, LATER)).toBeNull();
    expect(getAccount(db, 12)).toMatchObject({ id: 12, login: 'mika-ito' });
    signInAccount(db, { id: 13, login: 'owner-login' }, ADMIN, AT);
    expect(signInAccount(db, { id: 13, login: 'owner-login' }, ADMIN, LATER)).toEqual({ id: 13, login: 'owner-login' });
  });
});

describe('admin', () => {
  test('listInvites says which invited logins have an account', () => {
    const { db } = fresh();
    addInvite(db, 'Sam-Okafor', AT);
    addInvite(db, 'mika-ito', LATER);
    signInAccount(db, { id: 12, login: 'Mika-Ito' }, ADMIN, LATER);
    expect(listInvites(db)).toEqual([
      { login: 'mika-ito', addedAt: LATER, signedIn: true },
      { login: 'sam-okafor', addedAt: AT, signedIn: false },
    ]);
  });

  test("removeInvite deletes that login's sessions and tokens, any case, and no one else's", () => {
    const { db } = fresh();
    addInvite(db, 'mika-ito', AT);
    signInAccount(db, { id: 12, login: 'Mika-Ito' }, ADMIN, AT);
    const owner = signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT)!;
    const session = createSession(db, 12, AT);
    const token = createToken(db, 12, AT);
    const ownSession = createSession(db, owner.id, AT);
    const ownToken = createToken(db, owner.id, AT);
    removeInvite(db, 'MIKA-ITO');
    expect(listInvites(db)).toEqual([]);
    expect(sessionAccount(db, session, ADMIN, AT)).toBeNull();
    expect(tokenAccount(db, token, AT)).toBeNull();
    expect(getAccount(db, 12)).not.toBeNull();
    expect(sessionAccount(db, ownSession, ADMIN, AT)?.account).toEqual(owner);
    expect(tokenAccount(db, ownToken, AT)).toEqual(owner);
  });

  test('listAccounts lists every account by id, with its times only', () => {
    const { db } = fresh();
    addInvite(db, 'mika-ito', AT);
    signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT);
    signInAccount(db, { id: 12, login: 'mika-ito' }, ADMIN, AT);
    setLastCollect(db, 12, LATER);
    createToken(db, 12, AT);
    createSession(db, 12, AT);
    expect(listAccounts(db)).toEqual([
      { id: 12, login: 'mika-ito', createdAt: AT, lastCollectAt: LATER },
      { id: 13, login: ADMIN, createdAt: AT, lastCollectAt: null },
    ]);
  });

  test('accountByLogin finds an account by login, any case', () => {
    const { db } = fresh();
    addInvite(db, 'mika-ito', AT);
    signInAccount(db, { id: 12, login: 'Mika-Ito' }, ADMIN, AT);
    expect(accountByLogin(db, 'MIKA-ITO')).toEqual({ id: 12, login: 'Mika-Ito' });
    expect(accountByLogin(db, 'sam-okafor')).toBeNull();
  });
});

test('an account records its last collect', () => {
  const { db } = fresh();
  signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT);
  expect(getAccount(db, 13)).toEqual({ id: 13, login: ADMIN, createdAt: AT, lastCollectAt: null });
  setLastCollect(db, 13, LATER);
  expect(getAccount(db, 13)?.lastCollectAt).toEqual(LATER);
  expect(getAccount(db, 99)).toBeNull();
});

describe('sessions', () => {
  test('a session resolves to its account until 30 days have passed', () => {
    const { db } = fresh();
    const account = signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT)!;
    const raw = createSession(db, account.id, AT);
    expect(sessionAccount(db, raw, ADMIN, LATER)).toEqual({ account, viewing: null });
    expect(sessionAccount(db, raw, ADMIN, new Date(AT.getTime() + 30 * DAY))).toEqual({ account, viewing: null });
    expect(sessionAccount(db, raw, ADMIN, new Date(AT.getTime() + 30 * DAY + 1))).toBeNull();
  });

  test('a deleted session and an unknown ID resolve to nothing', () => {
    const { db } = fresh();
    const account = signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT)!;
    const raw = createSession(db, account.id, AT);
    deleteSession(db, raw);
    expect(sessionAccount(db, raw, ADMIN, LATER)).toBeNull();
    expect(sessionAccount(db, 'nope', ADMIN, LATER)).toBeNull();
  });
});

describe('viewers', () => {
  const OWNER = { id: 101, login: 'Rowan-K' };
  const VIEWER = { id: 202, login: 'mika-ito' };

  function owner(db: AccountsDb) {
    addInvite(db, OWNER.login, AT);
    return signInAccount(db, OWNER, ADMIN, AT)!;
  }
  function viewer(db: AccountsDb, user = VIEWER) {
    addInvite(db, user.login, AT);
    return signInAccount(db, user, ADMIN, AT)!;
  }

  test('a grant is listed by its lower-case login, once, and removed by any case', () => {
    const { db } = fresh();
    owner(db);
    addViewer(db, OWNER.id, 'Mika-Ito');
    addViewer(db, OWNER.id, 'mika-ito');
    expect(listViewers(db, OWNER.id)).toEqual(['mika-ito']);
    removeViewer(db, OWNER.id, 'MIKA-ITO');
    expect(listViewers(db, OWNER.id)).toEqual([]);
  });

  test("a grant to an existing account binds to its id: a rename keeps it, a newcomer on the old login doesn't", () => {
    const { db } = fresh();
    owner(db);
    viewer(db);
    addViewer(db, OWNER.id, 'mika-ito');
    expect(viewableAccounts(db, VIEWER, ADMIN)).toEqual([OWNER]);
    const renamed = signInAccount(db, { id: 202, login: 'mika-new' }, ADMIN, LATER)!;
    expect(viewableAccounts(db, renamed, ADMIN)).toEqual([OWNER]);
    const newcomer = viewer(db, { id: 303, login: 'mika-ito' });
    expect(viewableAccounts(db, newcomer, ADMIN)).toEqual([]);
  });

  test("a grant made before the viewer's account binds at that login's first sign-in", () => {
    const { db } = fresh();
    owner(db);
    addViewer(db, OWNER.id, 'Mika-Ito');
    viewer(db);
    const renamed = signInAccount(db, { id: 202, login: 'mika-new' }, ADMIN, LATER)!;
    expect(viewableAccounts(db, renamed, ADMIN)).toEqual([OWNER]);
    expect(viewableAccounts(db, viewer(db, { id: 303, login: 'mika-ito' }), ADMIN)).toEqual([]);
  });

  test('an owner that granted both an old and a new login of one account is viewable once', () => {
    const { db } = fresh();
    owner(db);
    viewer(db);
    addViewer(db, OWNER.id, 'mika-ito');
    const renamed = signInAccount(db, { id: 202, login: 'mika-new' }, ADMIN, LATER)!;
    addViewer(db, OWNER.id, 'mika-new');
    expect(viewableAccounts(db, renamed, ADMIN)).toEqual([OWNER]);
    expect(listViewers(db, OWNER.id)).toEqual(['mika-new']);
  });

  test("a bound viewer is listed by its current login, and removed by it; an unbound one by the granted login", () => {
    const { db } = fresh();
    owner(db);
    viewer(db);
    addViewer(db, OWNER.id, 'mika-ito');
    addViewer(db, OWNER.id, 'Sam-Lee');
    signInAccount(db, { id: 202, login: 'Mika-New' }, ADMIN, LATER);
    expect(listViewers(db, OWNER.id)).toEqual(['mika-new', 'sam-lee']);
    removeViewer(db, OWNER.id, 'mika-new');
    expect(listViewers(db, OWNER.id)).toEqual(['sam-lee']);
    expect(viewableAccounts(db, { id: 202, login: 'Mika-New' }, ADMIN)).toEqual([]);
    removeViewer(db, OWNER.id, 'sam-lee');
    expect(listViewers(db, OWNER.id)).toEqual([]);
  });

  test("an owner whose invite is removed isn't viewable; the admin needs none", () => {
    const { db } = fresh();
    owner(db);
    const admin = signInAccount(db, { id: 1, login: ADMIN }, ADMIN, AT)!;
    viewer(db);
    addViewer(db, OWNER.id, 'mika-ito');
    addViewer(db, admin.id, 'mika-ito');
    expect(viewableAccounts(db, VIEWER, ADMIN)).toEqual([admin, OWNER]);
    db.delete(invites).where(eq(invites.login, 'rowan-k')).run();
    expect(viewableAccounts(db, VIEWER, ADMIN)).toEqual([admin]);
  });

  test("a session views an owner only while it's viewable, else falls back to its own account", () => {
    const { db } = fresh();
    owner(db);
    viewer(db);
    const raw = createSession(db, VIEWER.id, AT);
    expect(setViewing(db, raw, OWNER.id)).toBe(false);
    addViewer(db, OWNER.id, 'mika-ito');
    expect(setViewing(db, raw, OWNER.id)).toBe(true);
    expect(sessionAccount(db, raw, ADMIN, LATER)).toEqual({ account: VIEWER, viewing: OWNER });
    // The owner's invite removed (R1): the session falls back, as for a lost grant.
    db.delete(invites).where(eq(invites.login, 'rowan-k')).run();
    expect(sessionAccount(db, raw, ADMIN, LATER)).toEqual({ account: VIEWER, viewing: null });
    addInvite(db, 'rowan-k', AT);
    expect(sessionAccount(db, raw, ADMIN, LATER)?.viewing).toEqual(OWNER);
    removeViewer(db, OWNER.id, 'mika-ito');
    expect(sessionAccount(db, raw, ADMIN, LATER)).toEqual({ account: VIEWER, viewing: null });
    expect(setViewing(db, raw, null)).toBe(true);
    expect(sessionAccount(db, raw, ADMIN, LATER)).toEqual({ account: VIEWER, viewing: null });
  });
});

describe('collector tokens', () => {
  test('a token has the ed_ form, resolves to its account and records its use', () => {
    const { db } = fresh();
    const account = signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT)!;
    const raw = createToken(db, account.id, AT);
    expect(raw).toMatch(/^ed_[A-Za-z0-9_-]{43}$/);
    expect(listTokens(db, account.id)).toEqual([{ id: expect.any(Number), createdAt: AT, lastUsedAt: null }]);
    expect(tokenAccount(db, raw, LATER)).toEqual(account);
    expect(listTokens(db, account.id)[0]!.lastUsedAt).toEqual(LATER);
  });

  test("another account can't revoke a token; its own account can", () => {
    const { db } = fresh();
    addInvite(db, 'mika-ito', AT);
    const owner = signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT)!;
    const other = signInAccount(db, { id: 12, login: 'mika-ito' }, ADMIN, AT)!;
    const raw = createToken(db, owner.id, AT);
    const id = listTokens(db, owner.id)[0]!.id;
    expect(revokeToken(db, other.id, id)).toBe(false);
    expect(tokenAccount(db, raw, LATER)).toEqual(owner);
    expect(revokeToken(db, owner.id, id)).toBe(true);
    expect(tokenAccount(db, raw, LATER)).toBeNull();
  });
});

test('raw session IDs and tokens are stored only as their hashes', () => {
  const { db, file } = fresh();
  const account = signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT)!;
  const session = createSession(db, account.id, AT);
  const token = createToken(db, account.id, AT);
  db.$client.close();
  dbs.splice(dbs.indexOf(db), 1);
  const stored = readFileSync(file, 'latin1');
  expect(stored).not.toContain(session);
  expect(stored).not.toContain(token);
  expect(stored).toContain(hashSecret(session));
  expect(stored).toContain(hashSecret(token));
});
