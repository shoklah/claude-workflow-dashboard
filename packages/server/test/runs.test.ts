import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  loadReport,
  modelsCost,
  projectRoot,
  type HomeResponse,
  type Relevance,
  type RunPageResponse,
  type RunsResponse,
} from '@cwd/shared';
import { fixture, reportFixtures } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { projectKey, runKey, sessionKey } from '../src/keys.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { labelInputs, saveBatch } from '../src/db/labels.ts';
import { runView, skillOutcomeLabel, storedSessionRoots } from '../src/views/runs.ts';
import { modelSums } from '../src/views/models.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');

// report-full's runs, oldest first (see the fixture map).
const [RATE_LIMITS, RETRY_BACKOFF, , PLAN, FULL] = fixture('report-full').runs.map(runKey) as string[];
// report-v5's schema 5 run, labelled by the workflow, on tidepool-api.
const WEBHOOKS = runKey(fixture('report-v5').runs[5]) as string;

let dir: string;
let db: Db;

/** A fresh database in the test's folder, holding the fixture's import, changed first by `change`. */
function dbWith(name: string, change: (raw: any) => void = () => {}): Db {
  const fresh = openDb(join(dir, name, 'dashboard.sqlite'));
  const raw = fixture(name);
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`fixture ${name} does not load`);
  importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  return fresh;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd runs '));
  db = dbWith('report-full');
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function get(path: string): Promise<Response> {
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
  return app.request(path, { headers: { Host: `localhost:${PORT}` } });
}

async function runs(query = ''): Promise<RunsResponse> {
  const res = await get(`/api/runs${query}`);
  expect(res.status).toBe(200);
  return res.json();
}

async function run(key: string): Promise<RunPageResponse> {
  const res = await get(`/api/runs/${encodeURIComponent(key)}`);
  expect(res.status).toBe(200);
  return res.json();
}

/** A step as "kind round agent", "-" for a missing round or agent, the same for a timeline step and a raw one. */
const stepId = (s: { step: string; round?: number | null; agent?: string | null }) =>
  `${s.step} ${s.round ?? '-'} ${s.agent ?? '-'}`;

/** Stores the app's label of a run's finding, for its current text, under report-v5's list (101): `conventions` and
 * `invalid` unless given. */
function label(key: string, findingId: string, reason: string, category = 'conventions', relevance: Relevance = 'invalid'): void {
  const input = labelInputs(listUnits(db, 'run')).find((i) => i.runKey === key && i.findingId === findingId)!;
  saveBatch(
    db,
    [{ ...input, model: 'claude-haiku-5-5', category, relevance, reason, labelledAt: NOW }],
    { at: NOW, inputTokens: 100, outputTokens: 20 },
    101,
  );
}

test('lists runs newest first', async () => {
  const list = await runs('?weeks=12');
  expect(list.runs.map((r) => r.finishedAt)).toEqual([
    '2026-11-10T16:45:00Z',
    '2026-11-08T09:30:00Z',
    '2026-11-03T10:40:00Z',
    '2026-10-21T11:10:00Z',
    '2026-10-06T15:20:00Z',
  ]);
  expect(list.runs[0]).toMatchObject({ key: FULL, project: 'lantern-notes', branch: 'feature/offline-sync' });
  expect(list.projects).toEqual([
    { key: projectKey('/Users/example/Work/lantern-notes'), name: 'lantern-notes' },
    { key: projectKey('/Users/example/Work/tidepool-api'), name: 'tidepool-api' },
  ]);
});

test('filters by path', async () => {
  expect((await runs('?weeks=12&path=full')).runs.map((r) => r.key)).toEqual([FULL, RETRY_BACKOFF, RATE_LIMITS]);
  expect((await runs('?weeks=12&path=plan')).runs.map((r) => r.key)).toEqual([PLAN]);
});

test('filters by project key', async () => {
  const list = await runs(`?weeks=12&project=${projectKey('/Users/example/Work/tidepool-api')}`);
  expect(list.runs.map((r) => r.key)).toEqual([RETRY_BACKOFF, RATE_LIMITS]);
  expect(list.projects.map((p) => p.name)).toEqual(['lantern-notes', 'tidepool-api']);
});

test('filters to runs with warnings', async () => {
  expect((await runs('?warnings=1')).runs.map((r) => r.key)).toEqual([FULL, RETRY_BACKOFF]);
});

