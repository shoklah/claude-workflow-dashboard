import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadReport, modelsCost, projectRoot, type Report, type RunEntry, type SpendResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { importReport } from '../src/db/import.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { projectKey } from '../src/keys.ts';
import { storedSessionRoots } from '../src/views/runs.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';
import { groupOf, phaseSums, type PhaseSums } from '../src/views/spend.ts';

function report(): Report {
  const loaded = loadReport(fixture('report-v7'));
  if (!loaded.ok) throw new Error('report-v7 does not load');
  return loaded.report;
}

/** Every week's sums together: cost (priced cells), advisor and uncounted. */
function allWeeks(sums: Map<string, PhaseSums>) {
  let cost = 0;
  const advisor = { calls: 0, cost: 0 };
  const uncounted = { runs: 0, sessions: 0 };
  for (const sum of sums.values()) {
    for (const phase of Object.values(sum.phases)) {
      for (const value of Object.values(phase.byModel)) cost += value ?? 0;
      advisor.calls += phase.advisor.calls;
      advisor.cost += phase.advisor.cost;
    }
    uncounted.runs += sum.uncounted.runs;
    uncounted.sessions += sum.uncounted.sessions;
  }
  return { cost, advisor, uncounted };
}

describe("phaseSums over report-v7's runs and sessions", () => {
  test("the phases' cost equals the units' modelsCost, and the advisor and uncounted add up", () => {
    const { runs, sessions } = report();
    const total = allWeeks(phaseSums(runs, sessions));
    const withPhases = [...runs, ...sessions].filter((u) => u.phases != null);
    const expected = withPhases.reduce((sum, u) => sum + (modelsCost(u.models) ?? 0), 0);
    expect(total.cost).toBeCloseTo(expected);
    expect(total.cost).toBeCloseTo(25.06);
    expect(allWeeks(phaseSums(runs, [])).cost).toBeCloseTo(23.24);
    expect(allWeeks(phaseSums([], sessions)).cost).toBeCloseTo(1.82);
    expect(total.advisor.calls).toBe(10);
    expect(total.advisor.cost).toBeCloseTo(0.78);
    expect(total.uncounted).toEqual({ runs: 3, sessions: 0 });
  });

  test('an unpriced model is null, never 0', () => {
    const { runs, sessions } = report();
    const design = [...phaseSums(runs, sessions).values()].flatMap((sum) => sum.phases.design ?? []);
    const cells = design.filter((phase) => 'claude-fable-6-preview' in phase.byModel);
    expect(cells.length).toBeGreaterThan(0);
    for (const phase of cells) expect(phase.byModel['claude-fable-6-preview']).toBeNull();
  });

  test('a name mapper renames every model before summing, leaving the totals unchanged', () => {
    const { runs, sessions } = report();
    const sums = phaseSums(runs, sessions, () => 'x');
    for (const sum of sums.values()) {
      for (const phase of Object.values(sum.phases)) expect(Object.keys(phase.byModel).every((k) => k === 'x')).toBe(true);
    }
    expect(allWeeks(sums)).toEqual(allWeeks(phaseSums(runs, sessions)));
  });
});

describe('phaseSums over inline units', () => {
  const base = (): RunEntry => report().runs.at(-1)!;
  const run = (phases: RunEntry['phases']): RunEntry => ({ ...base(), phases });

  test("a phase name the reporter adds later sums under its name, and groupOf calls it 'unattributed'", () => {
    const sums = phaseSums([run([{ name: 'a_new_phase', models: { m: { cost: 2 } } }])], []);
    const [sum] = [...sums.values()];
    expect(sum.phases.a_new_phase.byModel).toEqual({ m: 2 });
    expect(groupOf('a_new_phase')).toBe('unattributed');
    expect(groupOf('simplify')).toBe('review');
  });

  test('an empty list adds nothing and is counted; a null list is uncounted', () => {
    expect(allWeeks(phaseSums([run([])], []))).toEqual({
      cost: 0,
      advisor: { calls: 0, cost: 0 },
      uncounted: { runs: 0, sessions: 0 },
    });
    expect(allWeeks(phaseSums([run(null)], [])).uncounted).toEqual({ runs: 1, sessions: 0 });
  });

  test('a model priced in one unit and null in another sums to the priced cost', () => {
    const sums = phaseSums(
      [run([{ name: 'implement', models: { m: { cost: null } } }]), run([{ name: 'implement', models: { m: { cost: 3 } } }])],
      [],
    );
    const [sum] = [...sums.values()];
    expect(sum.phases.implement.byModel).toEqual({ m: 3 });
  });
});

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');
const LANTERN = '/Users/example/Work/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';

