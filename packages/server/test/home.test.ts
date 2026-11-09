// The owner's time zone, set before any date is built: a reporter time with no zone must still be UTC.
process.env.TZ = 'Europe/Paris';

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { loadReport, STEP_KINDS, type HomeResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { setSeenAt } from '../src/db/read.ts';
import { weekSums } from '../src/views/home.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');
const FIRST = new Date('2026-11-12T10:00:00Z');
const SECOND = new Date('2026-11-12T11:00:00Z');

const dirs: string[] = [];
const dbs: Db[] = [];

function freshDb(): Db {
  const dir = mkdtempSync(join(tmpdir(), 'cwd home '));
  dirs.push(dir);
  const db = openDb(join(dir, 'data dir', 'dashboard.sqlite'));
  dbs.push(db);
  return db;
}

/** Imports a fixture's JSON (a fixture, or a changed copy of one) as the server does. */
function importRaw(db: Db, raw: any, at: Date): void {
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('the fixture does not load');
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, at);
}

/** A database holding the named fixtures, imported in order at FIRST, then SECOND. */
function dbWith(...raws: any[]): Db {
  const db = freshDb();
  raws.forEach((raw, i) => importRaw(db, raw, [FIRST, SECOND][i]));
  return db;
}

async function home(db: Db): Promise<HomeResponse> {
  const app = createApp({ db, port: PORT, requestImport: () => {}, importing: () => false, webDist: null, now: () => NOW, aliases: {} });
  const res = await app.request('/api/home', { headers: { Host: `localhost:${PORT}` } });
  expect(res.status).toBe(200);
  return res.json();
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.$client.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('week numbers', () => {
  test('this week counts runs by path', async () => {
    expect((await home(dbWith(fixture('report-full')))).thisWeek.runs).toEqual({ small: 0, full: 1, plan: 1 });
    const later = await home(dbWith(fixture('report-full'), fixture('report-later')));
    expect(later.thisWeek.runs).toEqual({ small: 1, full: 1, plan: 1 });
  });

  test('last week is the week before', async () => {
    expect((await home(dbWith(fixture('report-full')))).lastWeek.runs).toEqual({ small: 1, full: 0, plan: 0 });
  });

  test("findings and cost sum the week's runs", async () => {
    const { thisWeek, lastWeek } = await home(dbWith(fixture('report-full')));
    // The plan record's 5 findings and the Full run's 12.
    expect(thisWeek.findings).toEqual({ total: 17, actedOn: 8, notActedOn: 7, open: 1 });
    // The plan record has models with no price (cost 0); the Full run costs 9.52 + 4.275.
    expect(thisWeek.cost).toBeCloseTo(13.795, 10);
    expect(thisWeek.costPerRun).toBeCloseTo(13.795 / 2, 10);
    expect(lastWeek.findings).toEqual({ total: 4, actedOn: 2, notActedOn: 2, open: 0 });
    expect(lastWeek.cost).toBeCloseTo(0.793, 10);
    expect(lastWeek.costPerRun).toBeCloseTo(0.793, 10);
  });

  test('cost is null when no run is priced', async () => {
    const raw = fixture('report-full');
    for (const run of raw.runs) if (run.record.date >= '2026-11-08') run.models = null;
    const { thisWeek } = await home(dbWith(raw));
    expect(thisWeek.cost).toBeNull();
    expect(thisWeek.costPerRun).toBeNull();
  });

  test('new warnings are those first seen after seenAt', async () => {
    const first = await home(dbWith(fixture('report-full')));
    // The Full run's warning, and the session warning first seen at the import.
    expect(first.thisWeek).toMatchObject({ warnings: 2, newWarnings: 0 });
    expect(first.lastWeek).toMatchObject({ warnings: 0, newWarnings: 0 });
    const later = await home(dbWith(fixture('report-full'), fixture('report-later')));
    expect(later.thisWeek).toMatchObject({ warnings: 2, newWarnings: 0 });
    // The Small run's new warning counts in its run's week.
    expect(later.lastWeek).toMatchObject({ warnings: 1, newWarnings: 1 });
  });
});

describe('the diagram', () => {
  test('the full diagram lists plan steps then implementation steps', async () => {
    expect((await home(dbWith(fixture('report-full')))).diagram.full).toEqual([
      { step: 'plan_simplify', ran: 1, findings: 3, actedOn: 2, warnings: 0 },
      { step: 'plan_review', ran: 1, findings: 2, actedOn: 1, warnings: 0 },
      { step: 'task_review', ran: 6, findings: 6, actedOn: 2, warnings: 0 },
      { step: 'simplify', ran: 1, findings: 3, actedOn: 2, warnings: 0 },
      { step: 'final_review', ran: 1, findings: 3, actedOn: 1, warnings: 0 },
    ]);
  });

  test('the small diagram lists only its three steps', async () => {
    // The Small run of 2026-11-03 is older than 7 days; report-later's Small run is in.
    expect((await home(dbWith(fixture('report-full')))).diagram.small.map((s) => s.ran)).toEqual([0, 0, 0]);
    expect((await home(dbWith(fixture('report-full'), fixture('report-later')))).diagram.small).toEqual([
      { step: 'task_review', ran: 1, findings: 0, actedOn: 0, warnings: 0 },
      { step: 'simplify', ran: 1, findings: 0, actedOn: 0, warnings: 0 },
      { step: 'final_review', ran: 1, findings: 0, actedOn: 0, warnings: 0 },
    ]);
  });

  test('a schema 1 run only adds to beforeSteps', async () => {
    const before = await home(dbWith(fixture('report-full')));
    expect(before.diagram.beforeSteps).toBe(0);
    const raw = fixture('report-full');
    raw.runs[0].record.date = '2026-11-11T08:00:00Z';
    raw.runs[0].steps = structuredClone(raw.runs[4].steps);
    const { diagram } = await home(dbWith(raw));
    expect(diagram.beforeSteps).toBe(1);
    expect(diagram.full).toEqual(before.diagram.full);
    expect(diagram.fixChecks).toEqual(before.diagram.fixChecks);
  });

  test('fix-checks count open and round 3', async () => {
    expect((await home(dbWith(fixture('report-full')))).diagram.fixChecks).toEqual({
      // Five fix_check steps and the final_fix_check; wave A's three rounds left one open.
      full: { ran: 6, open: 3, roundThree: 1 },
      small: { ran: 0, open: 0, roundThree: 0 },
    });
  });
});

describe('the charts', () => {
  test('charts have 12 weeks oldest first', async () => {
    const { charts } = await home(dbWith(fixture('report-full')));
    expect(charts.weeks).toHaveLength(12);
    expect(charts.weeks[0]).toBe('2026-08-23');
    expect(charts.weeks[11]).toBe('2026-11-08');
    expect(Object.keys(charts.findingsByStep).sort()).toEqual([...STEP_KINDS].sort());
    for (const series of Object.values(charts.findingsByStep)) expect(series).toHaveLength(12);
    expect(charts.findingsByStep.task_review.slice(8)).toEqual([0, 0, 2, 6]);
    expect(charts.findingsByStep.final_review.slice(8)).toEqual([1, 0, 1, 3]);
    expect(charts.cost.slice(6, 10)).toEqual([null, null, null, null]);
    expect(charts.cost[10]).toBeCloseTo(0.793, 10);
    expect(charts.cost[11]).toBeCloseTo(13.795, 10);
    expect(charts.warnings).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 2]);
  });
});

