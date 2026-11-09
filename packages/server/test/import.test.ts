import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { loadReport, runKey, sessionKey, type Report } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport, rebuildDerived, recordImportFailure } from '../src/db/import.ts';
import { getSeenAt, lastGoodImport, lastImport, listUnits, listWarnings } from '../src/db/read.ts';
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

/** Imports a fixture as the server will: the loaded report, with the same parsed JSON's raw units and totals. */
function importFixture(db: Db, name: string, at: Date): Report {
  const raw = fixture(name);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`fixture ${name} does not load`);
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, at);
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
    });
    const added = warnings.find((w) => w.key === runKey(report.runs[2]!))!;
    expect(added.text).toBe('WARN: chore/tidy-imports (2026-11-03): no session transcript found');
    expect(added.firstSeenAt).toEqual(LATER);
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
    expect(lastGoodImport(db)).toEqual({ at: FIRST, totals: fixture('report-later').totals });
    expect(lastImport(db)).toEqual({ at: FIRST, ok: true, error: null });
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
});
