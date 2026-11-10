import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadReport } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits } from '../src/db/read.ts';
import { periodSessions } from '../src/views/runs.ts';

const NOW = new Date('2026-11-12T12:00:00Z');

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd period sessions '));
  db = openDb(join(dir, 'dashboard.sqlite'));
  const raw = fixture('report-v6');
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('report-v6 does not load');
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

/** The titles of report-v6's sessions in the weeks, sorted. */
function titles(weeks: string[]): (string | null | undefined)[] {
  return periodSessions(listUnits(db, 'session'), weeks)
    .map((s) => s.merged.title)
    .sort();
}

test('a session counts in the week of its start, not of its end', () => {
  // The Scratch session starts on Thursday 5 November and ends in the week of 8 November.
  expect(titles(['2026-11-01'])).toEqual(['Release checklist draft']);
  expect(titles(['2026-11-08'])).toEqual([
    'Offline sync build',
    'Offline sync plan',
    "Port lantern-notes' sync to tidepool-api",
  ]);
});

test('a session with no start counts in no week', () => {
  const sessions = listUnits(db, 'session');
  const noStart = sessions.find((s) => s.merged.title === null)!;
  expect(noStart.merged.warns).toHaveLength(1);
  const kept = periodSessions(sessions, ['2026-10-25', '2026-11-01', '2026-11-08']);
  expect(kept).toHaveLength(sessions.length - 1);
  expect(kept.map((s) => s.key)).not.toContain(noStart.key);
});