describe('the feed', () => {
  test('the feed is empty after the first import', async () => {
    expect((await home(dbWith(fixture('report-full')))).feed).toEqual([]);
  });

  test('the feed lists a new run and a new warning after a second import', async () => {
    const db = dbWith(fixture('report-full'), fixture('report-later'));
    const { feed } = await home(db);
    expect(feed).toHaveLength(2);
    expect(feed[0]).toMatchObject({
      at: SECOND.toISOString(),
      type: 'warning',
      project: 'lantern-notes',
      branch: 'chore/tidy-imports',
      text: 'WARN: chore/tidy-imports (2026-11-03): no session transcript found',
      sessionId: null,
      findings: null,
    });
    expect(feed[0].runKey).toMatch(/^[0-9a-f]{16}$/);
    expect(feed[1]).toEqual({
      at: '2026-11-12T09:20:00.000Z',
      type: 'run',
      runKey: expect.stringMatching(/^[0-9a-f]{16}$/),
      project: 'lantern-notes',
      branch: '<img src=x onerror=alert(1)>',
      path: 'small',
      text: null,
      sessionId: null,
      findings: { total: 0, actedOn: 0, notActedOn: 0, open: 0 },
      minutes: 30,
      cost: 0.71,
    });
  });
});

test('coverageFrom is the earliest readable run', async () => {
  expect((await home(dbWith(fixture('report-full')))).coverageFrom).toBe('2026-11-03T10:40:00Z');
  // report-later loses the Small run's window, so the plan record is the earliest readable run.
  const later = await home(dbWith(fixture('report-full'), fixture('report-later')));
  expect(later.coverageFrom).toBe('2026-11-08T09:30:00Z');
});

test("weekSums matches the fixture's totals.weeks", () => {
  for (const name of ['report-full', 'report-later']) {
    const loaded = loadReport(fixture(name));
    if (!loaded.ok) throw new Error(`fixture ${name} does not load`);
    const sums = weekSums(loaded.report.runs);
    const weeks = loaded.report.totals.weeks ?? [];
    expect(weeks.length).toBeGreaterThan(0);
    expect(sums.size).toBe(weeks.length);
    for (const week of weeks) {
      const sum = sums.get(week.week!);
      expect(sum?.runs).toEqual({ small: week.runs?.small ?? 0, full: week.runs?.full ?? 0, plan: week.runs?.plan ?? 0 });
      if (week.cost == null) expect(sum?.cost).toBeNull();
      else expect(sum?.cost).toBeCloseTo(week.cost, 10);
    }
  }
});

test('a run date with no zone is UTC, so Sunday 07:00 starts its week', () => {
  expect([...weekSums([{ record: { date: '2026-11-08T07:00:00' } }]).keys()]).toEqual(['2026-11-08']);
});

test('no response field holds a slash-containing project or a transcript path', async () => {
  const db = dbWith(fixture('report-full'), fixture('report-later'));
  // Everything ever seen goes to the feed, the session warning included.
  setSeenAt(db, new Date(0));
  const response = await home(db);
  expect(response.feed.some((item) => item.sessionId !== null)).toBe(true);
  const text = JSON.stringify(response);
  const projects = new Set<string>();
  for (const name of ['report-full', 'report-later']) {
    for (const run of fixture(name).runs) if (run.record?.project) projects.add(run.record.project);
  }
  expect(projects.size).toBeGreaterThan(0);
  for (const project of projects) expect(text).not.toContain(project);
  expect(text).not.toContain('.jsonl');
});
