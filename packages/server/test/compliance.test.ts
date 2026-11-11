import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { loadReport, projectRoot, type ComplianceResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, setSeenAt, setShowing } from '../src/db/read.ts';
import { projectKey } from '../src/keys.ts';
import { FAMILIES, familyOf } from '../src/views/compliance.ts';
import { storedSessionRoots } from '../src/views/runs.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');
// report-full's import, then report-v5's; the first sets seenAt.
const FIRST = new Date('2026-11-12T10:00:00Z');
const SECOND = new Date('2026-11-12T11:00:00Z');
const LANTERN = '/Users/example/Work/lantern-notes';

// The default period's weeks; the runs' warnings fall in the weeks of 2026-10-18, 2026-11-01 and 2026-11-08.
const WEEKS = ['2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'];

let dir: string;
let db: Db;

/** A fresh database in the test's folder, holding report-full's import, then report-v5's, changed first by `change`. */
function dbWith(name: string, change: (raw: any) => void = () => {}): Db {
  const fresh = openDb(join(dir, name, 'dashboard.sqlite'));
  const v5 = fixture('report-v5');
  change(v5);
  for (const [raw, at] of [[fixture('report-full'), FIRST], [v5, SECOND]] as const) {
    const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
    if (!loaded.ok) throw new Error('a fixture does not load');
    importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, at);
  }
  return fresh;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd compliance '));
  db = dbWith('plain');
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function compliance(query = ''): Promise<ComplianceResponse> {
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
  const res = await app.request(`/api/compliance${query}`, { headers: { Host: `localhost:${PORT}` } });
  expect(res.status).toBe(200);
  return res.json();
}

test('FAMILIES holds the five families and every kind once; familyOf gives other for an unknown or null kind', () => {
  expect(FAMILIES.map((f) => f.family)).toEqual(['review_flow', 'steps_record', 'agents_models', 'skills_offers', 'sessions']);
  const kinds = FAMILIES.flatMap((f) => f.kinds);
  expect(kinds).toHaveLength(31);
  expect(new Set(kinds).size).toBe(31);
  expect(familyOf('step_agent_missing')).toBe('steps_record');
  expect(familyOf('findings_unlabelled')).toBe('steps_record');
  expect(familyOf('strengths_unrecorded')).toBe('steps_record');
  expect(familyOf('startup_missing')).toBe('sessions');
  expect(familyOf('brand_new_check')).toBe('other');
  expect(familyOf(null)).toBe('other');
});

test('the current warnings sit by family and kind, in their runs\' weeks, with "other" last', async () => {
  const body = await compliance();
  expect(body.weeks).toEqual(WEEKS);
  expect(body.rows).toEqual([
    { family: 'review_flow', kind: 'simplify_record_differs', cells: [0, 0, 0, 1] },
    { family: 'steps_record', kind: 'no_transcript', cells: [1, 0, 1, 0] },
    { family: 'steps_record', kind: 'step_agent_missing', cells: [0, 0, 0, 1] },
    { family: 'other', kind: 'brand_new_check', cells: [0, 0, 0, 1] },
  ]);
  expect(body.hidden).toBe(0);
  expect(body.warnings.find((w) => w.kind === 'step_agent_missing')).toEqual({
    kind: 'step_agent_missing',
    family: 'steps_record',
    week: '2026-11-08',
    text: 'WARN: feature/webhooks (2026-11-12): final_review step 1 has no agent id',
    sessionId: null,
    runKey: expect.stringMatching(/^[0-9a-f]{16}$/),
    project: 'tidepool-api',
    branch: 'feature/webhooks',
    step: 'final_review',
    isNew: true,
  });
});

test('resolved adds the warning report-v5 no longer reports, with no object, under other in its first-seen week', async () => {
  expect((await compliance()).warnings.some((w) => w.sessionId !== null)).toBe(false);
  const body = await compliance('?resolved=1');
  expect(body.rows.at(-1)).toEqual({ family: 'other', kind: null, cells: [0, 0, 0, 1] });
  expect(body.warnings.find((w) => w.kind === null)).toEqual({
    kind: null,
    family: 'other',
    week: '2026-11-08',
    text: 'WARN: session {session}: startup guidelines missing',
    sessionId: '0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35',
    runKey: null,
    project: null,
    branch: null,
    step: null,
    isNew: false,
  });
});