test("a run's warnings are those in its latest warns", async () => {
  const W = 'WARN: feature/planner (2026-11-08): no session transcript found';
  const importPlanWarns = (warns: string[], at: Date) => {
    const raw = fixture('report-full');
    raw.runs[3].warns = warns;
    const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
    if (!loaded.ok) throw new Error('the changed fixture does not load');
    importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, at);
  };
  const feedTexts = async () => ((await (await get('/api/home')).json()) as HomeResponse).feed.map((f) => f.text);

  importPlanWarns([W], new Date('2026-11-12T13:00:00Z'));
  expect((await runs('?warnings=1')).runs.map((r) => r.key)).toContain(PLAN);
  expect((await run(PLAN)).warnings).toEqual([{ text: W, sessionId: null }]);
  expect(await feedTexts()).toContain(W);

  importPlanWarns([], new Date('2026-11-12T14:00:00Z'));
  expect((await runs('?warnings=1')).runs.map((r) => r.key)).not.toContain(PLAN);
  expect((await run(PLAN)).warnings).toEqual([]);
  expect(await feedTexts()).not.toContain(W);
});

test('keeps the last 4 weeks by default', async () => {
  // The week of 2026-11-12 starts on Sunday 2026-11-08 07:00 UTC; four weeks reach back to 2026-10-18 07:00 UTC.
  expect((await runs()).runs.map((r) => r.finishedAt)).toEqual([
    '2026-11-10T16:45:00Z',
    '2026-11-08T09:30:00Z',
    '2026-11-03T10:40:00Z',
    '2026-10-21T11:10:00Z',
  ]);
  expect((await runs('?weeks=1')).runs.map((r) => r.key)).toEqual([FULL, PLAN]);
});

test("the Full run's timeline has two wave groups holding their tasks", async () => {
  const { timeline } = await run(FULL);
  expect(timeline.map((g) => [g.kind, g.label])).toEqual([
    ['start', 'Start'],
    ['wave', 'Wave A'],
    ['wave', 'Wave B'],
    ['simplify', 'Simplify'],
    ['final', 'Final review'],
    ['end', 'End'],
  ]);
  const tasks = (i: number) =>
    timeline[i].tasks.map((t) => [t.task, t.steps.map(stepId)]);
  expect(tasks(1)).toEqual([
    [1, ['task_review 0 task-reviewer', 'fix_check 1 fix-checker']],
    [2, ['task_review 0 task-reviewer', 'fix_check 1 fix-checker']],
  ]);
  expect(tasks(2)).toEqual([
    [3, ['task_review 0 task-reviewer']],
    [4, ['task_review 0 task-reviewer']],
  ]);
  expect(timeline[1].tasks[0].steps[0]).toMatchObject({ counts: { critical: 0, important: 1, minor: 1 } });
  expect(timeline[1].tasks[0].steps[0].findings.map((f) => f.id)).toEqual(['F1', 'F2']);
  expect(timeline[3].steps.map((s) => s.step)).toEqual(['simplify']);
  expect(timeline[4].steps.map((s) => s.step)).toEqual(['final_review', 'final_fix_check']);
});

test("a kit's review and fix-check with no task or wave sit in the final review group", async () => {
  db.$client.close();
  db = dbWith('report-full', (raw) =>
    raw.runs[4].steps.push(
      { step: 'kit_review', round: 0, agent: 'kit-reviewer', counts: {}, findings: [] },
      { step: 'fix_check', kit: 'ui', round: 1, agent: 'kit-reviewer', counts: {}, findings: [] },
    ),
  );
  const { timeline } = await run(FULL);
  expect(timeline.find((g) => g.kind === 'final')!.steps.map((s) => s.step)).toEqual([
    'final_review',
    'final_fix_check',
    'kit_review',
    'fix_check',
  ]);
});

test("a step's model and effort are its dispatch's, else its own", async () => {
  const { timeline: full } = await run(FULL);
  // The Full run's steps are tied to no dispatch: the step's own alias.
  expect(full[1].tasks[0].steps[0]).toMatchObject({ step: 'task_review', model: 'opus', effort: 'high' });
  db.$client.close();
  db = dbWith('report-v7', (raw) => {
    // A tied dispatch whose model is null, as when its transcript is missing, leaves the step's own alias.
    raw.runs[5].dispatches.find((d: any) => d.step === 2).model = null;
  });
  const webhooks = runKey(fixture('report-v7').runs[5]) as string;
  const steps = (await run(webhooks)).timeline.flatMap((g) => [...g.steps, ...g.tasks.flatMap((t) => t.steps)]);
  const task1 = steps.filter((s) => s.step === 'task_review' || s.step === 'fix_check');
  expect(task1[0]).toMatchObject({ step: 'task_review', model: 'claude-opus-5-5', effort: 'high' });
  expect(task1[1]).toMatchObject({ step: 'fix_check', model: 'opus', effort: 'high' });
  expect(steps.find((s) => s.step === 'simplify')).toMatchObject({ model: null, effort: null });
});

