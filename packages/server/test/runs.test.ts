import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadReport, type HomeResponse, type RunResponse, type RunsResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { projectKey, runKey } from '../src/keys.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { labelInputs, saveBatch } from '../src/db/labels.ts';
import { runView, skillOutcomeLabel } from '../src/views/runs.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');

// report-full's runs, oldest first (see the fixture map).
const [RATE_LIMITS, RETRY_BACKOFF, , PLAN, FULL] = fixture('report-full').runs.map(runKey) as string[];

let dir: string;
let db: Db;

/** A fresh database in the test's folder, holding the fixture's import. */
function dbWith(name: string): Db {
  const fresh = openDb(join(dir, name, 'dashboard.sqlite'));
  const raw = fixture(name);
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
  });
  return app.request(path, { headers: { Host: `localhost:${PORT}` } });
}

async function runs(query = ''): Promise<RunsResponse> {
  const res = await get(`/api/runs${query}`);
  expect(res.status).toBe(200);
  return res.json();
}

async function run(key: string): Promise<RunResponse> {
  const res = await get(`/api/runs/${encodeURIComponent(key)}`);
  expect(res.status).toBe(200);
  return res.json();
}

/** Stores the app's label of a run's finding, for its current text. */
function label(key: string, findingId: string, reason: string): void {
  const input = labelInputs(listUnits(db, 'run')).find((i) => i.runKey === key && i.findingId === findingId)!;
  saveBatch(
    db,
    [{ ...input, model: 'claude-haiku-5-5', category: 'conventions', relevance: 'invalid', reason, labelledAt: NOW }],
    { at: NOW, inputTokens: 100, outputTokens: 20 },
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
    timeline[i].tasks.map((t) => [t.task, t.steps.map((s) => `${s.step} ${s.round} ${s.agent}`)]);
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
    relevance: null,
    labelReason: null,
  });
  expect(findings[0]).toMatchObject({ step: 'task_review', task: 1, wave: null, outcome: 'fixed', closedRound: 1 });
  expect(findings[5]).toMatchObject({ id: 'F6', task: 4, outcome: null });
  expect(findings[9]).toMatchObject({ id: 'F10', step: 'final_review', task: null });
});

test("a labelled finding carries the app's category, relevance and reason, an unlabelled one nulls", async () => {
  label(FULL, 'F4', 'An invented reason for the label.');
  const { findings, timeline } = await run(FULL);
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

test('a schema 1 run has empty groups and beforeSteps', async () => {
  const view = await run(RATE_LIMITS);
  expect(view.facts.beforeSteps).toBe(true);
  expect(view.timeline).toEqual([
    { kind: 'start', label: 'Start', at: '2026-10-06T13:05:00Z', tasks: [], steps: [] },
    { kind: 'final', label: 'Final review', at: null, tasks: [], steps: [] },
    { kind: 'end', label: 'End', at: '2026-10-06T15:20:00Z', tasks: [], steps: [] },
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
      { kind: 'run', key: FULL, text, firstSeenAt: NOW },
      { kind: 'run', key: PLAN, text: 'WARN: another run', firstSeenAt: NOW },
      { kind: 'session', key: FULL, text: 'WARN: a session', firstSeenAt: NOW },
    ],
    new Map(),
    null,
    new Map(),
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
    label(MAIN, 'F1', 'tidepool-api keeps the same import in /Users/example/Work/tidepool-api/src/x.ts');
    setShowing(db, [LANTERN]);
    expect((await run(MAIN)).findings[0].labelReason).toBe('another project keeps the same import in x.ts');
  });
});