test('resolved adds a run warning its run no longer reports', async () => {
  db.$client.close();
  db = dbWith('dropped', (raw) => {
    // The retry-backoff run's warning is gone from report-v5.
    raw.runs[1].warns = [];
    raw.runs[1].warnings = [];
  });
  expect((await compliance()).rows.find((r) => r.kind === 'no_transcript')?.cells).toEqual([0, 0, 1, 0]);
  const resolved = await compliance('?resolved=1');
  // Stored from report-full, before CR4, so with no kind.
  expect(resolved.rows.at(-1)).toEqual({ family: 'other', kind: null, cells: [1, 0, 0, 1] });
});

test('step filters to the warnings naming that step', async () => {
  const body = await compliance('?step=final_review');
  expect(body.rows).toEqual([{ family: 'steps_record', kind: 'step_agent_missing', cells: [0, 0, 0, 1] }]);
  expect(body.warnings.map((w) => w.kind)).toEqual(['step_agent_missing']);
  // A value that isn't a step kind filters nothing.
  expect((await compliance('?step=bogus')).rows).toHaveLength(4);
});

test('the period filters choose the runs', async () => {
  expect((await compliance('?path=small')).rows).toEqual([
    { family: 'steps_record', kind: 'no_transcript', cells: [0, 0, 1, 0] },
  ]);
  expect((await compliance(`?project=${projectKey(LANTERN)}`)).rows.map((r) => r.kind)).toEqual([
    'simplify_record_differs',
    'no_transcript',
  ]);
  expect((await compliance('?weeks=1')).weeks).toEqual(['2026-11-08']);
});

test('isNew follows seenAt', async () => {
  const isNew = (body: ComplianceResponse) => body.warnings.filter((w) => w.isNew).map((w) => w.kind).sort();
  // Report-v5's new warnings, first seen after report-full's import.
  expect(isNew(await compliance())).toEqual(['brand_new_check', 'no_transcript', 'step_agent_missing']);
  expect((await compliance()).newWarnings).toBe(3);
  setSeenAt(db, SECOND);
  expect(isNew(await compliance())).toEqual([]);
  expect((await compliance()).newWarnings).toBe(0);
});

test("with showing on, the grid counts all but \"other\" warnings, the list only shown runs', masked", async () => {
  const raw = fixture('report-v5');
  const branches = new Map<string, string[]>();
  for (const run of [...fixture('report-full').runs, ...raw.runs]) {
    const root = projectRoot(run.record.project);
    branches.set(root, [...(branches.get(root) ?? []), run.record.branch]);
  }
  const sessionIds = [
    ...new Set(
      JSON.stringify([fixture('report-full'), raw]).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g),
    ),
  ];
  const sessionRoots = storedSessionRoots(listUnits(db, 'session'));
  const strings = forbiddenStrings([...branches.keys()], branches, [LANTERN], sessionIds, sessionRoots);
  expect(strings.forbidden).toContain('feature/webhooks');
  expect(strings.forbidden).toContain('0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35');
  db.$client.close();
  db = dbWith('showing', (raw) => {
    // The shown tidy-imports run's no_transcript warning names the hidden project and one of its branches.
    raw.runs[2].warns[0] = 'WARN: chore/tidy-imports (2026-11-03): tidepool-api feature/webhooks looked odd';
    raw.runs[2].warnings[0] = { ...raw.runs[2].warnings[0], text: raw.runs[2].warns[0] };
    // The shown plan run gets a warning of a kind no family holds, which can name anything.
    const other = 'WARN: feature/offline-sync (2026-11-08): a check from a later reporter flagged this run';
    raw.runs[3].warns = [other];
    raw.runs[3].warnings = [{ text: other, kind: 'brand_new_check', step: null }];
  });
  setShowing(db, [projectKey(LANTERN)]);
  const body = await compliance('?resolved=1&weeks=52');
  // The "other" rows (unknown kinds, the null-kind row) are hidden; the family rows still count every warning.
  expect(body.rows.filter((row) => row.family === 'other')).toEqual([]);
  const count = body.rows.reduce((n, row) => n + row.cells.reduce((a, b) => a + b, 0), 0);
  // Seven warnings in the period, less the two brand_new_check ones and the resolved one with no kind.
  expect(count).toBe(4);
  // The shown runs' in-family warnings, masked; no session warning, no "other" one.
  expect(body.warnings.map((w) => ({ kind: w.kind, project: w.project, text: w.text }))).toEqual([
    {
      kind: 'simplify_record_differs',
      project: 'lantern-notes',
      text: 'WARN: feature/offline-sync (2026-11-10): record says simplify ran (agents) but the transcript has no simplify call',
    },
    {
      kind: 'no_transcript',
      project: 'lantern-notes',
      text: 'WARN: chore/tidy-imports (2026-11-03): another project another branch looked odd',
    },
  ]);
  // The hidden webhooks run's step_agent_missing and brand_new_check, the retry-backoff run's, the session's and the
  // plan run's "other" one.
  expect(body.warnings.some((w) => w.kind === 'step_agent_missing' || w.project === 'tidepool-api')).toBe(false);
  expect(body.rows.find((r) => r.kind === 'step_agent_missing')?.cells.at(-1)).toBe(1);
  expect(body.hidden).toBe(5);
  // The grid's new warnings, the hidden webhooks run's step_agent_missing included, the "other" ones not; the list
  // holds one of them.
  expect(body.newWarnings).toBe(2);
  expect(body.warnings.filter((w) => w.isNew)).toHaveLength(1);
  expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
});