test('a wave group carries its conflicts', async () => {
  expect((await run(FULL)).timeline.map((g) => g.conflicts)).toEqual([null, 0, 1, null, null, null]);
});

/** report-full with the Full run's waves A (tasks 1 and 2) and B (task 4), and `extra` waves after them. */
const regrouped = (...extra: { wave: string; tasks: number[] }[]) =>
  dbWith('report-full', (raw) => {
    raw.runs[4].waves = [{ wave: 'A', tasks: [1, 2] }, { wave: 'B', tasks: [4] }, ...extra];
  });

test("groups follow the run's order", async () => {
  db.$client.close();
  db = regrouped();
  expect((await run(FULL)).timeline.map((g) => g.label)).toEqual([
    'Start',
    'Wave A',
    'Task 3',
    'Wave B',
    'Simplify',
    'Final review',
    'End',
  ]);
});

test('a wave with no step comes after the groups that have one', async () => {
  db.$client.close();
  db = regrouped({ wave: 'C', tasks: [9] });
  expect((await run(FULL)).timeline.map((g) => g.label)).toEqual([
    'Start',
    'Wave A',
    'Task 3',
    'Wave B',
    'Wave C',
    'Simplify',
    'Final review',
    'End',
  ]);
});

test("a step naming a wave the record doesn't list gets that wave's group", async () => {
  db.$client.close();
  db = dbWith('report-full', (raw) =>
    raw.runs[4].steps.push({
      step: 'task_review',
      task: null,
      wave: 'C',
      round: 0,
      agent: 'task-reviewer',
      counts: { minor: 1 },
      findings: [{ id: 'F13', severity: 'minor', summary: 'An invented finding' }],
    }),
  );
  const { timeline, findings } = await run(FULL);
  const waveC = timeline.find((g) => g.label === 'Wave C')!;
  expect(waveC).toMatchObject({ kind: 'wave', tasks: [], conflicts: null });
  expect(waveC.steps.map((s) => s.findings.map((f) => f.id))).toEqual([['F13']]);
  const grouped = timeline.flatMap((g) => [...g.steps, ...g.tasks.flatMap((t) => t.steps)]).flatMap((s) => s.findings);
  for (const f of findings) expect(grouped.map((g) => g.id)).toContain(f.id);
});

test("a kit's step carries its kit", async () => {
  db.$client.close();
  db = dbWith('report-full', (raw) =>
    raw.runs[4].steps.push({ step: 'kit_review', kit: 'ui', task: 2, round: 0, agent: 'kit-reviewer', counts: {}, findings: [] }),
  );
  const task2 = (await run(FULL)).timeline[1].tasks.find((t) => t.task === 2)!;
  expect(task2.steps.find((s) => s.step === 'kit_review')).toMatchObject({ kit: 'ui', agent: 'kit-reviewer' });
});

test('a strength carries its wave', async () => {
  db.$client.close();
  db = dbWith('report-full', (raw) => {
    raw.runs[4].steps[4].strengths = [{ category: 'tests', summary: 'An invented strength' }];
  });
  expect((await run(FULL)).strengths).toEqual([
    { step: 'task_review', task: null, wave: 'A', round: 0, category: 'tests', summary: 'An invented strength' },
  ]);
});

// Every export fixture but report-shape, a deliberate shape failure, so a fixture that stops loading fails here. A
// step is its kind, round, agent, task and wave, so a dropped step and a doubled one can't cancel out, even across
// tasks: a shown step takes its task from its task row and its wave from its wave group's label ("Wave A").
test.each(reportFixtures().filter((name) => name !== 'report-shape'))(
  "every step of %s's runs sits in exactly one timeline group",
  async (name) => {
    db.$client.close();
    db = dbWith(name);
    type Placed = Parameters<typeof stepId>[0] & { task?: number | null; wave?: string | null };
    const placed = (s: Placed) => `${stepId(s)} task ${s.task ?? '-'} wave ${s.wave ?? '-'}`;
    for (const entry of fixture(name).runs) {
      const { timeline } = await run(runKey(entry) as string);
      const shown = timeline.flatMap((g) => [
        ...g.steps.map((s) => placed({ ...s, wave: g.kind === 'wave' ? g.label.replace(/^Wave /, '') : null })),
        ...g.tasks.flatMap((t) => t.steps.map((s) => placed({ ...s, task: t.task }))),
      ]);
      expect(shown.sort()).toEqual((entry.steps ?? []).map(placed).sort());
    }
  },
);

