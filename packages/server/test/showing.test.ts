import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test } from 'vitest';
import {
  loadReport,
  projectRoot,
  sessionRootOf,
  type HomeResponse,
  type RunFacts,
  type RunsResponse,
  type ShowingResponse,
} from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport, recordImportFailure } from '../src/db/import.ts';
import { getShowing, setSeenAt, setShowing } from '../src/db/read.ts';
import { projectKey, runKey } from '../src/keys.ts';
import { forbiddenStrings, leaks, maskText, scopeOf, showFacts } from '../src/views/scope.ts';

const PORT = 4317;
const HOST = `localhost:${PORT}`;
const NOW = new Date('2026-11-12T12:00:00Z');

// report-projects' roots: the shown one (Work lantern-notes, with its worktree's run), and two hidden ones.
const WORK = '/Users/example/Work/lantern-notes';
const ARCHIVE = '/Users/example/Archive/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';
const ROOTS = [ARCHIVE, TIDEPOOL, WORK];
const RAW = fixture('report-projects');
const TIDEPOOL_RUN = runKey(RAW.runs[1])!;

// The fixture's branches by root, and every session ID it holds (session files and run warnings).
const BRANCHES = new Map<string, string[]>();
for (const run of RAW.runs) {
  const root = projectRoot(run.record.project);
  BRANCHES.set(root, [...(BRANCHES.get(root) ?? []), run.record.branch]);
}
const SESSION_IDS = [
  ...new Set(JSON.stringify(RAW).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)),
];
const SESSION_ROOTS: string[] = RAW.sessions.flatMap((s: any) => sessionRootOf(s.project) ?? []);
const STRINGS = forbiddenStrings(ROOTS, BRANCHES, [WORK], SESSION_IDS, SESSION_ROOTS);
const FORBIDDEN = [...STRINGS.forbidden, '/Users/example'];

let dir: string;
let file: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd showing '));
  file = join(dir, 'dashboard.sqlite');
  db = openDb(file);
  const raw = fixture('report-projects');
  // A shown run whose finding and warning name the hidden tidepool-api, its path and branch, and a session.
  const shown = raw.runs[2];
  shown.steps[0].findings[0].summary +=
    ' (as tidepool-api does on fix/retry-backoff in /Users/example/Work/tidepool-api/src/retry.ts,' +
    ' session 0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35)';
  shown.warns = ['WARN: chore/tidy-imports (2026-11-03): 0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35.jsonl ended early'];
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('report-projects does not load');
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  setShowing(db, [projectKey(WORK)]);
  // Everything was seen before the import, so the home feed holds every run and warning.
  setSeenAt(db, new Date('2026-01-01T00:00:00Z'));
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

function app() {
  return createApp({
    db,
    port: PORT,
    requestImport: () => {},
    importing: () => false,
    webDist: null,
    now: () => NOW,
    aliases: { [WORK]: 'Notes app' },
    labeller: null,
  });
}

async function get<T>(path: string): Promise<T> {
  const res = await app().request(path, { headers: { Host: HOST } });
  expect(res.status).toBe(200);
  return res.json();
}

async function post(projects: string[]): Promise<Response> {
  return app().request('/api/showing', {
    method: 'POST',
    headers: { Host: HOST, 'X-Dashboard-Refresh': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects }),
  });
}

test('the leak check looks for the hidden names, branches and session IDs, not the shown ones', () => {
  expect(FORBIDDEN).toEqual(
    expect.arrayContaining([TIDEPOOL, 'tidepool-api', 'fix/retry-backoff', ARCHIVE, 'feature/tag-search']),
  );
  expect(FORBIDDEN).toContain('0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35');
  expect(FORBIDDEN).not.toContain('lantern-notes');
  expect(FORBIDDEN).not.toContain('feature/offline-sync');
  // Each named by its kinds, for check:real's lines: Archive and Work lantern-notes share a folder name, so only the
  // Archive root is forbidden of the two.
  expect(STRINGS.kinds.get(TIDEPOOL)).toEqual(['project path']);
  expect(STRINGS.kinds.get('tidepool-api')).toEqual(['project folder name']);
  expect(STRINGS.kinds.get('fix/retry-backoff')).toEqual(['branch']);
  expect(STRINGS.kinds.get('0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35')).toEqual(['session ID']);
  expect([...STRINGS.kinds.keys()]).toEqual(STRINGS.forbidden);
});

