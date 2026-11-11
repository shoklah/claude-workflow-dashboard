import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadReport, projectRoot, readShare, type ContextResponse, type ContextUnit, type Report } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { importReport } from '../src/db/import.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { projectKey } from '../src/keys.ts';
import { CONTEXT_CAP, contextSums, contextWeek, emptyContext } from '../src/views/context.ts';
import { storedSessionRoots } from '../src/views/runs.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';

function report(): Report {
  const loaded = loadReport(fixture('report-v7'));
  if (!loaded.ok) throw new Error('report-v7 does not load');
  return loaded.report;
}

test("contextSums over report-v7's runs and sessions equals its totals.context week by week", () => {
  const { runs, sessions, totals } = report();
  const sums = contextSums(runs, sessions);
  const expected = totals.context!;
  expect([...sums.keys()].sort()).toEqual(expected.map((row) => row.week).sort());
  for (const row of expected) {
    const sum = sums.get(row.week!)!;
    expect({
      calls: sum.calls,
      tokens: sum.tokens,
      max_tokens: sum.maxTokens,
      units_over_cap: sum.unitsOverCap,
      tool_results: sum.toolResults,
      sweeps: sum.sweeps,
    }).toEqual({
      calls: row.calls,
      tokens: row.tokens,
      max_tokens: row.max_tokens,
      units_over_cap: row.units_over_cap,
      tool_results: row.tool_results,
      sweeps: row.sweeps,
    });
  }
});

test('window-less runs, a session with a null context and a session with no start count nowhere', () => {
  const { runs, sessions } = report();
  const counted = (sums: ReturnType<typeof contextSums>) => [...sums.values()].reduce((n, s) => n + s.units, 0);
  const withContext = runs.filter((r) => r.context).length + sessions.filter((s) => s.context && s.start).length;
  const sums = contextSums(runs, sessions);
  expect(counted(sums)).toBe(withContext);
  // Only the units this test names as skipped: the counted total doesn't move without them.
  const skipped = contextSums(
    runs.filter((r) => !r.context),
    sessions.filter((s) => !s.context || !s.start),
  );
  expect(skipped.size).toBe(0);
  expect(sessions.some((s) => s.title === 'Offline sync build' && s.context === null)).toBe(true);
  expect(sessions.some((s) => !s.start && s.context)).toBe(true);
});

test('a tool_results class the reporter adds later sums, and counts in readShare', () => {
  const { runs } = report();
  const run = runs.find((r) => r.context)!;
  const later = { ...run, tool_results: { read: 300, other: 100, notebook: 600 } };
  const sums = contextSums([later, { ...later }], []);
  const sum = [...sums.values()][0];
  expect(sum.toolResults).toEqual({ read: 600, other: 200, notebook: 1200 });
  expect(readShare(sum.toolResults)).toBe(30);
  expect(contextWeek('2026-11-08', sum).readShare).toBe(30);
});

test('readShare of all zeros or of null is null', () => {
  expect(readShare({ read: 0, edit: 0 })).toBeNull();
  expect(readShare(null)).toBeNull();
  expect(readShare(undefined)).toBeNull();
});

test("contextWeek of emptyContext() has meanTokens and readShare null", () => {
  expect(contextWeek('2026-11-08', emptyContext())).toEqual({
    week: '2026-11-08',
    units: 0,
    calls: 0,
    tokens: 0,
    maxTokens: null,
    unitsOverCap: 0,
    toolResults: {},
    sweeps: { inline: 0, delegated: 0 },
    meanTokens: null,
    readShare: null,
  });
});

test('contextWeek adds the mean tokens per call', () => {
  const { runs, sessions } = report();
  const sum = contextSums(runs, sessions).get('2026-11-01')!;
  expect(contextWeek('2026-11-01', sum).meanTokens).toBe(1026000 / 18);
});

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');
const LANTERN = '/Users/example/Work/lantern-notes';