test('a wave check sits in its wave', async () => {
  const { timeline } = await run(FULL);
  const [, waveA, waveB] = timeline;
  expect(waveA.steps.map((s) => `${s.step} ${s.round}`)).toEqual([
    'task_review 0',
    'fix_check 1',
    'fix_check 2',
    'fix_check 3',
  ]);
  expect(waveA.steps[0].findings.map((f) => f.id)).toEqual(['F4']);
  expect(waveB.steps.map((s) => `${s.step} ${s.round}`)).toEqual(['task_review 0']);
});

test('start and end carry the run\'s times and other groups none', async () => {
  const { timeline } = await run(FULL);
  expect(timeline.map((g) => g.at)).toEqual([
    '2026-11-10T09:05:00Z',
    null,
    null,
    null,
    null,
    '2026-11-10T16:45:00Z',
  ]);
  for (const group of [timeline[0], timeline.at(-1)!]) expect([group.tasks, group.steps]).toEqual([[], []]);
});

test("the findings table flattens every step's findings", async () => {
  const { findings } = await run(FULL);
  expect(findings.map((f) => f.id)).toEqual(['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);
  expect(findings[3]).toEqual({
    id: 'F4',
    step: 'task_review',
    task: null,
    wave: 'A',
    round: 0,
    closedRound: 3,
    severity: 'important',
    kind: null,
    summary: 'Both tasks write the same cache key',
    outcome: 'ruled',
    reason: 'The shared key is intended: both tasks read the same snapshot',
    verdicts: ['open', 'open', 'open'],
    category: null,
    validity: null,
    judge: null,
    relevance: null,
    labelReason: null,
    appCategory: null,
    appRelevance: null,
  });
  expect(findings[0]).toMatchObject({ step: 'task_review', task: 1, wave: null, outcome: 'fixed', closedRound: 1 });
  expect(findings[5]).toMatchObject({ id: 'F6', task: 4, outcome: null });
  expect(findings[9]).toMatchObject({ id: 'F10', step: 'final_review', task: null });
});

test("a labelled finding carries the app's category, relevance and reason, an unlabelled one nulls", async () => {
  // report-v5 holds the same Full run, with the workflow's category list.
  db.$client.close();
  db = dbWith('report-v5');
  label(FULL, 'F4', 'An invented reason for the label.');
  const { findings, timeline, categoryLabels } = await run(FULL);
  expect(categoryLabels.conventions).toBe('Conventions');
  expect(findings[3]).toMatchObject({
    id: 'F4',
    reason: 'The shared key is intended: both tasks read the same snapshot',
    category: 'conventions',
    relevance: 'invalid',
    labelReason: 'An invented reason for the label.',
  });
  expect(timeline[1].steps[0].findings[0]).toMatchObject({ id: 'F4', category: 'conventions' });
  expect(findings[0]).toMatchObject({ id: 'F1', category: null, relevance: null, labelReason: null });
});

test("the workflow's labels win: its category and validity, the app's label kept where it differs", async () => {
  db.$client.close();
  db = dbWith('report-v5');
  label(WEBHOOKS, 'F3', 'An invented reason for the label.');
  label(WEBHOOKS, 'F4', 'Another invented reason.', 'naming', 'valid');
  label(WEBHOOKS, 'F5', 'A third invented reason.', 'reuse', 'valid');
  const { findings } = await run(WEBHOOKS);
  const byId = new Map(findings.map((f) => [f.id, f]));
  // The workflow's error_handling and valid; the app's conventions and invalid differ, so both are kept.
  expect(byId.get('F3')).toMatchObject({
    judge: 'workflow',
    category: 'error_handling',
    validity: 'valid',
    relevance: 'invalid',
    labelReason: 'An invented reason for the label.',
    appCategory: 'conventions',
    appRelevance: 'invalid',
  });
  // Cleaned to nulls by the workflow: the app's label shows.
  expect(byId.get('F4')).toMatchObject({
    judge: 'app',
    category: 'naming',
    validity: null,
    relevance: 'valid',
    appCategory: null,
    appRelevance: null,
  });
  // The app agrees with the workflow.
  expect(byId.get('F5')).toMatchObject({ judge: 'workflow', category: 'reuse', relevance: 'valid', appCategory: null, appRelevance: null });
  // The workflow's label with no app label, and neither.
  expect(byId.get('F7')).toMatchObject({ judge: 'workflow', category: 'docs', validity: 'unclear', relevance: null, appCategory: null });
  expect(byId.get('F2')).toMatchObject({ judge: null, category: null, validity: null, relevance: null });
});

test("a workflow category with no validity keeps the app's call as the only call", async () => {
  db.$client.close();
  // The workflow labels F3 error_handling but leaves its validity unset.
  db = dbWith('report-v5', (raw) => (raw.runs[5].steps[1].findings[0].validity = null));
  label(WEBHOOKS, 'F3', 'An invented reason for the label.', 'error_handling', 'invalid');
  const f3 = (await run(WEBHOOKS)).findings.find((f) => f.id === 'F3');
  // The app's call doesn't differ from a call the workflow didn't make: it stays the app's relevance alone.
  expect(f3).toMatchObject({
    judge: 'workflow',
    category: 'error_handling',
    validity: null,
    relevance: 'invalid',
    appCategory: null,
    appRelevance: null,
  });
});

test("a run's strengths list each review step's, with its step, task and round", async () => {
  db.$client.close();
  db = dbWith('report-v5');
  expect((await run(WEBHOOKS)).strengths).toEqual([
    { step: 'task_review', task: 1, wave: null, round: 0, category: 'tests', summary: 'Each retry delay has its own test' },
    { step: 'final_review', task: null, wave: null, round: 0, category: 'security_privacy', summary: 'The signing secret never reaches a log' },
  ]);
  expect((await run(FULL)).strengths).toEqual([]);
});

test("with showing on, the run page holds no hidden project's name, path or branch, its strengths' and kit steps' included", async () => {
  const raw = fixture('report-v5');
  const branches = new Map<string, string[]>();
  for (const r of raw.runs) {
    const root = projectRoot(r.record.project);
    branches.set(root, [...(branches.get(root) ?? []), r.record.branch]);
  }
  const TIDEPOOL = '/Users/example/Work/tidepool-api';
  const sessionRoots = storedSessionRoots(listUnits(db, 'session'));
  const strings = forbiddenStrings([...branches.keys()], branches, [TIDEPOOL], [], sessionRoots);
  expect(strings.forbidden).toContain('lantern-notes');
  db.$client.close();
  db = dbWith('report-v5', (raw) => {
    // A strength that names the hidden lantern-notes, its branch and a path in it.
    raw.runs[5].steps[1].strengths[0].summary =
      'As lantern-notes does on feature/offline-sync in /Users/example/Work/lantern-notes/src/retry.ts';
    // A kit's step whose kit, agent and tied dispatch's model name the hidden lantern-notes.
    const index = raw.runs[5].steps.push({
      step: 'kit_review', kit: 'lantern-notes', task: 2, round: 0, agent: 'lantern-notes', counts: {}, findings: [],
    }) - 1;
    raw.runs[5].dispatches.push({ agent: 'kit-reviewer', model: 'lantern-notes', effort: 'high', step: index });
  });
  setShowing(db, [projectKey(TIDEPOOL)]);
  const body = await run(WEBHOOKS);
  expect(body.strengths[0].summary).toBe('As another project does on another branch in retry.ts');
  const kitStep = body.timeline.flatMap((g) => g.tasks.flatMap((t) => t.steps)).find((s) => s.step === 'kit_review');
  expect(kitStep).toMatchObject({ kit: 'another project', agent: 'another project', model: 'another project' });
  expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
});

describe("the run's surroundings", () => {
  // report-v7's runs: the Plan and Full feature/offline-sync runs on lantern-notes, feature/webhooks on tidepool-api,
  // and a small run whose transcript no stored session has.
  const v7 = fixture('report-v7');
  const [, , , PLAN_V7, FULL_V7, WEBHOOKS_V7, UNHELD] = v7.runs.map(runKey) as string[];
  const TIDEPOOL = '/Users/example/Work/tidepool-api';
  const LANTERN = '/Users/example/Work/lantern-notes';

  beforeEach(() => {
    db.$client.close();
    db = dbWith('report-v7');
  });

  test('names the session whose file is the run\'s transcript, with no session ID under a scope', async () => {
    expect((await run(WEBHOOKS_V7)).session).toEqual({
      title: 'Offline sync plan',
      sessionId: '5a9d3f12-6e8b-4c7a-9f2d-3b1e0c8a4d56',
    });
    setShowing(db, [projectKey(TIDEPOOL), projectKey(LANTERN)]);
    expect((await run(WEBHOOKS_V7)).session).toEqual({ title: 'Offline sync plan', sessionId: null });
  });

  test("the session is null when it isn't shown or isn't stored", async () => {
    expect((await run(UNHELD)).session).toBeNull();
    // The webhooks run's session is lantern-notes'.
    setShowing(db, [projectKey(TIDEPOOL)]);
    expect((await run(WEBHOOKS_V7)).session).toBeNull();
  });

  test('handoffTo is null on every fixture as exported', async () => {
    for (const name of reportFixtures().filter((n) => n !== 'report-shape')) {
      db.$client.close();
      db = dbWith(name);
      for (const entry of fixture(name).runs) expect((await run(runKey(entry) as string)).handoffTo).toBeNull();
    }
  });

  test('handoffTo names the stored session whose key is the handoff_to, null when its project is hidden', async () => {
    db.$client.close();
    db = dbWith('report-v7', (raw) => (raw.runs[5].context.handoff_to = sessionKey(raw.sessions[3])));
    expect((await run(WEBHOOKS_V7)).handoffTo).toEqual({
      title: "Port lantern-notes' sync to tidepool-api",
      sessionId: '2e8d5b13-9c4f-4a7e-b6d1-8f0a3c5e9b72',
    });
    db.$client.close();
    db = dbWith('report-v7', (raw) => (raw.runs[5].context.handoff_to = sessionKey(raw.sessions[1])));
    setShowing(db, [projectKey(TIDEPOOL)]);
    expect((await run(WEBHOOKS_V7)).handoffTo).toBeNull();
  });

  test("related lists the other runs of the run's project and branch", async () => {
    expect((await run(FULL_V7)).related).toEqual([{ key: PLAN_V7, path: 'plan', finishedAt: '2026-11-08T09:30:00Z' }]);
    expect((await run(WEBHOOKS_V7)).related).toEqual([]);
  });

  test('related comes in the order the runs finished', async () => {
    let keys: string[] = [];
    db.$client.close();
    db = dbWith('report-v7', (raw) => {
      // The first three runs and the webhooks run join feature/offline-sync on lantern-notes.
      for (const i of [0, 1, 2, 5]) Object.assign(raw.runs[i].record, { project: LANTERN, branch: 'feature/offline-sync' });
      keys = raw.runs.map(runKey) as string[];
    });
    expect((await run(keys[4])).related.map((r) => r.key)).toEqual([keys[0], keys[1], keys[2], keys[3], keys[5]]);
  });

  test('a run with no branch has no related run, though another run of its project has none either', async () => {
    let keys: string[] = [];
    db.$client.close();
    db = dbWith('report-v7', (raw) => {
      // The small chore run and the last small run, both lantern-notes', lose their branches.
      raw.runs[2].record.branch = null;
      raw.runs[6].record.branch = null;
      keys = raw.runs.map(runKey) as string[];
    });
    expect((await run(keys[2])).related).toEqual([]);
  });

  test("lists the run's offers", async () => {
    expect((await run(WEBHOOKS_V7)).offers).toEqual([
      { skill: 'graphify', outcome: 'accepted' },
      { skill: 'session-summary', outcome: 'skipped' },
    ]);
    expect((await run(FULL_V7)).offers).toEqual([]);
  });

  test('lists later fixes with no sha', async () => {
    const body = await run(FULL_V7);
    expect(body.laterFixes).toEqual([{ date: '2026-11-11T14:02:33+01:00', subject: 'fix: conflict banner loses focus after retry' }]);
    expect(JSON.stringify(body)).not.toContain('"sha"');
    expect(JSON.stringify(body)).not.toContain('9c4e1a7');
  });

  test("agents are modelSums' rows for the run", async () => {
    const entry = listUnits(db, 'run').find((u) => u.key === WEBHOOKS_V7)!.merged;
    const expected = Object.entries(modelSums([entry]).agents)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, row]) => ({ name, actual: row.actual }));
    expect(expected.length).toBeGreaterThan(1);
    expect((await run(WEBHOOKS_V7)).agents).toEqual(expected);
  });

  test("main and phases are the run's main session and each phase's cost", async () => {
    const body = await run(FULL_V7);
    expect(body.main).toEqual({ model: 'claude-opus-5-5', effort: 'medium' });
    expect(body.phases[0]).toEqual({ name: 'design', cost: 1.6 });
    expect(body.phases).toEqual(v7.runs[4].phases.map((p: any) => ({ name: p.name, cost: modelsCost(p.models) })));
  });

  test("with showing on, the run's surroundings hold no hidden project's name", async () => {
    db.$client.close();
    db = dbWith('report-v7', (raw) => {
      const r = raw.runs[5];
      // Two agents that mask alike, and a dispatch's model and effort, naming the hidden lantern-notes.
      Object.assign(r.dispatches[0], { agent: 'lantern-notes', model: 'lantern-notes', effort: 'lantern-notes' });
      r.dispatches[2].agent = 'LANTERN-NOTES';
      r.main.model = 'lantern-notes';
      r.offers[0].skill = 'lantern-notes';
      r.later_fixes = [{ sha: '1a2b3c4', date: '2026-11-13T10:00:00Z', subject: 'fix: as lantern-notes does on feature/offline-sync' }];
      r.phases.push({ name: 'lantern-notes', models: { 'claude-opus-5-5': { cost: 0.1 } } });
      // The run's session is tidepool-api's, titled after lantern-notes, and it hands off to another such session.
      r.window.transcript = raw.sessions[3].file;
      Object.assign(raw.sessions[4], { project: TIDEPOOL, title: 'Handed on from lantern-notes' });
      r.context.handoff_to = sessionKey(raw.sessions[4]);
    });
    const branches = new Map<string, string[]>();
    for (const r of v7.runs) {
      const root = projectRoot(r.record.project);
      branches.set(root, [...(branches.get(root) ?? []), r.record.branch]);
    }
    const sessionRoots = storedSessionRoots(listUnits(db, 'session'));
    const strings = forbiddenStrings([...branches.keys()], branches, [TIDEPOOL], [], sessionRoots);
    expect(strings.forbidden).toContain('lantern-notes');
    setShowing(db, [projectKey(TIDEPOOL)]);
    const body = await run(WEBHOOKS_V7);
    expect(body.agents.filter((a) => a.name === 'another project')).toEqual([
      { name: 'another project', actual: { 'another project/another project': 1, 'claude-opus-5-5/high': 1 } },
    ]);
    expect(body.main).toEqual({ model: 'another project', effort: 'high' });
    expect(body.offers[0]).toEqual({ skill: 'another project', outcome: 'accepted' });
    expect(body.laterFixes[0].subject).toBe('fix: as another project does on another branch');
    expect(body.session).toEqual({ title: "Port another project' sync to tidepool-api", sessionId: null });
    expect(body.handoffTo).toEqual({ title: 'Handed on from another project', sessionId: null });
    expect(body.phases.at(-1)).toEqual({ name: 'another project', cost: 0.1 });
    expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
  });
});

