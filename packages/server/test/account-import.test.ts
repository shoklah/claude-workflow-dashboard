import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { fixture } from '../../shared/test/fixture.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { findingLabels } from '../src/db/schema.ts';
import { labelInputs, saveBatch } from '../src/db/labels.ts';
import { getCursor, getShowing, listUnits, setCursor, setShowing } from '../src/db/read.ts';
import { addInvite, openAccountsDb, signInAccount } from '../src/hosted/accounts.ts';
import { accountFiles } from '../src/hosted/account-files.ts';
import { importAccountFile } from '../src/hosted/account-import.ts';
import { importJson } from '../src/reporter.ts';
import { A, NOW } from './hosted-helpers.ts';

const CURSOR = 'invented-state 7';
// report-v5's category list, CR10's version 1.
const LIST = 101;

let dir: string;
let data: string;
let local: string;

const target = () => join(data, 'accounts', `${A.id}.sqlite`);

/** Opens `file` with `use`, then closes it. */
function withDb<T>(file: string, use: (db: Db) => T): T {
  const db = openDb(file);
  try {
    return use(db);
  } finally {
    db.$client.close();
  }
}

/** A local dashboard.sqlite built from report-v5, with a label batch, the cursor and showing mode set. */
function localHistory(file: string): void {
  withDb(file, (db) => {
    if (!importJson(db, fixture('report-v5'), null, NOW)) throw new Error('no import');
    const input = labelInputs(listUnits(db, 'run'))[0];
    saveBatch(
      db,
      [
        {
          runKey: input.runKey,
          findingId: input.findingId,
          hash: input.hash,
          model: 'fixture',
          category: 'conventions',
          relevance: 'valid',
          reason: 'An invented reason.',
          labelledAt: NOW,
        },
      ],
      { at: NOW, inputTokens: 10, outputTokens: 2 },
      LIST,
    );
    setCursor(db, CURSOR);
    setShowing(db, ['invented-project-key']);
  });
}

/** The rows the import must carry over, read from `file`. */
function facts(file: string) {
  return withDb(file, (db) => ({
    runs: listUnits(db, 'run').map((u) => u.key).sort(),
    sessions: listUnits(db, 'session').map((u) => u.key).sort(),
    labels: db.select().from(findingLabels).all(),
    cursor: getCursor(db),
    showing: getShowing(db),
  }));
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd account import '));
  data = join(dir, 'data');
  local = join(dir, 'local', 'dashboard.sqlite');
  localHistory(local);
  const accounts = openAccountsDb(join(data, 'accounts.sqlite'));
  addInvite(accounts, A.login, NOW);
  signInAccount(accounts, A, 'admin', NOW);
  accounts.$client.close();
  // The account's empty file, as its first request opens it.
  const files = accountFiles(data);
  files.db(A.id);
  files.close();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

test("copies a local history into an empty account's file, its stored facts included", () => {
  const before = facts(local);
  expect(before.runs.length).toBeGreaterThan(0);
  expect(before.labels).toHaveLength(1);

  expect(importAccountFile({ dataDir: data, login: 'alice', file: local })).toEqual({ ok: true, accountId: A.id });

  expect(facts(target())).toEqual(before);
  expect(readdirSync(join(data, 'accounts')).sort()).toEqual([`${A.id}.sqlite`]);
});

/** Asserts that importing `file` for `login` is refused with `reason` and leaves the account's file as it was. */
function refused(login: string, file: string, reason: string): void {
  const bytes = readFileSync(target());
  expect(importAccountFile({ dataDir: data, login, file })).toEqual({ ok: false, reason });
  expect(readFileSync(target()).equals(bytes)).toBe(true);
  expect(readdirSync(join(data, 'accounts')).sort()).toEqual([`${A.id}.sqlite`]);
}

test('refuses a login with no account', () => {
  refused('mallory', local, 'no account for mallory: sign in first');
});

test('refuses an account that already holds data', () => {
  const files = accountFiles(data);
  importJson(files.db(A.id), fixture('report-v5'), null, NOW);
  files.close();
  refused('Alice', local, 'account Alice already holds data');
  expect(facts(target()).cursor).toBeNull();
});

test("refuses a file whose migrations are newer than the server's", () => {
  withDb(local, (db) => {
    db.$client.prepare('insert into __drizzle_migrations (hash, created_at) values (?, ?)').run('future', 9e15);
  });
  refused('Alice', local, "the file's migrations are newer than this server's");
});

test('refuses a text file', () => {
  const text = join(dir, 'notes.txt');
  writeFileSync(text, 'not a database\n'.repeat(100));
  refused('Alice', text, 'the file is not an edward database');
});

test('refuses a SQLite file of another schema', () => {
  refused('Alice', join(data, 'accounts.sqlite'), 'the file is not an edward database');
});

test('refuses a file that does not exist, creating none', () => {
  const missing = join(dir, 'missing.sqlite');
  refused('Alice', missing, 'the file is not an edward database');
  expect(existsSync(missing)).toBe(false);
});

test('a copy whose first open fails leaves the account empty, so the import can run again', () => {
  // The newest migration's row gone, so the first open runs it again over a schema that already has it, and throws.
  const broken = join(dir, 'broken.sqlite');
  withDb(local, (db) => db.$client.prepare('vacuum into ?').run(broken));
  const raw = new Database(broken);
  raw.prepare('delete from __drizzle_migrations where created_at = (select max(created_at) from __drizzle_migrations)').run();
  raw.close();

  expect(() => importAccountFile({ dataDir: data, login: 'Alice', file: broken })).toThrow();
  expect(readdirSync(join(data, 'accounts'))).toEqual([]);

  expect(importAccountFile({ dataDir: data, login: 'Alice', file: local })).toEqual({ ok: true, accountId: A.id });
});

test('refuses an unknown login without creating the accounts database', () => {
  const empty = join(dir, 'empty data');
  expect(importAccountFile({ dataDir: empty, login: 'Alice', file: local })).toEqual({
    ok: false,
    reason: 'no account for Alice: sign in first',
  });
  expect(existsSync(empty)).toBe(false);
});