describe('GET /api/spend', () => {
  let dir: string;
  let db: Db;

  /** Imports each raw export in turn into a fresh database. */
  function dbFrom(raws: any[]): Db {
    const fresh = openDb(join(mkdtempSync(join(dir, 'db ')), 'dashboard.sqlite'));
    raws.forEach((raw, i) => {
      const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
      if (!loaded.ok) throw new Error('a fixture does not load');
      const at = new Date(NOW.getTime() - (raws.length - i) * 60000);
      importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, at);
    });
    return fresh;
  }

  /** Report-v6, then report-v7 as `change` leaves it. */
  function reopen(change: (raw: any) => void): void {
    db.$client.close();
    const raw = fixture('report-v7');
    change(raw);
    db = dbFrom([fixture('report-v6'), raw]);
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cwd spend '));
    db = dbFrom([fixture('report-v6'), fixture('report-v7')]);
  });

  afterEach(() => {
    db.$client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  async function spend(query = '?weeks=52'): Promise<SpendResponse> {
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
    const res = await app.request(`/api/spend${query}`, { headers: { Host: `localhost:${PORT}` } });
    expect(res.status).toBe(200);
    return res.json();
  }

  const group = (body: SpendResponse, name: string) => body.groups.find((g) => g.group === name)!;
  const rows = (body: SpendResponse) => [body.total, ...body.groups, ...body.groups.flatMap((g) => g.phases)];

  test("the five groups in order, review's phases and implement's cost and advisor", async () => {
    const body = await spend();
    expect(body.groups.map((g) => g.group)).toEqual(['plan', 'implement', 'review', 'coordination', 'unattributed']);
    expect(group(body, 'review').phases.map((p) => p.name)).toEqual([
      'task_review',
      'fix_check',
      'simplify',
      'final_review',
      'final_fix_check',
    ]);
    expect(group(body, 'implement').cost).toBeCloseTo(9.6);
    expect(group(body, 'implement').advisor.calls).toBe(8);
    expect(group(body, 'implement').advisor.cost).toBeCloseTo(0.64);
  });

  test("the shares sum to 100, and the weeks' totals to the total's cost", async () => {
    const body = await spend();
    expect(body.total.cost).toBeCloseTo(25.06);
    expect(body.total.share).toBeNull();
    expect(body.groups.reduce((sum, g) => sum + g.share!, 0)).toBeCloseTo(100, 2);
    for (const week of body.weeks) {
      expect(week.total).toBeCloseTo(Object.values(week.groups).reduce((a, b) => a + b, 0));
    }
    expect(body.weeks.reduce((sum, w) => sum + w.total, 0)).toBeCloseTo(body.total.cost);
    expect(body.weeks).toHaveLength(52);
  });

  test('models by cost, the unpriced ones last and null in every row', async () => {
    const body = await spend();
    expect(body.models[0]).toBe('claude-opus-5-5');
    expect(body.models.slice(2).sort()).toEqual(['claude-fable-6-preview', 'claude-sonnet-9-preview']);
    expect(body.unpriced).toBe(true);
    expect(group(body, 'implement').byModel['claude-fable-5-1']).toBe(0);
    for (const row of rows(body)) {
      expect(Object.keys(row.byModel).sort()).toEqual([...body.models].sort());
      expect(row.byModel['claude-fable-6-preview']).toBeNull();
    }
  });

  test('path=plan: no priced spend, every share null, and the plan phases listed', async () => {
    const body = await spend('?weeks=52&path=plan');
    expect(body.total.cost).toBe(0);
    expect(rows(body).every((row) => row.share === null)).toBe(true);
    expect([...body.models].sort()).toEqual(['claude-fable-6-preview', 'claude-sonnet-9-preview']);
    expect(body.unpriced).toBe(true);
    expect(group(body, 'plan').phases.map((p) => p.name)).toEqual(['design', 'plan_writing']);
  });

  test('units=runs and units=sessions; under a path, sessions are out whatever units says', async () => {
    expect((await spend('?weeks=52&units=runs')).total.cost).toBeCloseTo(23.24);
    expect((await spend('?weeks=52&units=sessions')).total.cost).toBeCloseTo(1.82);
    const sessions = await spend('?weeks=52&path=full&units=sessions');
    expect(sessions).toEqual(await spend('?weeks=52&path=full&units=runs'));
    expect(sessions.total.cost).toBeCloseTo(22.53);
  });

  test('a period with no counted unit: cost 0, every share null and no NaN', async () => {
    const body = await spend(`?weeks=52&path=small&project=${projectKey(TIDEPOOL)}`);
    expect(body.total.cost).toBe(0);
    expect(rows(body).every((row) => row.share === null)).toBe(true);
    expect(JSON.stringify(body)).not.toContain('NaN');
  });

  test('fullFrom is the week after the last uncounted run, and null when the last week has one', async () => {
    const body = await spend();
    expect(body.fullFrom).toBe('2026-11-08');
    expect(body.weeks.filter((w) => w.uncounted.runs > 0).map((w) => w.week)).toEqual([
      '2026-10-04',
      '2026-10-18',
      '2026-11-01',
    ]);
    reopen((raw) => {
      raw.runs[6].phases = null;
    });
    expect((await spend()).fullFrom).toBeNull();
  });

  test('units=nonsense answers as units=all', async () => {
    expect(await spend('?weeks=52&units=nonsense')).toEqual(await spend('?weeks=52'));
  });

  describe('with showing on lantern-notes', () => {
    function strings() {
      const branches = new Map<string, string[]>();
      for (const run of [...fixture('report-v6').runs, ...fixture('report-v7').runs]) {
        const root = projectRoot(run.record.project);
        branches.set(root, [...(branches.get(root) ?? []), run.record.branch]);
      }
      const sessionIds = [
        ...new Set(
          JSON.stringify(fixture('report-v7')).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g),
        ),
      ];
      return forbiddenStrings(
        [...branches.keys()],
        branches,
        [LANTERN],
        sessionIds,
        storedSessionRoots(listUnits(db, 'session')),
      );
    }

    test('the sums equal the run with no scope, and the response leaks nothing', async () => {
      const off = await spend();
      setShowing(db, [projectKey(LANTERN)]);
      const body = await spend();
      expect(body).toEqual(off);
      const { forbidden, shown } = strings();
      expect(forbidden).toEqual(expect.arrayContaining(['tidepool-api', 'feature/webhooks']));
      for (const query of ['?weeks=52', '?weeks=52&units=sessions']) {
        expect(leaks(await spend(query), [...forbidden, '/Users/example'], shown)).toEqual([]);
      }
    });

    test("a hidden project's phase named as its folder is masked", async () => {
      reopen((raw) => {
        const webhooks = raw.runs.find((r: any) => r.record.branch === 'feature/webhooks');
        webhooks.phases.push({ name: 'tidepool-api', models: {}, advisor: { calls: 0, cost: 0 } });
      });
      const off = await spend();
      expect(group(off, 'unattributed').phases.map((p) => p.name)).toContain('tidepool-api');
      setShowing(db, [projectKey(LANTERN)]);
      const body = await spend();
      const { forbidden, shown } = strings();
      expect(leaks(body, [...forbidden, '/Users/example'], shown)).toEqual([]);
      expect(group(body, 'unattributed').phases.map((p) => p.name)).toContain('another project');
    });
  });
});
