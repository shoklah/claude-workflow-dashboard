import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadReport, projectRoot, type ModelsResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { projectKey } from '../src/keys.ts';
import { modelSums } from '../src/views/models.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');

// report-v5's projects: the runs with dispatches and a main session finish in the week of 2026-11-08.
const LANTERN = '/Users/example/Work/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';

let dir: string;
let db: Db;

/** A fresh database in the test's folder, holding a fixture's import (report-v5 by default), changed first by
 * `change`. */
function dbWith(name: string, change: (raw: any) => void = () => {}, report = 'report-v5'): Db {
  const fresh = openDb(join(dir, name, 'dashboard.sqlite'));
  const raw = fixture(report);
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`${report} does not load`);
  importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  return fresh;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd models '));
  db = dbWith('plain');
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function models(query = ''): Promise<ModelsResponse> {
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
  const res = await app.request(`/api/models${query}`, { headers: { Host: `localhost:${PORT}` } });
  expect(res.status).toBe(200);
  return res.json();
}

const totals = fixture('report-v5').totals;
const byName = <T extends { name: string }>(rows: T[]) => new Map(rows.map((row) => [row.name, row]));

test("modelSums over every stored run gives the reporter's requested and actual models by agent and path", () => {
  const sums = modelSums(listUnits(db, 'run').map((unit) => unit.merged));
  expect(Object.keys(sums.agents).sort()).toEqual(Object.keys(totals.models.agents).sort());
  for (const [name, row] of Object.entries(sums.agents)) {
    expect({ name, ...row }).toEqual({
      name,
      requested: totals.models.agents[name].requested,
      actual: totals.models.agents[name].actual,
    });
  }
  expect(sums.main).toEqual({
    small: totals.models.main.small.actual,
    full: totals.models.main.full.actual,
    plan: totals.models.main.plan.actual,
  });
});

test("modelSums names a dispatch with no agent general-purpose, and a missing model or effort '-'", () => {
  const sums = modelSums([
    {
      record: { path: 'full' },
      dispatches: [{ agent: null, requested_model: 'opus', requested_effort: null, model: null, effort: 'high' }],
      main: { model: null, effort: null },
    },
    // A run with no main session's model adds nothing to its path.
    { record: { path: 'small' }, dispatches: [], main: null },
  ]);
  expect(sums.agents).toEqual({ 'general-purpose': { requested: { 'opus/-': 1 }, actual: { '-/high': 1 } } });
  expect(sums.main).toEqual({ small: {}, full: { '-/-': 1 }, plan: {} });
});

test("the Models page sums the period's dispatches, with the reporter's mismatches, stage table and differs", async () => {
  const body = await models();
  expect(body.agents.map((row) => row.name)).toEqual(Object.keys(totals.models.agents).sort());
  expect(byName(body.agents).get('fix-checker')).toEqual({
    name: 'fix-checker',
    requested: { 'opus/medium': 1 },
    actual: { 'claude-opus-5-5/high': 1 },
    mismatches: 1,
  });
  expect(body.main.find((row) => row.path === 'full')).toEqual({
    path: 'full',
    recommended: totals.models.main.full.recommended,
    actual: { 'claude-opus-5-5/medium': 1, 'claude-opus-5-5/high': 1 },
    differs: 1,
  });
  expect(body.main.map((row) => row.path)).toEqual(['small', 'full', 'plan']);
  expect(body.mismatchesSource).toBe('reporter');
  expect(body.stageSource).toBe('reporter');
});

test("the advisor's facts are the reporter's, and its weeks only the period's", async () => {
  db.$client.close();
  db = dbWith('old week', (raw) => {
    raw.totals.advisor.weeks.unshift({ week: '2026-09-27', advisor: 0.5, fable: 2, share: 25, stop: true });
  });
  const { advisor } = await models();
  expect(advisor.source).toBe('reporter');
  expect(advisor.facts).toEqual({
    calls: 9,
    tokens: { input: 22000, output: 10000, cache_read: 0, cache_write: 0 },
    cost: 0.72,
    byRole: {
      implementer: { calls: 2, flagged: false },
      main: { calls: 6, flagged: false },
      'task-reviewer': { calls: 1, flagged: true },
    },
    failed: { overloaded_error: 1 },
    notes: 9,
    changed: 3,
    missing: 0,
    trial: 'runs 2/5, weeks 1/3',
  });
  expect(advisor.weeks).toEqual([{ week: '2026-11-08', advisor: 0.72, fable: 6.73, share: 9.664429530201343, stop: false }]);
  expect((await models('?weeks=12')).advisor.weeks.map((w) => w.week)).toEqual(['2026-09-27', '2026-11-08']);
});

