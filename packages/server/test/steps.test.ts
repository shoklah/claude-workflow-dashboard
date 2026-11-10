import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadReport, projectRoot, STEP_KINDS, type StepsResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { projectKey } from '../src/keys.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';
import { cr6Of, ruleSums, stepSums, unitSums } from '../src/views/steps.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');

let dir: string;
let db: Db;

/** A fresh database in the test's folder, holding the named fixture's import, changed first by `change`. */
function dbWith(name: string, change: (raw: any) => void = () => {}): Db {
  const fresh = openDb(join(dir, name, 'dashboard.sqlite'));
  const raw = fixture(name);
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`${name} does not load`);
  importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  return fresh;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd steps '));
  db = dbWith('report-v5');
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function steps(query = ''): Promise<StepsResponse> {
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
  const res = await app.request(`/api/steps${query}`, { headers: { Host: `localhost:${PORT}` } });
  expect(res.status).toBe(200);
  return res.json();
}

const board = fixture('report-v5').totals.scoreboard;

/** A step row as the reporter's scoreboard row for its kind reads, with the static page's outcome columns. */
function scoreRow(kind: string) {
  const row = board[kind];
  const out = (key: string) => row.outcomes[key] ?? 0;
  return {
    step: kind,
    ran: row.ran,
    found: row.found,
    counts: row.counts,
    fixedOrApplied: out('fixed') + out('applied'),
    declined: out('declined'),
    deferred: out('deferred'),
    openOrToOwner: out('open') + out('to_owner'),
    tokens: row.tokens,
  };
}

function expectScoreboard(rows: StepsResponse['steps']): void {
  expect(rows.map((r) => r.step)).toEqual([...STEP_KINDS]);
  for (const row of rows) {
    const { cost, ...rest } = row;
    expect(rest).toEqual(scoreRow(row.step));
    // Costs to the cent: the reporter's are float sums.
    if (board[row.step].cost === null) expect(cost).toBeNull();
    else expect(cost).toBeCloseTo(board[row.step].cost, 2);
  }
}

const rules = {
  failingTest: board.failing_test,
  fixRoundCap: board.fix_round_cap,
  stopRule: board.stop_rule.stops,
  offers: fixture('report-v5').totals.offers,
};

test("stepSums over every stored run equals the reporter's scoreboard, per step kind", () => {
  expectScoreboard(stepSums(listUnits(db, 'run').map((unit) => unit.merged)));
});

test("ruleSums over every stored run equals the scoreboard's rules and the offers' totals", () => {
  expect(ruleSums(listUnits(db, 'run').map((unit) => unit.merged))).toEqual(rules);
});

test("over a 52-week period, the steps and rules are the reporter's", async () => {
  const body = await steps('?weeks=52');
  expectScoreboard(body.steps);
  expect(body.rules).toMatchObject(rules);
});

const V6 = fixture('report-v6').totals;
const LANTERN = '/Users/example/Work/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';

test("unitSums over every unit of report-v6 equals the reporter's dispatch guard, startup and advisor", () => {
  db.$client.close();
  db = dbWith('report-v6');
  const runs = listUnits(db, 'run').map((unit) => unit.merged);
  const sessions = listUnits(db, 'session').map((unit) => unit.merged);
  const sums = unitSums(runs, sessions, cr6Of(runs, sessions));
  expect(sums.dispatchGuard).toEqual(V6.scoreboard.dispatch_guard);
  expect(sums.startup).toEqual(V6.scoreboard.startup);
  const { cost, share, ...rest } = sums.advisor!;
  const totals = V6.advisor;
  expect(rest).toEqual({
    calls: totals.calls,
    tokens: totals.tokens,
    byRole: totals.by_role,
    failed: totals.failed,
    notes: totals.notes,
    changed: totals.changed,
    missing: totals.missing,
  });
  expect({ calls: rest.calls, notes: rest.notes, changed: rest.changed }).toEqual({
    calls: V6.scoreboard.advisor.calls,
    notes: V6.scoreboard.advisor.notes,
    changed: V6.scoreboard.advisor.changed,
  });
  // Cost to the cent and share to 0.01 points: the reporter's are float sums.
  expect(cost).toBeCloseTo(totals.cost, 2);
  expect(cost).toBeCloseTo(V6.scoreboard.advisor.cost, 2);
  expect(share).toBeCloseTo(V6.scoreboard.advisor.share, 2);
});

test('the share is 0 when the advisor and Fable dollars are both 0', () => {
  const advisor = { calls: 0, cost: 0, tokens: {}, by_role: {}, failed: {}, weeks: [] };
  const sessions = [{ file: 'a', refusals: {}, startup: true, advisor }];
  expect(unitSums([], sessions, cr6Of([], sessions)).advisor?.share).toBe(0);
});

test('on an export from before CR6, the dispatch guard, startup and advisor are null, never partial sums', () => {
  db.$client.close();
  db = dbWith('report-full');
  const runs = listUnits(db, 'run').map((unit) => unit.merged);
  const sessions = listUnits(db, 'session').map((unit) => unit.merged);
  const sums = unitSums(runs, sessions, cr6Of(runs, sessions));
  expect(sums).toEqual({ dispatchGuard: null, startup: null, advisor: null });
});