test("with showing on, no response holds a path, a session ID or a hidden project's name or branch", async () => {
  recordImportFailure(
    db,
    'reporter failed: /Users/example/Work/tidepool-api/x.py: 0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35.jsonl unreadable' +
      " in '/Users/example/.claude/projects/-Users-example-Work-tidepool-api'",
    NOW,
  );
  const list = await get<RunsResponse>('/api/runs?weeks=52');
  const bodies: unknown[] = [list, await get('/api/home'), await get('/api/showing'), await get('/api/status')];
  bodies.push(await get('/api/findings?weeks=52'));
  for (const row of list.runs) bodies.push(await get(`/api/runs/${row.key}`));
  expect(list.runs).toHaveLength(2);
  for (const body of bodies) expect(leaks(body, FORBIDDEN, STRINGS.shown)).toEqual([]);
});

test('the Runs list counts the hidden runs and names the shown ones by alias', async () => {
  const list = await get<RunsResponse>('/api/runs?weeks=52');
  expect(list.hidden).toBe(2);
  expect(list.runs.map((r) => r.project)).toEqual(['Notes app', 'Notes app']);
  expect(list.projects).toEqual([{ key: projectKey(WORK), name: 'Notes app' }]);
});

test("a hidden run's page is a 404", async () => {
  const res = await app().request(`/api/runs/${TIDEPOOL_RUN}`, { headers: { Host: HOST } });
  expect(res.status).toBe(404);
});

test("maskText masks a hidden project's name and path inside a shown project's text", () => {
  const scope = scopeOf([projectKey(TIDEPOOL)], BRANCHES, {}, [])!;
  const summary: string = RAW.runs[1].steps[2].findings[0].summary;
  expect(summary).toContain('lantern-notes');
  const masked = maskText(scope, summary);
  expect(masked).toContain('another project');
  expect(masked).not.toContain('/Users/');
  expect(masked).not.toContain('lantern-notes');
});

test('maskText replaces only whole words', () => {
  const scope = { shown: new Set<string>(), names: new Map<string, string>(), kept: [], hidden: ['api'], branches: [] };
  expect(maskText(scope, 'rapid api')).toBe('rapid another project');
  expect(maskText(scope, 'rapid-api')).toBe('rapid-another project');
});

test("maskText masks a hidden name that '-' joins to other words", () => {
  const scope = scopeOf([projectKey(WORK)], BRANCHES, {}, [])!;
  expect(maskText(scope, 'bump tidepool-api-client to 2')).toBe('bump another project-client to 2');
  // A Claude Code transcript folder, as trimPaths leaves it.
  expect(maskText(scope, 'folder -Users-example-Work-tidepool-api')).toBe('folder -Users-example-Work-another project');
});

test('maskText turns a session file into "a session"', () => {
  const scope = scopeOf([projectKey(WORK)], BRANCHES, {}, [])!;
  expect(maskText(scope, 'WARN: 0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35.jsonl ended early')).toBe(
    'WARN: a session ended early',
  );
});

test("maskText masks a hidden run's branch and a bare session ID, not a shown run's branch", () => {
  const scope = scopeOf([projectKey(WORK)], BRANCHES, {}, [])!;
  expect(
    maskText(scope, 'as on fix/retry-backoff and chore/tidy-imports, see 0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35'),
  ).toBe('as on another branch and chore/tidy-imports, see a session');
});

// Invented prefix-related roots: the hidden lantern, whose name is the start of the shown lantern-notes.
const LANTERN = '/Users/example/Work/lantern';
const PREFIX_BRANCHES = new Map([
  [LANTERN, ['fix/lamp-wick']],
  [WORK, ['feature/offline-sync']],
]);

