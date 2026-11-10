import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import Database from 'better-sqlite3';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { loadReport, type Report } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { runKey, sessionKey } from '../src/keys.ts';
import { importReport, isIncremental, rebuildDerived, recordImportFailure } from '../src/db/import.ts';
import { getCursor, getSeenAt, lastGoodImport, lastImport, listUnits, listWarnings } from '../src/db/read.ts';
import { units, unitVersions } from '../src/db/schema.ts';

const FIRST = new Date('2026-11-10T18:00:00Z');
const LATER = new Date('2026-11-12T10:00:00Z');

const dirs: string[] = [];
const dbs: Db[] = [];

/** A database in a fresh temp folder, whose path holds a space. */
function freshDb(): { db: Db; file: string } {
  const dir = mkdtempSync(join(tmpdir(), 'cwd server '));
  dirs.push(dir);
  const file = join(dir, 'data dir', 'dashboard.sqlite');
  const db = openDb(file);
  dbs.push(db);
  return { db, file };
}

/**
 * Imports a fixture as the server will: the loaded report, with the same parsed JSON's raw units and totals. `sent` is
 * the cursor sent to the reporter, and `change` edits the fixture's JSON before loading.
 */
function importFixture(
  db: Db,
  name: string,
  at: Date,
  sent: string | null = null,
  change?: (raw: any) => void,
): Report {
  const raw = fixture(name);
  change?.(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`fixture ${name} does not load`);
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, at, sent);
  return loaded.report;
}

