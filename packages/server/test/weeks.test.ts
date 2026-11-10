import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadReport, type WeeksResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { setShowing } from '../src/db/read.ts';
import { projectKey } from '../src/keys.ts';
import { leaks } from '../src/views/scope.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd weeks '));
  db = openDb(join(dir, 'dashboard.sqlite'));
  const raw = fixture('report-v5');
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('report-v5 does not load');
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function weeks(query = ''): Promise<WeeksResponse> {
  const app = createApp({
    db,
    port: PORT,
    requestImport: () => {},
    importing: () => false,
    webDist: null,
    now: () => NOW,
    aliases: {},
    labeller: null,
  });
  const res = await app.request(`/api/weeks${query}`, { headers: { Host: `localhost:${PORT}` } });
  expect(res.status).toBe(200);
  return res.json();
}

test("each week's row matches the fixture's totals.weeks row", async () => {
  const body = await weeks('?weeks=52');
  const totals = fixture('report-v5').totals;
  expect(body.weeks).toHaveLength(52);
  // Oldest first, ending with NOW's week.
  expect(body.weeks.slice(-2).map((w) => w.week)).toEqual(['2026-11-01', '2026-11-08']);
  for (const want of totals.weeks) {
    const row = body.weeks.find((w) => w.week === want.week)!;
    expect(row).toMatchObject({
      runs: { small: want.runs.small ?? 0, full: want.runs.full ?? 0, plan: want.runs.plan ?? 0 },
      tasks: want.tasks,
      findings: want.findings,
      fixRounds: want.fix_rounds,
      stops: want.stops,
      fablePoints: want.fable_points,
      allPoints: want.all_points,
      minutesPerRun: want.minutes_per_run,
      laterFixes: want.later_fixes,
    });
    if (want.cost === null) expect(row.cost).toBeNull();
    else expect(row.cost).toBeCloseTo(want.cost, 10);
  }
});

test('a week with no runs has an empty row', async () => {
  const row = (await weeks()).weeks.find((w) => w.week === '2026-10-25');
  expect(row).toEqual({
    week: '2026-10-25',
    runs: { small: 0, full: 0, plan: 0 },
    tasks: 0,
    findings: { critical: 0, important: 0, minor: 0, unneeded: 0 },
    fixRounds: 0,
    stops: 0,
    fablePoints: null,
    allPoints: null,
    cost: null,
    minutesPerRun: null,
    laterFixes: 0,
  });
});

test("runTime matches the fixture's totals.run_time", async () => {
  const want = fixture('report-v5').totals.run_time;
  expect((await weeks('?weeks=52')).runTime).toEqual({
    withWaves: { runs: want.with_waves.runs, timed: want.with_waves.timed, medianMinutes: want.with_waves.median_minutes },
    withoutWaves: {
      runs: want.without_waves.runs,
      timed: want.without_waves.timed,
      medianMinutes: want.without_waves.median_minutes,
    },
  });
});

test('the weeks, path and project filters choose the runs counted', async () => {
  const thisWeek = await weeks('?weeks=1');
  expect(thisWeek.weeks.map((w) => w.week)).toEqual(['2026-11-08']);
  // Only the two Full runs of this week, one with waves.
  expect(thisWeek.runTime).toEqual({
    withWaves: { runs: 1, timed: 1, medianMinutes: 460 },
    withoutWaves: { runs: 1, timed: 1, medianMinutes: 320 },
  });
  const small = await weeks('?path=small&weeks=1');
  expect(small.weeks[0].runs).toEqual({ small: 1, full: 0, plan: 0 });
  expect(small.runTime.withWaves.runs + small.runTime.withoutWaves.runs).toBe(0);
  const tidepool = await weeks(`?weeks=1&project=${projectKey('/Users/example/Work/tidepool-api')}`);
  expect(tidepool.weeks[0].runs).toEqual({ small: 0, full: 1, plan: 0 });
});

test('coverageFrom is the earliest readable run', async () => {
  expect((await weeks()).coverageFrom).toBe('2026-11-08T09:30:00Z');
});

test('with showing on, the response holds no project text', async () => {
  setShowing(db, [projectKey('/Users/example/Work/lantern-notes')]);
  const body = await weeks('?weeks=52');
  expect(body.weeks.at(-1)!.runs).toEqual({ small: 1, full: 2, plan: 1 });
  expect(leaks(body, ['/Users/example', 'tidepool-api', 'feature/webhooks', 'fix/retry-backoff'], [])).toEqual([]);
});
