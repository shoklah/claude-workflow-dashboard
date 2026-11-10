import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadReport, type FindingsResponse, type Relevance } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp, type AppDeps } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { labelInputs, saveBatch } from '../src/db/labels.ts';
import { projectKey, runKey } from '../src/keys.ts';
import { leaks } from '../src/views/scope.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');
// The default 4 weeks ending NOW's week, oldest first.
const WEEKS = ['2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'];

// report-projects' runs, oldest first: Archive lantern-notes, tidepool-api, Work lantern-notes and its worktree.
const WORK = '/Users/example/Work/lantern-notes';
const [, TIDEPOOL, TIDY, OFFLINE] = fixture('report-projects').runs.map(runKey) as string[];
// report-v5's schema 5 run, labelled by the workflow; it finished in the week of 2026-11-08.
const WEBHOOKS = runKey(fixture('report-v5').runs[5]) as string;

let dir: string;
let db: Db;

// CR10's version 1 list, by area, as report-v5 exports it.
const PLAN = ['scope', 'task_split', 'spec_gap', 'risk_missed', 'test_plan', 'code_facts'];
const IMPLEMENTATION = [
  'correctness',
  'error_handling',
  'data_safety',
  'security_privacy',
  'reuse',
  'conventions',
  'simplicity',
  'tests',
  'naming',
  'performance',
  'docs',
];

/**
 * A fresh database in the test's folder, holding a fixture's import (report-projects by default) with report-v5's
 * category list (CR10's version 1, so labels are saved under 101), changed first by `change`.
 */