function versionsOf(db: Db, kind: 'run' | 'session', key: string) {
  return db
    .select()
    .from(unitVersions)
    .where(and(eq(unitVersions.kind, kind), eq(unitVersions.key, key)))
    .all();
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.$client.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('openDb', () => {
  test('creates its folder with mode 0700', () => {
    const { file } = freshDb();
    expect(statSync(join(file, '..')).mode & 0o777).toBe(0o700);
  });

  test('reopening keeps the stored data', () => {
    const { db, file } = freshDb();
    importFixture(db, 'report-full', FIRST);
    db.$client.close();
    const again = openDb(file);
    dbs.push(again);
    expect(listUnits(again, 'run')).toHaveLength(5);
    expect(again.select().from(unitVersions).all()).toHaveLength(7);
  });
});

describe('importReport', () => {
  test('first import stores every unit with one version', () => {
    const { db } = freshDb();
    importFixture(db, 'report-full', FIRST);
    expect(listUnits(db, 'run')).toHaveLength(5);
    expect(listUnits(db, 'session')).toHaveLength(2);
    expect(db.select().from(unitVersions).all()).toHaveLength(7);
    for (const unit of [...listUnits(db, 'run'), ...listUnits(db, 'session')]) {
      expect(unit.firstSeenAt).toEqual(FIRST);
      expect(unit.missingSince).toBeNull();
    }
  });

  test('first import sets seenAt to its time', () => {
    const { db } = freshDb();
    expect(getSeenAt(db)).toBeNull();
    importFixture(db, 'report-full', FIRST);
    expect(getSeenAt(db)).toEqual(FIRST);
    importFixture(db, 'report-later', LATER);
    expect(getSeenAt(db)).toEqual(FIRST);
  });

  test('the same report twice writes no new version', () => {
    const { db } = freshDb();
    importFixture(db, 'report-full', FIRST);
    importFixture(db, 'report-full', LATER);
    expect(db.select().from(unitVersions).all()).toHaveLength(7);
  });

  test('a changed run gets a new version', () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-full', FIRST);
    importFixture(db, 'report-later', LATER);
    const full = runKey(report.runs[4]!)!;
    const versions = versionsOf(db, 'run', full);
    expect(versions.map((v) => v.receivedAt)).toEqual([FIRST, LATER]);
    expect((versions[1]!.raw as { later_fixes: unknown[] }).later_fixes).toHaveLength(1);
    expect(listUnits(db, 'run').find((u) => u.key === full)!.merged.later_fixes).toHaveLength(1);
    expect(versionsOf(db, 'run', runKey(report.runs[3]!)!)).toHaveLength(1);
  });

  test('a later null keeps the earlier models', () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-full', FIRST);
    const small = runKey(report.runs[2]!)!;
    const before = listUnits(db, 'run').find((u) => u.key === small)!;
    expect(before.readable).toBe(true);
    importFixture(db, 'report-later', LATER);
    const after = listUnits(db, 'run').find((u) => u.key === small)!;
    expect(after.merged.models).toEqual(before.merged.models);
    expect(after.merged.models).not.toBeNull();
    expect(after.readable).toBe(false);
  });

  test('a unit missing from the export is marked, not deleted', () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-full', FIRST);
    const gone = sessionKey(report.sessions[1]!);
    importFixture(db, 'report-later', LATER);
    const sessions = listUnits(db, 'session');
    expect(sessions).toHaveLength(2);
    expect(sessions.find((s) => s.key === gone)!.missingSince).toEqual(LATER);
    expect(sessions.find((s) => s.key !== gone)!.missingSince).toBeNull();

    importFixture(db, 'report-later', new Date('2026-11-13T10:00:00Z'));
    expect(listUnits(db, 'session').find((s) => s.key === gone)!.missingSince).toEqual(LATER);

    importFixture(db, 'report-full', new Date('2026-11-14T10:00:00Z'));
    expect(listUnits(db, 'session').find((s) => s.key === gone)!.missingSince).toBeNull();
  });

  test('a warning keeps its first-seen time', () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-full', FIRST);
    expect(listWarnings(db)).toHaveLength(3);
    importFixture(db, 'report-later', LATER);
    const warnings = listWarnings(db);
    expect(warnings).toHaveLength(4);
    const old = warnings.find((w) => w.key === runKey(report.runs[1]!))!;
    expect(old).toEqual({
      kind: 'run',
      key: runKey(report.runs[1]!),
      text: 'WARN: fix/retry-backoff (2026-10-21): no session transcript found',
      firstSeenAt: FIRST,
      warningKind: null,
      stepKind: null,
    });
    const added = warnings.find((w) => w.key === runKey(report.runs[2]!))!;
    expect(added.text).toBe('WARN: chore/tidy-imports (2026-11-03): no session transcript found');
    expect(added.firstSeenAt).toEqual(LATER);
  });

  test("a warning first stored before CR4 takes a later export's kind and step, and keeps its first-seen time", () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-full', FIRST);
    expect(listWarnings(db).every((w) => w.warningKind === null && w.stepKind === null)).toBe(true);
    importFixture(db, 'report-v5', LATER);
    const warnings = listWarnings(db);
    expect(warnings.find((w) => w.key === runKey(report.runs[1]!))).toMatchObject({
      firstSeenAt: FIRST,
      warningKind: 'no_transcript',
      stepKind: null,
    });
    expect(warnings.find((w) => w.key === runKey(report.runs[4]!))).toMatchObject({
      firstSeenAt: FIRST,
      warningKind: 'simplify_record_differs',
      stepKind: 'simplify',
    });
  });

  test('a warning a later export no longer reports keeps its null kind and step', () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-full', FIRST);
    importFixture(db, 'report-v5', LATER);
    expect(listWarnings(db).find((w) => w.key === sessionKey(report.sessions[1]!))).toEqual({
      kind: 'session',
      key: sessionKey(report.sessions[1]!),
      text: 'WARN: session 0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35.jsonl: startup guidelines missing',
      firstSeenAt: FIRST,
      warningKind: null,
      stepKind: null,
    });
  });

  test('a later export with no warning objects keeps the known kind', () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-v5', FIRST);
    importFixture(db, 'report-full', LATER);
    expect(listWarnings(db).find((w) => w.key === runKey(report.runs[4]!))).toMatchObject({
      firstSeenAt: FIRST,
      warningKind: 'simplify_record_differs',
      stepKind: 'simplify',
    });
  });

  test('a failure leaves the stored data unchanged', () => {
    const { db } = freshDb();
    importFixture(db, 'report-full', FIRST);
    const runs = listUnits(db, 'run');
    const sessions = listUnits(db, 'session');
    const warnings = listWarnings(db);
    recordImportFailure(db, 'reporter exited with status 1', LATER);
    expect(listUnits(db, 'run')).toEqual(runs);
    expect(listUnits(db, 'session')).toEqual(sessions);
    expect(listWarnings(db)).toEqual(warnings);
    expect(getSeenAt(db)).toEqual(FIRST);
    expect(lastImport(db)).toEqual({ at: LATER, ok: false, error: 'reporter exited with status 1' });
    expect(lastGoodImport(db)!.at).toEqual(FIRST);
  });

  test('a failure as the first import sets no seenAt', () => {
    const { db } = freshDb();
    recordImportFailure(db, 'reporter not found', FIRST);
    expect(getSeenAt(db)).toBeNull();
    expect(lastGoodImport(db)).toBeNull();
    importFixture(db, 'report-full', LATER);
    expect(getSeenAt(db)).toEqual(LATER);
  });

  test('stores the export raw totals with the import', () => {
    const { db } = freshDb();
    importFixture(db, 'report-later', FIRST);
    expect(lastGoodImport(db)).toEqual({ at: FIRST, totals: fixture('report-later').totals, categories: null });
    expect(lastImport(db)).toEqual({ at: FIRST, ok: true, error: null });
  });

  test("stores the export's category list with the import, as the loader read it", () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-v5', FIRST);
    expect(lastGoodImport(db)!.categories).toEqual(report.categories);
    expect(lastGoodImport(db)!.categories?.areas?.[0]?.list?.[1]).toEqual({
      id: 'task_split',
      label: 'Task split and order',
      means: expect.stringMatching(/^Tasks too big or too small/),
    });
    importFixture(db, 'report-later', LATER);
    expect(lastGoodImport(db)!.categories).toBeNull();
  });

  test('an import stored before the categories column keeps its row and its totals, with no list', () => {
    // The migrations before 0003, which adds the column, applied to a database that then stores an import.
    const dir = mkdtempSync(join(tmpdir(), 'cwd migrate '));
    dirs.push(dir);
    const before = join(dir, 'drizzle');
    const migrations = new URL('../drizzle', import.meta.url);
    cpSync(migrations, before, { recursive: true });
    rmSync(join(before, '0003_import_categories.sql'));
    const journal = JSON.parse(readFileSync(join(before, 'meta', '_journal.json'), 'utf8'));
    journal.entries = journal.entries.filter((e: { tag: string }) => e.tag < '0003');
    writeFileSync(join(before, 'meta', '_journal.json'), JSON.stringify(journal));
    const file = join(dir, 'dashboard.sqlite');
    const old = new Database(file);
    migrate(drizzle(old), { migrationsFolder: before });
    old.prepare('INSERT INTO imports (at, ok, error, totals) VALUES (?, 1, NULL, ?)').run(FIRST.getTime(), '{"runs":3}');
    old.close();

    const db = openDb(file);
    dbs.push(db);
    expect(lastGoodImport(db)).toEqual({ at: FIRST, totals: { runs: 3 }, categories: null });
  });

  test('a run with no key is skipped', () => {
    const { db } = freshDb();
    const raw = fixture('report-full');
    delete raw.runs[0].record.date;
    const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
    if (!loaded.ok) throw new Error('does not load');
    importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, FIRST);
    expect(listUnits(db, 'run')).toHaveLength(4);
    const smallKey = runKey(loaded.report.runs[2]!)!;
    expect(versionsOf(db, 'run', smallKey)[0]!.raw).toEqual(raw.runs[2]);
  });

  test('rebuild gives the same derived rows', () => {
    const { db } = freshDb();
    importFixture(db, 'report-full', FIRST);
    importFixture(db, 'report-later', LATER);
    const runs = listUnits(db, 'run');
    const sessions = listUnits(db, 'session');
    const warnings = listWarnings(db);

    db.update(units).set({ merged: {}, readable: true, firstSeenAt: new Date(0) }).run();
    db.$client.exec('DELETE FROM warnings');
    rebuildDerived(db);

    expect(listUnits(db, 'run')).toEqual(runs);
    expect(listUnits(db, 'session')).toEqual(sessions);
    expect(listWarnings(db)).toEqual(warnings);
  });

  test('a session whose rows move to a run stops counting them, and rebuild gives the same rows', () => {
    const { db } = freshDb();
    const report = importFixture(db, 'report-v6', FIRST);
    const raw = fixture('report-v6');
    const moved = raw.sessions[3];
    expect(moved.refusals).toEqual({ no_model: 1 });
    moved.refusals = {};
    moved.advisor.by_role = {};
    const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
    if (!loaded.ok) throw new Error('does not load');
    importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, LATER);

    const key = sessionKey(report.sessions[3]!);
    const session = listUnits(db, 'session').find((u) => u.key === key)!;
    expect(session.merged.refusals).toEqual({});
    expect(session.merged.advisor?.by_role).toEqual({});
    const sessions = listUnits(db, 'session');

    db.update(units).set({ merged: {} }).run();
    rebuildDerived(db);

    expect(listUnits(db, 'session')).toEqual(sessions);
  });

  test("rebuild gives the same warnings' kinds and steps", () => {
    const { db } = freshDb();
    importFixture(db, 'report-full', FIRST);
    importFixture(db, 'report-v5', LATER);
    const warnings = listWarnings(db);
    expect(warnings.filter((w) => w.warningKind !== null)).toHaveLength(5);

    db.$client.exec('UPDATE warnings SET warning_kind = NULL, step_kind = NULL');
    rebuildDerived(db);

    expect(listWarnings(db)).toEqual(warnings);
  });
});