test('maskText keeps a shown name that holds a hidden one, and masks the bare hidden one', () => {
  const scope = scopeOf([projectKey(WORK)], PREFIX_BRANCHES, {}, [])!;
  expect(maskText(scope, 'lantern-notes reads Lantern on fix/lamp-wick')).toBe(
    'lantern-notes reads another project on another branch',
  );
});

test('leaks skips a hidden name inside a shown one, and finds it alone', () => {
  const { forbidden, shown } = forbiddenStrings([LANTERN, WORK], PREFIX_BRANCHES, [WORK], [], []);
  expect(leaks({ project: 'lantern-notes' }, forbidden, shown)).toEqual([]);
  expect(leaks('see lantern', forbidden, shown)).toEqual(['lantern']);
  // A hidden string that holds a shown one is still found.
  expect(leaks('lantern-notes-v2', ['lantern-notes-v2'], shown)).toEqual(['lantern-notes-v2']);
});

test('leaks finds a hidden name holding a character JSON escapes, and names it as it is', () => {
  for (const name of ['x"y', 'x\\y', 'x\ty']) {
    expect(leaks({ a: `see ${name} here` }, [name], [])).toEqual([name]);
    expect(leaks({ a: `see ${name} here` }, [name], [], true)).toEqual([name]);
  }
  expect(leaks({ a: 'x"y-notes' }, ['x"y'], ['x"y-notes'])).toEqual([]);
});

test('leaks reads keys and strings as written: a name after an escape is a whole word, an escape is none', () => {
  expect(leaks({ a: 'line one\nlantern is hidden' }, ['lantern'], [], true)).toEqual(['lantern']);
  expect(leaks({ a: 'esc \u001b here' }, ['u001b'], [], true)).toEqual([]);
});

test('leaks finds a hidden name in any case, as maskText masks it, and names it as given', () => {
  expect(leaks({ a: 'see Tidepool-API here' }, ['tidepool-api'], [])).toEqual(['tidepool-api']);
  expect(leaks({ a: 'see LANTERN-notes' }, ['lantern'], ['lantern-notes'])).toEqual([]);
});

test("leaks' whole words: only the matches maskText's word rule would mask, a shown name still winning", () => {
  const { forbidden, shown } = forbiddenStrings([LANTERN, WORK], PREFIX_BRANCHES, [WORK], [], []);
  expect(leaks({ lanterns: 'see lantern' }, forbidden, shown)).toEqual(['lantern']);
  expect(leaks({ lanterns: 'see lantern' }, forbidden, shown, true)).toEqual(['lantern']);
  expect(leaks({ lanterns: 'lanternfish' }, forbidden, shown, true)).toEqual([]);
  expect(leaks({ project: 'lantern-notes' }, forbidden, shown, true)).toEqual([]);
});

test("showFacts masks a hidden project's name in a shown run's branch", () => {
  const scope = scopeOf([projectKey(WORK)], BRANCHES, {}, [])!;
  const facts = { projectKey: projectKey(WORK), project: 'lantern-notes', branch: 'fix/tidepool-api-client' };
  expect(showFacts(scope, facts as RunFacts)?.branch).toBe('fix/another project-client');
});

test('a folder name a shown project also has is not hidden', () => {
  const scope = scopeOf([projectKey(ARCHIVE)], BRANCHES, {}, [])!;
  expect(scope.hidden).not.toContain('lantern-notes');
  expect(scope.hidden).toContain('tidepool-api');
});

test("the home feed holds only the shown projects' runs, and no session warning", async () => {
  const { feed } = await get<HomeResponse>('/api/home');
  expect(feed.length).toBeGreaterThan(0);
  expect(feed.every((item) => item.project === 'Notes app' && item.sessionId === null)).toBe(true);
});

