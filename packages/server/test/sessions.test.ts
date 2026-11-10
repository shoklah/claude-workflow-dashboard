import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadReport, projectRoot, type SessionRow, type SessionsResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, setShowing } from '../src/db/read.ts';
import { projectKey } from '../src/keys.ts';
import { storedSessionRoots } from '../src/views/runs.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';

const PORT = 4317;
const NOW = new Date('2026-11-12T12:00:00Z');

// report-v6: the lantern-notes transcript 5a9d3f12 holds the plan run and the tidepool-api feature/webhooks run.
const LANTERN = '/Users/example/Work/lantern-notes';
const TWO_RUNS = '5a9d3f12-6e8b-4c7a-9f2d-3b1e0c8a4d56';

let dir: string;
let db: Db;

/** A fresh database holding report-v6, changed first by `change`. */
function dbWith(change: (raw: any) => void = () => {}): Db {
  const fresh = openDb(join(dir, 'dashboard.sqlite'));
  const raw = fixture('report-v6');
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('report-v6 does not load');
  importReport(fresh, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  return fresh;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd sessions '));
  db = dbWith();
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

async function sessions(query = '?weeks=4', aliases: Record<string, string> = {}): Promise<SessionsResponse> {
  const app = createApp({
    db,
    port: PORT,
    requestImport: () => {},
    importing: () => false,
    webDist: null,
    now: () => NOW,
    aliases,
    labeller: null,
  });
  const res = await app.request(`/api/sessions${query}`, { headers: { Host: `localhost:${PORT}` } });
  expect(res.status).toBe(200);
  return res.json();
}

/** A stored session's key, by its transcript's session ID. */
const sessionKey = (id: string) => listUnits(db, 'session').find((s) => s.merged.file.includes(id))!.key;

/** A stored run's key, by its branch and path. */
const runKey = (branch: string, path: string) =>
  listUnits(db, 'run').find((r) => r.merged.record?.branch === branch && r.merged.record?.path === path)!.key;

const twoRuns = (body: SessionsResponse): SessionRow => body.sessions.find((s) => s.key === sessionKey(TWO_RUNS))!;

describe('with showing off', () => {
  test('the two-run session holds both runs, in window order, with its facts', async () => {
    const row = twoRuns(await sessions());
    expect(row.holds).toEqual([
      { runKey: runKey('feature/offline-sync', 'plan'), project: 'lantern-notes', branch: 'feature/offline-sync', path: 'plan' },
      { runKey: runKey('feature/webhooks', 'full'), project: 'tidepool-api', branch: 'feature/webhooks', path: 'full' },
    ]);
    expect(row).toMatchObject({
      title: 'Offline sync plan',
      sessionId: TWO_RUNS,
      projectKey: projectKey(LANTERN),
      project: 'lantern-notes',
      start: '2026-11-08T08:02:11.204Z',
      end: '2026-11-12T08:01:36.550Z',
      models: [{ model: 'claude-opus-5-5', effort: 'medium' }],
      cost: 0.24,
      startup: false,
      warnings: 1,
    });
    expect(row.minutes).toBeCloseTo(
      (Date.parse('2026-11-12T08:01:36.550Z') - Date.parse('2026-11-08T08:02:11.204Z')) / 60000,
    );
  });

  test('both /grill-me commands are never loaded, and /model is not', async () => {
    const commands = twoRuns(await sessions()).timeline.filter((t) => t.kind === 'command');
    expect(commands.map((c) => [c.name, c.neverLoaded])).toEqual([
      ['model', false],
      ['grill-me', true],
      ['grill-me', true],
    ]);
  });

  test("the timeline orders the skill, the commands and both runs' window starts", async () => {
    const { timeline } = twoRuns(await sessions());
    expect(timeline.map((t) => [t.at, t.kind, t.name, t.outcome, t.runKey])).toEqual([
      ['2026-11-08T08:02:40.120Z', 'command', 'model', null, null],
      ['2026-11-08T08:05:02.300Z', 'command', 'grill-me', null, null],
      ['2026-11-08T08:10:00Z', 'run', 'feature/offline-sync', null, runKey('feature/offline-sync', 'plan')],
      ['2026-11-12T02:36:05.410Z', 'skill', 'using-git-worktrees', 'ran', null],
      ['2026-11-12T02:40:00Z', 'run', 'feature/webhooks', null, runKey('feature/webhooks', 'full')],
      ['2026-11-12T02:45:10.000Z', 'command', 'grill-me', null, null],
    ]);
  });

  test('the period\'s sessions, newest start first; the one with no start is never listed', async () => {
    const body = await sessions('?weeks=52');
    expect(body.sessions.map((s) => s.title)).toEqual([
      'Offline sync build',
      "Port lantern-notes' sync to tidepool-api",
      'Offline sync plan',
      'Release checklist draft',
    ]);
    expect(body.hidden).toBe(0);
    // The Scratch session's root is no stored run's: "other project".
    expect(body.sessions.at(-1)).toMatchObject({ projectKey: null, project: null, holds: [] });
  });

  test('the project filter keeps its sessions, the path filter those holding a run of that path', async () => {
    const titles = async (query: string) => (await sessions(query)).sessions.map((s) => s.title);
    expect(await titles(`?weeks=4&project=${projectKey(LANTERN)}`)).toEqual(['Offline sync build', 'Offline sync plan']);
    expect(await titles('?weeks=4&path=plan')).toEqual(['Offline sync plan']);
    expect(await titles('?weeks=4&path=small')).toEqual([]);
  });

  test('"has warnings" keeps the sessions with a current warning', async () => {
    const body = await sessions('?weeks=4&warnings=1');
    expect(body.sessions.map((s) => s.title)).toEqual([
      "Port lantern-notes' sync to tidepool-api",
      'Offline sync plan',
      'Release checklist draft',
    ]);
  });
});

describe('with showing on lantern-notes', () => {
  test('only its sessions are listed, the hidden run left out, and hidden counts the others', async () => {
    setShowing(db, [projectKey(LANTERN)]);
    const body = await sessions();
    expect(body.sessions.map((s) => s.title)).toEqual(['Offline sync build', 'Offline sync plan']);
    // The tidepool-api and Scratch sessions; the one with no start is in no period.
    expect(body.hidden).toBe(2);
    const row = twoRuns(body);
    expect(row.holds.map((h) => h.runKey)).toEqual([runKey('feature/offline-sync', 'plan')]);
    expect(row.timeline.filter((t) => t.kind === 'run').map((t) => t.runKey)).toEqual([
      runKey('feature/offline-sync', 'plan'),
    ]);
    expect(body.sessions.map((s) => s.sessionId)).toEqual([null, null]);
  });

  test("a shown session is named by the scope, so the project's alias applies", async () => {
    setShowing(db, [projectKey(LANTERN)]);
    const body = await sessions('?weeks=4', { [LANTERN]: 'Lantern' });
    expect(body.sessions.map((s) => s.project)).toEqual(['Lantern', 'Lantern']);
    expect(twoRuns(body).holds.map((h) => h.project)).toEqual(['Lantern']);
  });

  test('names and titles are masked, and the response leaks nothing', async () => {
    db.$client.close();
    rmSync(dir, { recursive: true, force: true });
    dir = mkdtempSync(join(tmpdir(), 'cwd sessions '));
    const change = (raw: any) => {
      const session = raw.sessions.find((s: any) => s.file.includes(TWO_RUNS));
      session.title = 'Port tidepool-api webhooks to lantern';
      session.commands.push({ name: 'tidepool-api-deploy', time: '2026-11-08T08:06:00.000Z' });
      session.skills.push({ name: 'feature/webhooks-check', time: '2026-11-08T08:07:00.000Z', outcome: 'ran' });
    };
    db = dbWith(change);
    setShowing(db, [projectKey(LANTERN)]);
    const body = await sessions('?weeks=52');
    const row = twoRuns(body);
    expect(row.title).toBe('Port another project webhooks to another project');
    expect(row.timeline.map((t) => t.name)).toEqual(
      expect.arrayContaining(['another project-deploy', 'another branch-check']),
    );

    const raw = fixture('report-v6');
    change(raw);
    const branches = new Map<string, string[]>();
    for (const run of raw.runs) {
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
    expect(strings.forbidden).toEqual(expect.arrayContaining(['tidepool-api', 'lantern', 'feature/webhooks']));
    expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
  });
});