test('a schema 1 run has empty groups and beforeSteps', async () => {
  const view = await run(RATE_LIMITS);
  expect(view.facts.beforeSteps).toBe(true);
  expect(view.timeline).toEqual([
    { kind: 'start', label: 'Start', at: '2026-10-06T13:05:00Z', conflicts: null, tasks: [], steps: [] },
    { kind: 'final', label: 'Final review', at: null, conflicts: null, tasks: [], steps: [] },
    { kind: 'end', label: 'End', at: '2026-10-06T15:20:00Z', conflicts: null, tasks: [], steps: [] },
  ]);
  expect(view.findings).toEqual([]);
  expect(view).toMatchObject({ skills: [], models: [], advisor: null, warnings: [] });
});

test('an unknown key is 404', async () => {
  expect((await get('/api/runs/0000000000000000')).status).toBe(404);
  expect((await get(`/api/runs/${encodeURIComponent('../a b/c')}`)).status).toBe(404);
});

test('lists the run\'s skills, models, advisor notes and warnings', async () => {
  const view = await run(FULL);
  expect(view.facts).toMatchObject({ key: FULL, path: 'full', waves: 2 });
  expect(view.skills).toEqual([
    { name: 'subagent-driven-development', outcome: 'ran' },
    { name: 'simplify', outcome: 'applied 2, skipped 1' },
  ]);
  expect(view.models).toEqual([
    { model: 'claude-opus-5-5', cost: 9.52 },
    { model: 'claude-fable-5-1', cost: 4.275 },
  ]);
  expect(view.advisor).toEqual({ calls: 5, notes: 5 });
  expect(view.warnings).toEqual([
    {
      text: 'WARN: feature/offline-sync (2026-11-10): record says simplify ran (agents) but the transcript has no simplify call',
      sessionId: null,
    },
  ]);
  expect((await run(PLAN)).models).toEqual([
    { model: 'claude-fable-6-preview', cost: null },
    { model: 'claude-sonnet-9-preview', cost: null },
  ]);
});