/** Replaces the test's database with a fresh one holding only `name`'s import, changed first by `change`. */
function importOnly(name: string, change: (raw: any) => void = () => {}): void {
  db.$client.close();
  db = openDb(join(dir, name, 'dashboard.sqlite'));
  const raw = fixture(name);
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`${name} does not load`);
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, SECOND);
}

test("with showing on, the list holds the shown project's session warnings, masked; hidden counts the others", async () => {
  importOnly('report-v6');
  const off = await compliance('?resolved=1&weeks=52');
  setShowing(db, [projectKey(LANTERN)]);
  const body = await compliance('?resolved=1&weeks=52');
  // The lantern-notes session's warning, masked; not the tidepool-api, Scratch or no-project sessions'.
  expect(body.warnings.filter((w) => w.runKey === null)).toEqual([
    expect.objectContaining({
      kind: 'startup_missing',
      family: 'sessions',
      text: 'WARN: session a session: startup guidelines missing',
      sessionId: null,
    }),
  ]);
  expect(off.warnings.filter((w) => w.runKey === null)).toHaveLength(4);
  expect(body.hidden).toBe(off.warnings.length - body.warnings.length);
});

test("information is the latest export's health.info lines, from the reporter", async () => {
  importOnly('report-v7');
  expect((await compliance()).information).toEqual({
    lines: fixture('report-v7').totals.health.info,
    hidden: 0,
    source: 'reporter',
  });
});

test('information is null when the export has no health.info', async () => {
  importOnly('report-v6');
  expect((await compliance()).information).toBeNull();
});

test('information is null when the reporter writes no line, with and without a scope', async () => {
  importOnly('report-v7', (raw) => {
    raw.totals.health.info = [];
  });
  expect((await compliance()).information).toBeNull();
  setShowing(db, [projectKey(LANTERN)]);
  expect((await compliance()).information).toBeNull();
});

test('with showing on, the information lines are hidden and counted, and nothing leaks', async () => {
  importOnly('report-v7');
  const raw = fixture('report-v7');
  const branches = new Map<string, string[]>();
  for (const run of raw.runs) {
    const root = projectRoot(run.record.project);
    branches.set(root, [...(branches.get(root) ?? []), run.record.branch]);
  }
  const sessionIds = [
    ...new Set(JSON.stringify(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)),
  ];
  const sessionRoots = storedSessionRoots(listUnits(db, 'session'));
  const strings = forbiddenStrings([...branches.keys()], branches, [LANTERN], sessionIds, sessionRoots);
  expect(strings.forbidden).toContain('feature/webhooks');
  setShowing(db, [projectKey(LANTERN)]);
  const body = await compliance('?resolved=1&weeks=52');
  expect(body.information).toEqual({ lines: [], hidden: 3, source: 'reporter' });
  expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
});