test('the home tiles and charts count every run, as with showing off', async () => {
  const on = await get<HomeResponse>('/api/home');
  setShowing(db, null);
  const off = await get<HomeResponse>('/api/home');
  expect({ thisWeek: on.thisWeek, lastWeek: on.lastWeek, charts: on.charts }).toEqual({
    thisWeek: off.thisWeek,
    lastWeek: off.lastWeek,
    charts: off.charts,
  });
});

test('GET /api/showing lists only the picked projects while on', async () => {
  expect(await get<ShowingResponse>('/api/showing')).toEqual({
    on: true,
    projects: [{ key: projectKey(WORK), name: 'Notes app', picked: true }],
  });
});

test('POST /api/showing with a key that is not stored answers 400 and changes nothing', async () => {
  expect((await post([projectKey(TIDEPOOL), 'ffffffffffffffff'])).status).toBe(400);
  expect(getShowing(db)).toEqual([projectKey(WORK)]);
});

test('POST /api/showing picks the given projects', async () => {
  expect((await post([projectKey(TIDEPOOL)])).ok).toBe(true);
  expect(getShowing(db)).toEqual([projectKey(TIDEPOOL)]);
});

test('showing mode survives reopening the database', () => {
  db.$client.close();
  db = openDb(file);
  expect(getShowing(db)).toEqual([projectKey(WORK)]);
});

test('an empty list turns showing off, and GET then lists every stored project', async () => {
  expect((await post([])).ok).toBe(true);
  expect(getShowing(db)).toBeNull();
  const showing = await get<ShowingResponse>('/api/showing');
  expect(showing.on).toBe(false);
  expect(showing.projects).toHaveLength(3);
  expect(showing.projects.every((p) => !p.picked)).toBe(true);
});

// report-v6: lantern-notes and tidepool-api runs, and sessions in lantern-notes (one in a worktree), tidepool-api, the
// Scratch lantern folder (no run's root, its name the start of the shown lantern-notes) and no project.
const V6 = fixture('report-v6');
const V6_BRANCHES = new Map<string, string[]>();
for (const run of V6.runs) {
  const root = projectRoot(run.record.project);
  V6_BRANCHES.set(root, [...(V6_BRANCHES.get(root) ?? []), run.record.branch]);
}
const V6_SESSION_ROOTS: string[] = V6.sessions.flatMap((s: any) => sessionRootOf(s.project) ?? []);

/** Replaces the test's database with report-v6's import, showing lantern-notes, everything seen before it. */
function useV6(): void {
  db.$client.close();
  db = openDb(join(dir, 'v6', 'dashboard.sqlite'));
  const loaded = loadReport(JSON.parse(JSON.stringify(V6)));
  if (!loaded.ok) throw new Error('report-v6 does not load');
  importReport(db, loaded.report, { runs: V6.runs, sessions: V6.sessions, totals: V6.totals }, NOW);
  setShowing(db, [projectKey(WORK)]);
  setSeenAt(db, new Date('2026-01-01T00:00:00Z'));
}

test("maskText masks a session root's folder name that no run has, and keeps the shown name holding it", () => {
  const scope = scopeOf([projectKey(WORK)], V6_BRANCHES, {}, V6_SESSION_ROOTS)!;
  expect(maskText(scope, 'lantern-notes copies lantern')).toBe('lantern-notes copies another project');
});

test('with report-v6 and showing on, home and compliance hold no hidden root, branch or session ID', async () => {
  useV6();
  const ids = [...new Set(JSON.stringify(V6).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g))];
  const strings = forbiddenStrings([...V6_BRANCHES.keys()], V6_BRANCHES, [WORK], ids, V6_SESSION_ROOTS);
  expect(strings.forbidden).toEqual(expect.arrayContaining(['/Users/example/Scratch/lantern', 'lantern']));
  const home = await get<HomeResponse>('/api/home');
  expect(home.feed.some((item) => item.type === 'warning' && item.runKey === null)).toBe(true);
  for (const body of [home, await get('/api/compliance?resolved=1&weeks=52')]) {
    expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
  }
});
