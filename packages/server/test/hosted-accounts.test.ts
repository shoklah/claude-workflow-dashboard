import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  addInvite,
  createSession,
  createToken,
  deleteSession,
  getAccount,
  hashSecret,
  openAccountsDb,
  revokeToken,
  sessionAccount,
  setLastCollect,
  signInAccount,
  tokenAccount,
  listTokens,
  type AccountsDb,
} from '../src/hosted/accounts.ts';

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

  test('a second sign-in with the same id keeps the account and updates its login', () => {
    const { db } = fresh();
    addInvite(db, 'mika-ito', AT);
    signInAccount(db, { id: 12, login: 'mika-ito' }, ADMIN, AT);
    expect(signInAccount(db, { id: 12, login: 'mika-renamed' }, ADMIN, LATER)).toEqual({
      id: 12,
      login: 'mika-renamed',
    });
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
    expect(sessionAccount(db, raw, LATER)).toEqual(account);
    expect(sessionAccount(db, raw, new Date(AT.getTime() + 30 * DAY))).toEqual(account);
    expect(sessionAccount(db, raw, new Date(AT.getTime() + 30 * DAY + 1))).toBeNull();
  });

  test('a deleted session and an unknown ID resolve to nothing', () => {
    const { db } = fresh();
    const account = signInAccount(db, { id: 13, login: ADMIN }, ADMIN, AT)!;
    const raw = createSession(db, account.id, AT);
    deleteSession(db, raw);
    expect(sessionAccount(db, raw, LATER)).toBeNull();
    expect(sessionAccount(db, 'nope', LATER)).toBeNull();
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