function dbWith(name: string, change: (raw: any) => void = () => {}, report = 'report-projects'): Db {
  const fresh = openDb(join(dir, name, 'dashboard.sqlite'));
  const raw = fixture(report);
  raw.categories = fixture('report-v5').categories;
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('report-projects does not load');
  importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  return fresh;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd findings '));
  db = dbWith('plain');
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function findings(query = '', deps: Partial<AppDeps> = {}): Promise<FindingsResponse> {
  const app = createApp({
    db,
    port: PORT,
    requestImport: () => {},
    importing: () => false,
    webDist: null,
    now: () => NOW,
    aliases: {},
    labeller: null,
    ...deps,
  });
  const res = await app.request(`/api/findings${query}`, { headers: { Host: `localhost:${PORT}` } });
  expect(res.status).toBe(200);
  return res.json();
}

/** Stores the app's label of a run's finding, for its current text. */
function label(key: string, findingId: string, category: string, relevance: Relevance, reason = 'a reason'): void {
  const input = labelInputs(listUnits(db, 'run')).find((i) => i.runKey === key && i.findingId === findingId)!;
  saveBatch(
    db,
    [{ ...input, model: 'claude-haiku-5-5', category, relevance, reason, labelledAt: NOW }],
    { at: NOW, inputTokens: 100, outputTokens: 20 },
    101,
  );
}

const row = (body: FindingsResponse, area: string, category: string | null) =>
  body.rows.find((r) => r.area === area && r.category === category);

test("the rows follow the active list: the plan area's six workflow ids first, in its order", async () => {
  const body = await findings();
  expect(body.weeks).toEqual(WEEKS);
  expect(body.rows.slice(0, 6).map((r) => [r.area, r.category])).toEqual(PLAN.map((category) => ['plan', category]));
  expect(body.rows.filter((r) => r.category !== null).map((r) => r.category)).toEqual([
    ...PLAN,
    ...IMPLEMENTATION,
    ...IMPLEMENTATION,
  ]);
  expect(body.categoryLabels.task_split).toBe('Task split and order');
  expect(body.categoryLabels.security_privacy).toBe('Security and privacy');
});

test("with no category list, nothing shows a label: every finding is in its area's unlabelled row", async () => {
  db.$client.close();
  db = dbWith('no list', (raw) => delete raw.categories);
  label(TIDY, 'F1', 'tests', 'valid');
  const body = await findings();
  expect(body.categoryLabels).toEqual({});
  expect(body.rows.map((r) => [r.area, r.category])).toEqual([
    ['plan', null],
    ['implementation', null],
    ['cleanup', null],
  ]);
  expect(body.findings.every((f) => f.category === null)).toBe(true);
});

test("a labelled finding counts in its week's category cell", async () => {
  label(TIDY, 'F1', 'tests', 'valid');
  label(TIDY, 'F2', 'tests', 'invalid');
  const body = await findings();
  // F1 is fixed, F2 deferred; tidy-imports finished in the week of 2026-11-01.
  const none = { raised: 0, actedOn: 0, invalid: 0, strengths: 0, byApp: 0, appDiffers: 0 };
  expect(row(body, 'implementation', 'tests')?.cells).toEqual([
    none,
    none,
    { raised: 2, actedOn: 1, invalid: 1, strengths: 0, byApp: 2, appDiffers: 0 },
    none,
  ]);
  const item = body.findings.find((f) => f.runKey === TIDY && f.id === 'F1');
  expect(item).toMatchObject({
    category: 'tests',
    relevance: 'valid',
    week: '2026-11-01',
    area: 'implementation',
    project: 'lantern-notes (Work)',
    branch: 'chore/tidy-imports',
  });
  expect(item).not.toHaveProperty('run');
});

test("unlabelled findings, and the finding with no id, land in their area's unlabelled row", async () => {
  label(TIDY, 'F1', 'tests', 'valid');
  const body = await findings();
  // tidepool's task review finding (no id) and its final review F2; tidy-imports' F2 and F4.
  expect(row(body, 'implementation', null)?.cells.map((c) => c.raised)).toEqual([2, 0, 2, 0]);
  expect(row(body, 'cleanup', null)?.cells.map((c) => c.raised)).toEqual([1, 0, 1, 0]);
  expect(row(body, 'plan', null)?.cells.map((c) => c.raised)).toEqual([0, 0, 0, 5]);
  // Each area's unlabelled row comes after its categories.
  const areas = body.rows.map((r) => `${r.area} ${r.category}`);
  expect(areas.indexOf('implementation null')).toBe(areas.indexOf('implementation docs') + 1);
  const noId = body.findings.find((f) => f.id === null);
  expect(noId).toMatchObject({ runKey: TIDEPOOL, step: 'task_review', category: null, week: '2026-10-18' });
});

test('an area with every finding labelled has no unlabelled row', async () => {
  for (const id of ['F1', 'F2', 'F3', 'F4', 'F5']) label(OFFLINE, id, 'scope', 'valid');
  const body = await findings();
  expect(row(body, 'plan', null)).toBeUndefined();
  expect(row(body, 'plan', 'scope')?.cells.map((c) => c.raised)).toEqual([0, 0, 0, 5]);
});

test("the signals are the fixture's counts", async () => {
  const body = await findings();
  // tidepool's task reviews raised a finding, and tidy-imports' did, so no final review ran after clean ones.
  expect(body.signals).toEqual({
    laterFixes: 0,
    finalAfterClean: 0,
    notProportionate: 0,
    declinedOrRuled: 3,
    judgedInvalid: 0,
  });
});

test('the signals count later fixes, final findings after clean task reviews and fixes not proportionate', async () => {
  db.$client.close();
  db = dbWith('signals', (raw) => {
    const [, tidepool, tidy] = raw.runs;
    tidepool.steps[0].findings = [];
    tidy.steps[1].counts.not_proportionate = 2;
    tidy.later_fixes = [{ sha: 'a1b2c3d', date: '2026-11-05T10:00:00Z', subject: 'fix: sort the imports' }];
  });
  const body = await findings();
  expect(body.signals).toEqual({
    laterFixes: 1,
    finalAfterClean: 1,
    notProportionate: 2,
    declinedOrRuled: 3,
    judgedInvalid: 0,
  });
});

test("the workflow's labels win in the cells: strengths, byApp and appDiffers in the run's week and category", async () => {
  db.$client.close();
  // The final review's docs finding judged invalid by the session.
  db = dbWith('v5', (raw) => (raw.runs[5].steps[5].findings[0].validity = 'invalid'), 'report-v5');
  label(WEBHOOKS, 'F3', 'conventions', 'invalid');
  label(WEBHOOKS, 'F4', 'error_handling', 'invalid');
  label(WEBHOOKS, 'F7', 'docs', 'valid');
  const body = await findings();
  const nov8 = (area: string, category: string | null) => row(body, area, category)?.cells[3];
  // F3, the workflow's (fixed, valid; the app's conventions differs), and F4, the app's (declined, invalid).
  expect(nov8('implementation', 'error_handling')).toEqual({
    raised: 2,
    actedOn: 1,
    invalid: 1,
    strengths: 0,
    byApp: 1,
    appDiffers: 1,
  });
  // F7: the session's invalid wins over the app's valid, which differs.
  expect(nov8('implementation', 'docs')).toMatchObject({ raised: 1, invalid: 1, byApp: 0, appDiffers: 1 });
  // The task review's tests strength and the final review's security_privacy one, with no finding of theirs.
  expect(nov8('implementation', 'tests')).toEqual({ raised: 0, actedOn: 0, invalid: 0, strengths: 1, byApp: 0, appDiffers: 0 });
  expect(nov8('implementation', 'security_privacy')).toMatchObject({ raised: 0, strengths: 1 });
  expect(body.signals.judgedInvalid).toBe(1);
  expect(body.findings.find((f) => f.runKey === WEBHOOKS && f.id === 'F3')).toMatchObject({
    judge: 'workflow',
    category: 'error_handling',
    appCategory: 'conventions',
  });
});

test("a workflow category outside its step's area counts in the area's unlabelled row", async () => {
  db.$client.close();
  db = dbWith('v5', () => {}, 'report-v5');
  const before = await findings();
  db.$client.close();
  // The plan review's F1 named with an implementation id, and the task review's strength with a plan one.
  db = dbWith(
    'v5 out of area',
    (raw) => {
      raw.runs[5].steps[0].findings[0].category = 'correctness';
      raw.runs[5].steps[1].strengths[0].category = 'spec_gap';
    },
    'report-v5',
  );
  const after = await findings();
  const nov8 = (body: FindingsResponse, area: string) => row(body, area, null)?.cells[3];
  expect(nov8(after, 'plan')?.raised).toBe((nov8(before, 'plan')?.raised ?? 0) + 1);
  expect(nov8(after, 'implementation')?.strengths).toBe((nov8(before, 'implementation')?.strengths ?? 0) + 1);
});

test('the weeks, path and project filters choose the runs counted', async () => {
  expect((await findings('?weeks=1')).findings.map((f) => f.week)).toEqual(Array(5).fill('2026-11-08'));
  expect((await findings('?path=small')).findings.map((f) => f.runKey)).toEqual(Array(4).fill(TIDY));
  const tidepool = await findings(`?project=${projectKey('/Users/example/Work/tidepool-api')}`);
  expect(tidepool.findings.map((f) => f.runKey)).toEqual([TIDEPOOL, TIDEPOOL, TIDEPOOL]);
});

test("a weeks query past the Runs page's longest period is cut to 52 weeks", async () => {
  const body = await findings('?weeks=100000000');
  expect(body.weeks).toHaveLength(52);
  expect(body.weeks.at(-1)).toBe('2026-11-08');
  expect(body.rows[0].cells).toHaveLength(52);
});

test("with a scope, only the shown projects' findings are listed, masked; the cells count every project", async () => {
  label(TIDY, 'F1', 'tests', 'valid', 'as tidepool-api does in /Users/example/Work/tidepool-api/src/x.ts');
  setShowing(db, [projectKey(WORK)]);
  const body = await findings();
  expect(body.findings.some((f) => f.runKey === TIDEPOOL)).toBe(false);
  expect(body.findings).toHaveLength(9);
  expect(body.hidden).toBe(3);
  expect(row(body, 'implementation', null)?.cells.map((c) => c.raised)).toEqual([2, 0, 2, 0]);
  expect(body.findings.find((f) => f.runKey === TIDY && f.id === 'F1')?.labelReason).toBe(
    'as another project does in x.ts',
  );
  expect(leaks(body, ['/Users/example', 'tidepool-api', 'fix/retry-backoff'], [])).toEqual([]);
});

test("the labeller's state: off with no labeller, else the findings waiting for its model", async () => {
  label(TIDY, 'F1', 'tests', 'valid');
  label(TIDY, 'F2', 'tests', 'invalid');
  expect((await findings()).labeller).toEqual({
    on: false,
    labelled: 2,
    waiting: 0,
    tokensThisWeek: { input: 200, output: 40 },
  });
  // 11 findings have an id; 2 are labelled by this model.
  const on = await findings('', { labeller: { model: 'claude-haiku-5-5' } });
  expect(on.labeller).toMatchObject({ on: true, waiting: 9 });
  expect((await findings('', { labeller: { model: 'another-model' } })).labeller).toMatchObject({ waiting: 11 });
});

test('a finding whose area has no categories in the list is not waiting', async () => {
  db.$client.close();
  db = dbWith('no plan list', (raw) => {
    raw.categories.areas = raw.categories.areas.filter((a: { area: string }) => a.area !== 'plan');
  });
  // 11 findings have an id; the 5 plan ones can't be labelled.
  expect((await findings('', { labeller: { model: 'claude-haiku-5-5' } })).labeller).toMatchObject({ waiting: 6 });
});