test("the Steps page's rules sum the period's runs, by finish, and sessions, by start", async () => {
  db.$client.close();
  db = dbWith('report-v6');
  const { rules } = await steps('?weeks=52');
  expect(rules.dispatchGuard).toEqual({ no_model: 2, no_simplify: 1 });
  // The session with no start is in no period.
  expect(rules.startup).toEqual({ with: 1, without: 3 });
  expect(rules.advisor).toMatchObject({ calls: 10, notes: 10, changed: 4 });
  expect(rules.advisor?.cost).toBeCloseTo(0.78, 2);
  expect(rules.advisor?.share).toBeCloseTo(V6.scoreboard.advisor.share, 2);
  expect(Object.keys(rules.advisor!).sort()).toEqual(['calls', 'changed', 'cost', 'notes', 'share']);
  // This week leaves out the Scratch session of Nov 5.
  expect((await steps('?weeks=1')).rules.startup).toEqual({ with: 1, without: 2 });
});

test('a project filter keeps the sessions whose root has its key', async () => {
  db.$client.close();
  db = dbWith('report-v6');
  // tidepool-api: the webhooks run's no_simplify and its advisor's 3 calls, the Nov 9 session's no_model and 1 call.
  const tidepool = (await steps(`?project=${projectKey(TIDEPOOL)}`)).rules;
  expect(tidepool.dispatchGuard).toEqual({ no_model: 1, no_simplify: 1 });
  expect(tidepool.startup).toEqual({ with: 0, without: 1 });
  expect(tidepool.advisor?.calls).toBe(4);
  // lantern-notes: its worktree's session folds into it.
  expect((await steps(`?project=${projectKey(LANTERN)}`)).rules.startup).toEqual({ with: 1, without: 1 });
});

test('a path filter leaves the sessions out', async () => {
  db.$client.close();
  db = dbWith('report-v6');
  // The full runs' advisors and refusals only: 5 and 3 calls and the webhooks runs' refusals, not the Nov 9 session's.
  const full = (await steps('?path=full')).rules;
  expect(full.advisor?.calls).toBe(8);
  expect(full.dispatchGuard).toEqual({ no_model: 1, no_simplify: 1 });
  // A session has no path.
  expect(full.startup).toBeNull();
});

test('whether the export is CR6 is decided over every stored unit: a CR6 period with no units sums to zeros', async () => {
  db.$client.close();
  db = dbWith('report-v6');
  // A project key no unit has: no run and no session, so every figure is 0, as the Steps page's Empty story shows.
  const { rules } = await steps('?project=0000000000000000');
  expect({ dispatchGuard: rules.dispatchGuard, startup: rules.startup, advisor: rules.advisor }).toEqual({
    dispatchGuard: {},
    startup: { with: 0, without: 0 },
    advisor: { calls: 0, notes: 0, changed: 0, cost: 0, share: 0 },
  });
});

test('on an export from before CR6 the period sums are null too, whatever the filters', async () => {
  db.$client.close();
  db = dbWith('report-full');
  for (const query of ['?weeks=52', '?weeks=52&path=full']) {
    const { rules } = await steps(query);
    expect({ dispatchGuard: rules.dispatchGuard, startup: rules.startup, advisor: rules.advisor }).toEqual({
      dispatchGuard: null,
      startup: null,
      advisor: null,
    });
  }
});

test('the period and path filters choose the runs summed', async () => {
  const final = (body: StepsResponse) => body.steps.find((r) => r.step === 'final_review')!.ran;
  // The default 4 weeks leave out the schema 1 run of Oct 6, whose final review the reporter adds from its totals.
  expect(final(await steps())).toBe(board.final_review.ran - 1);
  // The plan record has only plan steps.
  const plan = await steps('?weeks=52&path=plan');
  expect(plan.steps.filter((r) => r.ran > 0).map((r) => r.step)).toEqual(['plan_simplify', 'plan_review']);
  expect(plan.rules.failingTest).toEqual({ passed: 0, failed: 0, no_tests: 0, couldnt_run: 0, exempt: 0 });
});

test("ruleSums counts only the reporter's five failing-test results", () => {
  const runs = [{ record: { failing_test: [{ result: 'passed' }, { result: 'flaky' }, { result: null }] } }];
  expect(ruleSums(runs).failingTest).toEqual({ passed: 1, failed: 0, no_tests: 0, couldnt_run: 0, exempt: 0 });
});

test('with showing on, the response holds no hidden project text and no session ID', async () => {
  setShowing(db, [projectKey('/Users/example/Work/lantern-notes')]);
  const body = await steps('?weeks=52');
  // Sums still count every project.
  expectScoreboard(body.steps);
  const hidden = ['/Users/example', 'tidepool-api', 'fix/retry-backoff', 'feature/rate-limits', 'feature/webhooks'];
  expect(leaks(body, [...hidden, '7d1e4b90-3c2a-4f6e-8b5d-1a9c0e2f6b47'], [])).toEqual([]);
});

test("with showing on, an offered skill named after a hidden project is masked, and the offers still count it", async () => {
  const raw = fixture('report-v5');
  const branches = new Map<string, string[]>();
  for (const run of raw.runs) {
    const root = projectRoot(run.record.project);
    branches.set(root, [...(branches.get(root) ?? []), run.record.branch]);
  }
  const lantern = '/Users/example/Work/lantern-notes';
  const strings = forbiddenStrings([...branches.keys()], branches, [lantern], []);
  expect(strings.forbidden).toContain('tidepool-api');
  db.$client.close();
  db = dbWith('report-v5', (raw) => {
    // A project-local skill named after the hidden tidepool-api, offered in its webhooks run.
    raw.runs[5].offers[1].skill = 'tidepool-api-release';
  });
  setShowing(db, [projectKey(lantern)]);
  const body = await steps('?weeks=52');
  expect(body.rules.offers['another project-release']).toMatchObject({ offered: 1, skipped: 1 });
  expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
});