test('the path and project filters choose the runs whose dispatches and main sessions count', async () => {
  const small = await models('?path=small');
  // No small run dispatched: only the agent the reporter counts a mismatch for, with no dispatches.
  expect(small.agents).toEqual([{ name: 'fix-checker', requested: {}, actual: {}, mismatches: 1 }]);
  expect(small.main.map((row) => [row.path, row.actual])).toEqual([
    ['small', { 'claude-opus-5-5/medium': 1 }],
    ['full', {}],
    ['plan', {}],
  ]);
  const tidepool = byName((await models(`?project=${projectKey(TIDEPOOL)}`)).agents);
  expect(tidepool.has('plan-simplifier')).toBe(false);
  expect(tidepool.get('implementer')?.actual).toEqual({ 'claude-opus-5-5/medium': 3 });
});

test("an agent with the reporter's mismatches but no dispatch in the period gets a row with none", async () => {
  db.$client.close();
  db = dbWith('old agent', (raw) => {
    raw.totals.models.agents['retired-reviewer'] = { requested: {}, actual: {}, mismatches: 2 };
    raw.totals.models.agents['quiet-helper'] = { requested: {}, actual: {}, mismatches: 0 };
  });
  const agents = byName((await models()).agents);
  expect(agents.get('retired-reviewer')).toEqual({ name: 'retired-reviewer', requested: {}, actual: {}, mismatches: 2 });
  // None for an agent with no mismatch.
  expect(agents.has('quiet-helper')).toBe(false);
  expect([...agents.keys()]).toEqual([...agents.keys()].sort());
});

test("the reporter's figures are null when the last export's totals have none", async () => {
  db.$client.close();
  db = dbWith('old reporter', (raw) => {
    raw.totals.models = undefined;
    raw.totals.advisor = undefined;
  });
  const body = await models();
  expect(body.agents.length).toBeGreaterThan(0);
  expect(body.agents.every((row) => row.mismatches === null)).toBe(true);
  expect(body.main.every((row) => row.recommended === null && row.differs === null)).toBe(true);
  expect(body.advisor).toEqual({ source: 'reporter', facts: null, weeks: [] });
});

test("with showing on, the sums count every project and hold no hidden project's name, path or branch", async () => {
  const raw = fixture('report-v5');
  const branches = new Map<string, string[]>();
  for (const run of raw.runs) {
    const root = projectRoot(run.record.project);
    branches.set(root, [...(branches.get(root) ?? []), run.record.branch]);
  }
  const sessionIds = [
    ...new Set(JSON.stringify(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)),
  ];
  const strings = forbiddenStrings([...branches.keys()], branches, [LANTERN], sessionIds);
  expect(strings.forbidden).toContain('tidepool-api');
  db.$client.close();
  db = dbWith('showing', (raw) => {
    // A project-local agent named after the hidden tidepool-api, dispatched by its webhooks run on a model named after
    // its branch, with the reporter's mismatch and advisor call for it, and a failed call's code naming the project.
    const dispatch = raw.runs[5].dispatches[1];
    dispatch.agent = 'tidepool-api-deployer';
    dispatch.requested_model = 'feature/webhooks';
    raw.totals.models.agents['tidepool-api-deployer'] = { requested: {}, actual: {}, mismatches: 1 };
    // Two agents named after the hidden project's branches, never dispatched, with the reporter's mismatches.
    raw.totals.models.agents['feature/webhooks-auditor'] = { requested: {}, actual: {}, mismatches: 1 };
    raw.totals.models.agents['fix/retry-backoff-auditor'] = { requested: {}, actual: {}, mismatches: 2 };
    raw.totals.advisor.by_role['tidepool-api-deployer'] = { calls: 1, flagged: false };
    raw.totals.advisor.failed['tidepool-api.timeout'] = 1;
  });
  setShowing(db, [projectKey(LANTERN)]);
  const body = await models('?weeks=52');
  expect(byName(body.agents).get('another project-deployer')).toMatchObject({
    requested: { 'another branch/-': 1 },
    mismatches: 1,
  });
  expect(byName(body.agents).get('implementer')?.actual).toEqual({ 'claude-opus-5-5/medium': 3 });
  // Their names mask alike, so their rows merge.
  expect(body.agents.filter((row) => row.name.endsWith('-auditor'))).toEqual([
    { name: 'another branch-auditor', requested: {}, actual: {}, mismatches: 3 },
  ]);
  expect(body.advisor.facts?.byRole['another project-deployer']).toEqual({ calls: 1, flagged: false });
  expect(body.advisor.facts?.failed).toEqual({ overloaded_error: 1, 'another project.timeout': 1 });
  expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
});