test('a skill\'s path outcome shows as "wrote a file"', async () => {
  expect((await run(PLAN)).skills).toEqual([
    { name: 'brainstorming', outcome: 'wrote a file' },
    { name: 'writing-plans', outcome: 'wrote a file' },
  ]);
  expect(skillOutcomeLabel('/Users/example/notes.md')).toBe('wrote a file');
  expect(skillOutcomeLabel('ran')).toBe('ran');
  expect(skillOutcomeLabel({ applied: 3, skipped: 0 })).toBe('applied 3, skipped 0');
  expect(skillOutcomeLabel(['a', 'b'])).toBe('2 results');
  expect(skillOutcomeLabel(true)).toBe('record written');
  expect(skillOutcomeLabel(false)).toBe('no record');
  expect(skillOutcomeLabel(null)).toBe('–');
  expect(skillOutcomeLabel(undefined)).toBe('–');
});

test("a warning's session ID comes as sessionId with {session} in the text", () => {
  // The reporter's run warnings carry no session file name, so this test makes one up.
  const stored = listUnits(db, 'run').find((u) => u.key === FULL)!;
  const text = 'WARN: feature/offline-sync (2026-11-10): 7c1d9e42-3a5b-4f6c-8d2e-1b0a9f8e7d6c.jsonl ended early';
  // A run's warnings are the texts in its latest warns; the other two are left out by run and by kind.
  stored.merged.warns = [text, 'WARN: another run', 'WARN: a session'];
  const view = runView(
    stored,
    [
      { kind: 'run', key: FULL, text, firstSeenAt: NOW, warningKind: null, stepKind: null },
      { kind: 'run', key: PLAN, text: 'WARN: another run', firstSeenAt: NOW, warningKind: null, stepKind: null },
      { kind: 'session', key: FULL, text: 'WARN: a session', firstSeenAt: NOW, warningKind: null, stepKind: null },
    ],
    new Map(),
    null,
    new Map(),
    null,
  );
  expect(view!.warnings).toEqual([
    { text: 'WARN: feature/offline-sync (2026-11-10): {session} ended early', sessionId: '7c1d9e42-3a5b-4f6c-8d2e-1b0a9f8e7d6c' },
  ]);
});