describe('GET /api/context', () => {
  let dir: string;
  let db: Db;

  /** Imports each fixture in turn into a fresh database. */
  function dbWith(names: string[]): Db {
    const fresh = openDb(join(dir, names.join('+'), 'dashboard.sqlite'));
    names.forEach((name, i) => {
      const raw = fixture(name);
      const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
      if (!loaded.ok) throw new Error(`${name} does not load`);
      const at = new Date(NOW.getTime() - (names.length - i) * 60000);
      importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, at);
    });
    return fresh;
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cwd context '));
    db = dbWith(['report-v6', 'report-v7']);
  });

  afterEach(() => {
    db.$client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function context(query = '?weeks=12'): Promise<ContextResponse> {
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
    const res = await app.request(`/api/context${query}`, { headers: { Host: `localhost:${PORT}` } });
    expect(res.status).toBe(200);
    return res.json();
  }

  /** A unit's name: a run's branch and path, a session's title. */
  const name = (u: ContextUnit) => (u.run ? `${u.run.branch} ${u.run.path}` : u.session!.title);
  const byName = (body: ContextResponse, n: string) => body.units.find((u) => name(u) === n)!;

  test("12 weeks oldest first, the Nov 8 week equals totals.context's row, and the Oct 4 week is empty", async () => {
    const body = await context();
    expect(body.weeks).toHaveLength(12);
    expect(body.weeks.map((w) => w.week)).toEqual([...body.weeks.map((w) => w.week)].sort());
    expect(body.weeks.at(-1)!.week).toBe('2026-11-08');
    const row = fixture('report-v7').totals.context.find((r: any) => r.week === '2026-11-08');
    const nov8 = body.weeks.find((w) => w.week === '2026-11-08')!;
    expect({
      calls: nov8.calls,
      tokens: nov8.tokens,
      max_tokens: nov8.maxTokens,
      units_over_cap: nov8.unitsOverCap,
      tool_results: nov8.toolResults,
      sweeps: nov8.sweeps,
    }).toEqual({ ...row, week: undefined });
    expect(body.weeks.find((w) => w.week === '2026-10-04')).toEqual(contextWeek('2026-10-04', emptyContext()));
    expect(body.weeks.find((w) => w.week === '2026-10-04')!.meanTokens).toBeNull();
    expect(body.cap).toBe(300_000);
    expect(body.cap).toBe(CONTEXT_CAP);
  });

  test('uncounted counts the units with no tool_results, and a path filter leaves sessions out', async () => {
    expect((await context()).uncounted).toEqual({ runs: 3, sessions: 0 });
    const full = await context('?weeks=12&path=full');
    expect(full.uncounted).toEqual({ runs: 2, sessions: 0 });
    expect(full.units.filter((u) => u.kind === 'session')).toEqual([]);
  });

  test('over=1 lists the units over the cap only, the offline-sync full run first, with their handoffs', async () => {
    const body = await context('?weeks=12&over=1');
    expect(body.units.map(name)).toEqual([
      'feature/offline-sync full',
      'feature/webhooks full',
      "Port lantern-notes' sync to tidepool-api",
      'Offline sync plan',
    ]);
    expect(body.units.every((u) => u.overCap)).toBe(true);
    expect(byName(body, 'Offline sync plan').handedOffTo).toEqual({
      title: "Port lantern-notes' sync to tidepool-api",
      sessionId: '2e8d5b13-9c4f-4a7e-b6d1-8f0a3c5e9b72',
    });
    expect(byName(body, 'feature/webhooks full').handedOffTo).toBeNull();
    expect(body.hidden).toBe(0);
  });

  test('without over, the units under the cap follow, by calls past the cap, then largest', async () => {
    const body = await context();
    expect(body.units.map(name)).toEqual([
      'feature/offline-sync full',
      'feature/webhooks full',
      "Port lantern-notes' sync to tidepool-api",
      'Offline sync plan',
      'feature/offline-sync plan',
      '<img src=x onerror=alert(1)> small',
      'Release checklist draft',
    ]);
    const full = byName(body, 'feature/offline-sync full');
    expect(full).toMatchObject({
      kind: 'run',
      session: null,
      at: '2026-11-10T16:45:00Z',
      calls: 318,
      medianTokens: 231800,
      maxTokens: 412600,
      callsOverCap: 87,
      overCap: true,
      handoff: null,
    });
    const plan = byName(body, 'Offline sync plan');
    expect(plan).toMatchObject({
      kind: 'session',
      run: null,
      session: { title: 'Offline sync plan', sessionId: '5a9d3f12-6e8b-4c7a-9f2d-3b1e0c8a4d56', project: 'lantern-notes' },
      at: '2026-11-08T08:02:11.204Z',
      handoff: '2026-11-09T13:31:05.000Z',
    });
    const raw = fixture('report-v7').sessions.find((s: any) => s.title === 'Offline sync plan');
    expect(plan.readShare).toBe(readShare(raw.tool_results));
    expect(plan.sweeps).toEqual({ inline: raw.sweeps?.inline ?? 0, delegated: raw.sweeps?.delegated ?? 0 });
  });

  describe('with showing on lantern-notes', () => {
    test('the sums equal the run with no scope, and only its units are listed, with no session ID', async () => {
      const off = await context();
      setShowing(db, [projectKey(LANTERN)]);
      const body = await context();
      expect(body.weeks).toEqual(off.weeks);
      expect(body.uncounted).toEqual(off.uncounted);
      const lantern = (u: ContextUnit) => (u.run ?? u.session!).project === 'lantern-notes';
      expect(body.units.map((u) => u.key)).toEqual(off.units.filter(lantern).map((u) => u.key));
      expect(body.units.filter((u) => u.session).map((u) => u.session!.sessionId)).toEqual([null]);
      expect(body.units.find((u) => u.session?.title === 'Offline sync plan')!.handedOffTo).toBeNull();
    });

    test('over=1 hides the webhooks run and the tidepool-api session, and the response leaks nothing', async () => {
      setShowing(db, [projectKey(LANTERN)]);
      const body = await context('?weeks=12&over=1');
      expect(body.hidden).toBe(2);

      const raw = fixture('report-v7');
      const branches = new Map<string, string[]>();
      for (const run of [...fixture('report-v6').runs, ...raw.runs]) {
        const root = projectRoot(run.record.project);
        branches.set(root, [...(branches.get(root) ?? []), run.record.branch]);
      }
      const sessionIds = [
        ...new Set(JSON.stringify(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)),
      ];
      const strings = forbiddenStrings(
        [...branches.keys()],
        branches,
        [LANTERN],
        sessionIds,
        storedSessionRoots(listUnits(db, 'session')),
      );
      expect(strings.forbidden).toEqual(expect.arrayContaining(['tidepool-api', 'feature/webhooks']));
      for (const query of ['?weeks=12', '?weeks=12&over=1']) {
        expect(leaks(await context(query), [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
      }
    });
  });

  test('report-v6 alone: every week empty, no unit, and every run and dated session of the period uncounted', async () => {
    db.$client.close();
    db = dbWith(['report-v6']);
    const body = await context();
    expect(body.weeks.every((w) => w.units === 0 && w.calls === 0)).toBe(true);
    expect(body.units).toEqual([]);
    expect(body.uncounted).toEqual({ runs: 7, sessions: 4 });
  });
});
