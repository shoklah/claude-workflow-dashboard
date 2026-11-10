import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { CATEGORIES, loadReport, type FindingsResponse, type Relevance } from '@cwd/shared';
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

let dir: string;
let db: Db;

/** A fresh database in the test's folder, holding report-projects' import, changed first by `change`. */
function dbWith(name: string, change: (raw: any) => void = () => {}): Db {
  const fresh = openDb(join(dir, name, 'dashboard.sqlite'));
  const raw = fixture('report-projects');
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
  saveBatch(db, [{ ...input, model: 'claude-haiku-5-5', category, relevance, reason, labelledAt: NOW }], {
    at: NOW,
    inputTokens: 100,
    outputTokens: 20,
  });
}

const row = (body: FindingsResponse, area: string, category: string | null) =>
  body.rows.find((r) => r.area === area && r.category === category);

test("the rows start with the plan area's five categories, in list order", async () => {
  const body = await findings();
  expect(body.weeks).toEqual(WEEKS);
  expect(body.rows.slice(0, 5).map((r) => [r.area, r.category])).toEqual(
    CATEGORIES.plan.map((category) => ['plan', category]),
  );
  expect(body.rows.filter((r) => r.category !== null).map((r) => r.category)).toEqual([
    ...CATEGORIES.plan,
    ...CATEGORIES.implementation,
    ...CATEGORIES.cleanup,
  ]);
});

test("a labelled finding counts in its week's category cell", async () => {
  label(TIDY, 'F1', 'tests', 'valid');
  label(TIDY, 'F2', 'tests', 'invalid');
  const body = await findings();
  // F1 is fixed, F2 deferred; tidy-imports finished in the week of 2026-11-01.
  expect(row(body, 'implementation', 'tests')?.cells).toEqual([
    { raised: 0, actedOn: 0, invalid: 0 },
    { raised: 0, actedOn: 0, invalid: 0 },
    { raised: 2, actedOn: 1, invalid: 1 },
    { raised: 0, actedOn: 0, invalid: 0 },
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
  expect(body.signals).toEqual({ laterFixes: 0, finalAfterClean: 0, notProportionate: 0, declinedOrRuled: 3 });
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
  expect(body.signals).toEqual({ laterFixes: 1, finalAfterClean: 1, notProportionate: 2, declinedOrRuled: 3 });
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