test("no response holds a transcript path, a project path or the fixture's spec path", async () => {
  const list = await runs('?weeks=12');
  const bodies = [JSON.stringify(list)];
  for (const row of list.runs) bodies.push(JSON.stringify(await run(row.key)));
  for (const body of bodies) {
    expect(body).not.toContain('.jsonl');
    expect(body).not.toContain('/Users/');
    expect(body).not.toContain('/Work/');
    expect(body).not.toContain('offline-sync-design.md');
    expect(body).not.toContain('docs/superpowers');
  }
});

describe('projects', () => {
  // report-projects' runs, oldest first: Archive lantern-notes, tidepool-api, Work lantern-notes, its worktree.
  const [, , MAIN, WORKTREE] = fixture('report-projects').runs.map(runKey) as string[];
  const LANTERN = projectKey('/Users/example/Work/lantern-notes');

  beforeEach(() => {
    db.$client.close();
    db = dbWith('report-projects');
  });

  test("a worktree's run has its main root's project key", async () => {
    const row = (await runs('?weeks=52')).runs.find((r) => r.key === WORKTREE)!;
    expect(row.projectKey).toBe(LANTERN);
  });

  test("filters by project key: the root's runs and its worktree's", async () => {
    const list = await runs(`?project=${LANTERN}&weeks=52`);
    expect(list.runs.map((r) => r.key)).toEqual([WORKTREE, MAIN]);
  });

  test("the run page names the project as the Runs list does", async () => {
    const row = (await runs('?weeks=52')).runs.find((r) => r.key === MAIN)!;
    expect(row.project).toBe('lantern-notes (Work)');
    expect((await run(MAIN)).facts.project).toBe(row.project);
  });

  test('lists each project once, by key, with distinct names', async () => {
    const { projects } = await runs('?weeks=52');
    expect(projects).toHaveLength(3);
    expect(new Set(projects.map((p) => p.name)).size).toBe(3);
    expect(projects).toContainEqual({ key: LANTERN, name: 'lantern-notes (Work)' });
  });

  test("with showing on, a label's reason is masked as the finding's text is", async () => {
    // report-v5 holds the same run and projects, with the workflow's category list.
    db.$client.close();
    db = dbWith('report-v5');
    label(MAIN, 'F1', 'tidepool-api keeps the same import in /Users/example/Work/tidepool-api/src/x.ts');
    setShowing(db, [LANTERN]);
    expect((await run(MAIN)).findings[0].labelReason).toBe('another project keeps the same import in x.ts');
  });
});

test("a run's context holds its calls, tool results and sweeps, null without a window", async () => {
  db.$client.close();
  db = dbWith('report-v7');
  const [rateLimits, , , , offlineSync] = fixture('report-v7').runs.map(runKey) as string[];
  expect((await run(offlineSync!)).context).toEqual({
    calls: 318,
    medianTokens: 231800,
    maxTokens: 412600,
    callsOverCap: 87,
    handoff: null,
    toolCharacters: 1334800,
    readShare: (624800 / 1334800) * 100,
    sweeps: { inline: 2, delegated: 3 },
  });
  expect((await run(rateLimits!)).context).toBeNull();
});