describe('isIncremental', () => {
  test.each<[string | null, string | null, boolean]>([
    [null, 'a:2', false],
    ['a:1', 'a:2', true],
    ['a:2', 'a:2', false],
    ['a:3', 'a:2', false],
    ['a:1', 'b:2', false],
    ['a:1', null, false],
    ['a:1', 'a2', false],
    ['a:1', 'a:x', false],
    ['a:b:1', 'a:b:2', true],
  ])('sent %s, got %s: %s', (sent, got, expected) => {
    expect(isIncremental(sent, got)).toBe(expected);
  });
});

describe('importReport with a cursor', () => {
  const LAST = new Date('2026-11-13T10:00:00Z');
  const FOURTH = new Date('2026-11-14T10:00:00Z');

  /** Each stored unit's missingSince, by key. */
  function missing(db: Db, kind: 'run' | 'session'): Record<string, Date | null> {
    const stored = kind === 'run' ? listUnits(db, 'run') : listUnits(db, 'session');
    return Object.fromEntries(stored.map((u) => [u.key, u.missingSince]));
  }

  /** A full import of report-full with cursor 's1:1' at FIRST, and its run and session keys. */
  function start(db: Db): { runs: string[]; sessions: string[] } {
    const report = importFixture(db, 'report-full', FIRST, null, (raw) => {
      raw.cursor = 's1:1';
    });
    return { runs: report.runs.map((r) => runKey(r)!), sessions: report.sessions.map(sessionKey) };
  }

  test('an incremental export marks only removed units missing', () => {
    const { db } = freshDb();
    const { runs, sessions } = start(db);
    importFixture(db, 'report-full', LATER, 's1:1', (raw) => {
      raw.runs = [raw.runs[0]];
      raw.sessions = [];
      raw.cursor = 's1:2';
      raw.removed = { runs: [runs[1]], sessions: [sessions[0]] };
    });
    expect(missing(db, 'run')).toEqual({
      [runs[0]!]: null,
      [runs[1]!]: LATER,
      [runs[2]!]: null,
      [runs[3]!]: null,
      [runs[4]!]: null,
    });
    expect(missing(db, 'session')).toEqual({ [sessions[0]!]: LATER, [sessions[1]!]: null });
    expect(getCursor(db)).toBe('s1:2');
  });

  test('a removed key already missing keeps its first time', () => {
    const { db } = freshDb();
    const { runs } = start(db);
    const incremental = (cursor: string, carried: number[], removed: string[]) => (raw: any) => {
      raw.runs = carried.map((i) => raw.runs[i]);
      raw.sessions = [];
      raw.cursor = cursor;
      raw.removed = { runs: removed, sessions: [] };
    };
    importFixture(db, 'report-full', LATER, 's1:1', incremental('s1:2', [0], [runs[1]!]));
    importFixture(db, 'report-full', LAST, 's1:2', incremental('s1:3', [], [runs[1]!]));
    expect(missing(db, 'run')[runs[1]!]).toEqual(LATER);
    importFixture(db, 'report-full', FOURTH, 's1:3', incremental('s1:4', [1], []));
    expect(missing(db, 'run')[runs[1]!]).toBeNull();
    expect(getCursor(db)).toBe('s1:4');
  });

  test('a removed list with only runs marks those runs missing', () => {
    const { db } = freshDb();
    const { runs, sessions } = start(db);
    importFixture(db, 'report-full', LATER, 's1:1', (raw) => {
      raw.runs = [];
      raw.sessions = [];
      raw.cursor = 's1:2';
      raw.removed = { runs: [runs[1]] };
    });
    expect(missing(db, 'run')[runs[1]!]).toEqual(LATER);
    expect(missing(db, 'session')).toEqual({ [sessions[0]!]: null, [sessions[1]!]: null });
    expect(getCursor(db)).toBe('s1:2');
  });

  test('a removed key that was never stored is ignored', () => {
    const { db } = freshDb();
    start(db);
    importFixture(db, 'report-full', LATER, 's1:1', (raw) => {
      raw.runs = [];
      raw.sessions = [];
      raw.cursor = 's1:2';
      raw.removed = { runs: ['0000000000000000'], sessions: [] };
    });
    expect(listUnits(db, 'run')).toHaveLength(5);
    expect(listUnits(db, 'run').every((u) => u.missingSince === null)).toBe(true);
    expect(listUnits(db, 'session')).toHaveLength(2);
  });

  test('another state id is a full export', () => {
    const { db } = freshDb();
    const { runs, sessions } = start(db);
    importFixture(db, 'report-full', LATER, 's1:1', (raw) => {
      raw.runs = [raw.runs[0]];
      raw.sessions = [raw.sessions[0]];
      raw.cursor = 's2:1';
      raw.removed = { runs: [], sessions: [] };
    });
    expect(missing(db, 'run')).toEqual({
      [runs[0]!]: null,
      [runs[1]!]: LATER,
      [runs[2]!]: LATER,
      [runs[3]!]: LATER,
      [runs[4]!]: LATER,
    });
    expect(missing(db, 'session')).toEqual({ [sessions[0]!]: null, [sessions[1]!]: LATER });
    expect(getCursor(db)).toBe('s2:1');
  });

  test('an export with no cursor is full and keeps the stored cursor', () => {
    const { db } = freshDb();
    const { runs, sessions } = start(db);
    importFixture(db, 'report-full', LATER, 's1:1', (raw) => {
      raw.runs = [raw.runs[0]];
      raw.sessions = [raw.sessions[0]];
    });
    expect(missing(db, 'run')).toEqual({
      [runs[0]!]: null,
      [runs[1]!]: LATER,
      [runs[2]!]: LATER,
      [runs[3]!]: LATER,
      [runs[4]!]: LATER,
    });
    expect(missing(db, 'session')).toEqual({ [sessions[0]!]: null, [sessions[1]!]: LATER });
    expect(getCursor(db)).toBe('s1:1');
  });
});
