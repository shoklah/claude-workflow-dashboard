import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  loadReport,
  type ChangeResponse,
  type GoalResponse,
  type GraphEdge,
  type GraphNode,
  type RunEntry,
  type SessionEntry,
  type SessionGraphData,
  type SessionRow,
  type WorkResponse,
  type WorkSessionRow,
} from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, setShowing, type StoredUnit } from '../src/db/read.ts';
import { changeKey, goalKey, hash, projectKey } from '../src/keys.ts';
import { storedBranches, storedSessionRoots } from '../src/views/runs.ts';
import { forbiddenStrings, leaks, maskText, scopeOf } from '../src/views/scope.ts';
import { goalHomes, levels, stepOf } from '../src/views/work.ts';

const NOW = new Date('2026-11-12T12:00:00Z');
const LANTERN = '/Users/example/Work/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';
const OFFLINE_SPEC = { project: LANTERN, path: 'docs/superpowers/specs/2026-11-05-offline-sync-design.md' };
const OFFLINE_PLAN = 'docs/superpowers/plans/2026-11-08-offline-sync.md';
const SCRATCH = '/Users/example/Scratch/lantern';
const WEBHOOKS_SPEC = { project: TIDEPOOL, path: 'docs/superpowers/specs/2026-11-11-webhooks-design.md' };
const WEBHOOKS_PLAN = 'docs/superpowers/plans/2026-11-11-webhooks.md';

// report-work's units, by their stored keys.
const PLAN_RECORD = '51120289e82db399'; // offline sync's plan record, transcript 5a9d…
const OFFLINE_RUN = '97d6367dec7d9739'; // offline sync's full run, transcript 7d1e…
const WEBHOOKS_RUN = '2e10cc2ee4d14576'; // feature/webhooks, transcript 5a9d…
const TIDY_RUN = 'db2cf90d5739f4d0'; // chore/tidy-imports, no spec, no plan
const RATE_LIMITS_RUN = '7599a116b2739d9f'; // feature/rate-limits, no spec, no plan
const RETRY_RUN = '4ff383286fce4ac9'; // fix/retry-backoff, no spec, no plan, no goal
const IMG_RUN = 'd583c5133a67a663'; // the <img…> branch, no spec, no plan, no goal
const S_5A9D = '52e8f40878fa827a';
const S_7D1E = '60851c0c8aec995e';
const S_2E8D = 'e66de89cb5c23e32';
const S_6B1F = '233f23f883fa7c21';
const S_D4A7 = 'eb057721341ccc4a';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd work '));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

let count = 0;

/** A fixture's stored runs and sessions, imported into a fresh database after `change`. */
function unitsOf(
  name: string,
  change: (raw: any) => void = () => {},
): { runs: StoredUnit<RunEntry>[]; sessions: StoredUnit<SessionEntry>[] } {
  const db = openDb(join(dir, `dashboard-${count++}.sqlite`));
  const raw = fixture(name);
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`${name} does not load`);
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  return { runs: listUnits(db, 'run'), sessions: listUnits(db, 'session') };
}

function levelsOf(name: string, change?: (raw: any) => void) {
  const { runs, sessions } = unitsOf(name, change);
  return levels(runs, sessions);
}

const keysOf = (units: { key: string }[]) => units.map((u) => u.key).sort();
const runOf = (raw: any, key: string) => raw.runs.find((r: any) => r.key === key);
const sessionOf = (raw: any, key: string) => raw.sessions.find((s: any) => s.key === key);

describe('keys', () => {
  test('goalKey hashes the name', () => {
    expect(goalKey('Offline sync')).toBe(hash('Offline sync'));
  });

  test('changeKey takes the spec, else the plan, else the run key', () => {
    expect(changeKey(OFFLINE_SPEC, OFFLINE_PLAN, LANTERN, 'k')).toBe(hash(`spec|${LANTERN}|${OFFLINE_SPEC.path}`));
    expect(changeKey({ ...OFFLINE_SPEC, project: `${LANTERN}/.claude/worktrees/x` }, null, '', 'k')).toBe(
      hash(`spec|${LANTERN}|${OFFLINE_SPEC.path}`),
    );
    expect(changeKey(null, OFFLINE_PLAN, LANTERN, 'k')).toBe(hash(`plan|${LANTERN}|${OFFLINE_PLAN}`));
    expect(changeKey(null, null, LANTERN, 'k')).toBe('k');
  });
});

describe('levels', () => {
  test('the plan record and full run of one spec form one change, with its sessions', () => {
    const { changeOf } = levelsOf('report-work');
    const change = changeOf.get(OFFLINE_RUN)!;
    expect(change.key).toBe(changeKey(OFFLINE_SPEC, null, '', ''));
    expect(changeOf.get(PLAN_RECORD)).toBe(change);
    expect(keysOf(change.runs)).toEqual([PLAN_RECORD, OFFLINE_RUN].sort());
    expect(keysOf(change.sessions)).toEqual([S_7D1E, S_2E8D].sort());
    expect(change.roots).toEqual([LANTERN, TIDEPOOL]);
    expect(change.home).toBe(LANTERN);
    expect(change.path).toBe('full');
    expect(change.stage).toBe('implementation');
    expect(change.goal).toBe('Offline sync');
  });

  test("a session's worktree spec project keys the same change", () => {
    const { changeOf } = levelsOf('report-work');
    expect(changeOf.get(S_2E8D)).toBe(changeOf.get(OFFLINE_RUN));
  });

  test('a session sits in the change of its spec, not of the plan record it holds', () => {
    const { changeOf } = levelsOf('report-work');
    expect(changeOf.get(S_5A9D)).toBe(changeOf.get(WEBHOOKS_RUN));
    expect(changeOf.get(S_5A9D)).not.toBe(changeOf.get(PLAN_RECORD));
  });

  test('spec-less runs sharing a plan are one change; a run with neither is a change of its own', () => {
    const { changeOf } = levelsOf('report-v7');
    const shared = changeOf.get(OFFLINE_RUN)!;
    expect(shared.key).toBe(hash(`plan|${LANTERN}|${OFFLINE_PLAN}`));
    expect(keysOf(shared.runs)).toEqual([PLAN_RECORD, OFFLINE_RUN].sort());
    expect(changeOf.get(TIDY_RUN)!.key).toBe(TIDY_RUN);
    expect(keysOf(changeOf.get(TIDY_RUN)!.runs)).toEqual([TIDY_RUN]);
  });

  test('a spec-less session holding a plan record and a later run sits in the later run\'s change', () => {
    const { changeOf } = levelsOf('report-v7');
    expect(changeOf.get(S_5A9D)!.key).toBe(hash(`plan|${TIDEPOOL}|${WEBHOOKS_PLAN}`));
    expect(keysOf(changeOf.get(PLAN_RECORD)!.sessions)).not.toContain(S_5A9D);
  });

  test("a change's goal is its newest unit's that has one, for every unit of it", () => {
    const { changeOf, goalOf } = levelsOf('report-work', (raw) => {
      runOf(raw, OFFLINE_RUN).goal = null;
      sessionOf(raw, S_7D1E).goal = 'Offline queue';
      sessionOf(raw, S_2E8D).goal = 'Something else';
    });
    expect(changeOf.get(OFFLINE_RUN)!.goal).toBe('Offline queue');
    expect(goalOf(S_2E8D)).toBe('Offline queue');
    expect(goalOf(OFFLINE_RUN)).toBe('Offline queue');
  });

  test("a change's title: the newest plan record's headline, else the newest run's, else its spec's, else its branch", () => {
    expect(levelsOf('report-work').changeOf.get(OFFLINE_RUN)!.title).toBe('Plan the offline queue and replay');
    const noPlanHeadline = levelsOf('report-work', (raw) => {
      runOf(raw, PLAN_RECORD).headline = null;
    });
    expect(noPlanHeadline.changeOf.get(OFFLINE_RUN)!.title).toBe('Queue edits offline and replay them on reconnect');
    const noHeadline = levelsOf('report-work', (raw) => {
      runOf(raw, PLAN_RECORD).headline = null;
      runOf(raw, OFFLINE_RUN).headline = null;
    });
    expect(noHeadline.changeOf.get(OFFLINE_RUN)!.title).toBe('offline-sync');
    expect(levelsOf('report-v7').changeOf.get(RATE_LIMITS_RUN)!.title).toBe('feature/rate-limits');
  });

  test('a change with only a plan record is at plan, one with only sessions at design; a spec makes it full', () => {
    const planOnly = levelsOf('report-work', (raw) => {
      raw.runs = raw.runs.filter((r: any) => r.key !== OFFLINE_RUN);
    });
    expect(planOnly.changeOf.get(PLAN_RECORD)!.stage).toBe('plan');
    expect(planOnly.changeOf.get(PLAN_RECORD)!.path).toBe('full');
    const design = levelsOf('report-work', (raw) => {
      raw.runs = raw.runs.filter((r: any) => r.key !== OFFLINE_RUN && r.key !== PLAN_RECORD);
    });
    const sessionsOnly = design.changeOf.get(S_7D1E)!;
    expect(sessionsOnly.stage).toBe('design');
    expect(sessionsOnly.path).toBe('full');
    expect(sessionsOnly.home).toBe(LANTERN);
    expect(sessionsOnly.title).toBe('offline-sync');
    const smallPlan = levelsOf('report-v7', (raw) => {
      raw.runs = raw.runs.filter((r: any) => r.key !== OFFLINE_RUN);
    });
    expect(smallPlan.changeOf.get(PLAN_RECORD)!.path).toBe('small');
    expect(levelsOf('report-work').changeOf.get(TIDY_RUN)!.path).toBe('small');
    expect(levelsOf('report-work').changeOf.get(TIDY_RUN)!.stage).toBe('implementation');
  });

  test("a change's totals: cost, found findings, start and last activity", () => {
    const change = levelsOf('report-work').changeOf.get(OFFLINE_RUN)!;
    // 13.795 (the full run) + 1.05 (7d1e…) + 0.41 (2e8d…); the plan record has no priced model.
    expect(change.cost).toBeCloseTo(15.255, 6);
    expect(change.findings).toBe(17);
    expect(change.start).toBe('2026-11-09T13:40:12.551Z');
    expect(change.last).toBe('2026-11-10T16:47:31.880Z');
    const unpriced = levelsOf('report-work').changeOf.get(TIDY_RUN)!;
    expect(unpriced.cost).toBeNull();
    expect(unpriced.start).toBe('2026-11-03T09:55:00Z');
  });

  test('a session in no change is loose, with its own goal', () => {
    const { loose, changeOf, goalOf } = levelsOf('report-work');
    expect(keysOf(loose)).toEqual([S_6B1F, S_D4A7].sort());
    expect(changeOf.has(S_6B1F)).toBe(false);
    expect(goalOf(S_6B1F)).toBe('Release checklist');
    expect(goalOf(S_D4A7)).toBeNull();
  });

  test('with no new fields, every run is a change of its own but those sharing a plan, and none has a goal', () => {
    const { changes } = levelsOf('report-v7');
    expect(changes).toHaveLength(6);
    expect(changes.every((c) => c.goal === null)).toBe(true);
  });
});

describe('stepOf', () => {
  test('implementation with a full or small run, plan with a plan record, else design', () => {
    const { runs } = unitsOf('report-work');
    const run = (key: string) => runs.find((r) => r.key === key)!;
    expect(stepOf([run(PLAN_RECORD), run(WEBHOOKS_RUN)])).toBe('implementation');
    expect(stepOf([run(PLAN_RECORD)])).toBe('plan');
    expect(stepOf([])).toBe('design');
  });
});

/** GET `path` on a fresh database holding `name` after `change`, showing `showing`'s roots when given. */
async function api(
  path: string,
  showing?: string[],
  name = 'report-work',
  change: (raw: any) => void = () => {},
): Promise<{ status: number; body: any }> {
  const db = openDb(join(dir, `dashboard-${count++}.sqlite`));
  const raw = fixture(name);
  change(raw);
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error(`${name} does not load`);
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, NOW);
  if (showing) setShowing(db, showing.map(projectKey));
  const app = createApp({
    db,
    port: 4317,
    requestImport: () => {},
    importing: () => false,
    webDist: null,
    now: () => NOW,
    aliases: {},
    labeller: null,
  });
  const res = await app.request(path, { headers: { Host: 'localhost:4317' } });
  const body = res.status === 200 ? await res.json() : null;
  db.$client.close();
  return { status: res.status, body };
}

/** GET /api/work on a fresh database holding `name` after `change`, showing `showing`'s roots when given. */
async function work(
  query: string,
  showing?: string[],
  name = 'report-work',
  change: (raw: any) => void = () => {},
): Promise<WorkResponse> {
  const { status, body } = await api(`/api/work${query}`, showing, name, change);
  expect(status).toBe(200);
  return body;
}

const OFFLINE_CHANGE = changeKey(OFFLINE_SPEC, null, '', '');
const WEBHOOKS_CHANGE = changeKey(WEBHOOKS_SPEC, null, '', '');
const rowKeys = (body: WorkResponse) => body.goals.flatMap((g) => g.rows.map((r) => r.key));
const rowOf = (body: WorkResponse, key: string) => body.goals.flatMap((g) => g.rows).find((r) => r.key === key)!;

describe('workView', () => {
  test('one section per goal in the period, most recently active first, No goal last, each open', async () => {
    const body = await work('?weeks=4');
    expect(body.goals.map((g) => g.name)).toEqual(['Webhooks', 'Offline sync', null]);
    expect(body.goals.map((g) => g.key)).toEqual([goalKey('Webhooks'), goalKey('Offline sync'), null]);
    expect(body.goals.map((g) => g.lastActivity)).toEqual([
      '2026-11-12T08:01:36.550Z',
      '2026-11-10T16:47:31.880Z',
      '2026-11-12T09:20:00Z',
    ]);
    expect(body.goals.map((g) => g.open)).toEqual([true, true, true]);
    expect(body.goals[1]!.rows.map((r) => r.key)).toEqual([OFFLINE_CHANGE, TIDY_RUN]);
    expect(body.goals[2]!.rows.map((r) => r.key)).toEqual([IMG_RUN, RETRY_RUN]);
    // Release checklist has only a loose session, 6b1f…; d4a7… has no start, so it is in no period.
    expect(body.looseSessions).toBe(1);
    expect(body.anyGoal).toBe(true);
    expect(body.goalOptions).toEqual([
      { key: goalKey('Offline sync'), name: 'Offline sync' },
      { key: goalKey('Webhooks'), name: 'Webhooks' },
    ]);
    expect(body.hidden).toBe(0);
  });

  test('a section with no change active this week starts closed', async () => {
    const body = await work('?weeks=4&project=' + projectKey(TIDEPOOL));
    // No goal holds only fix/retry-backoff here (2026-10-21), the img run being in lantern-notes alone.
    const noGoal = body.goals.find((g) => g.name === null)!;
    expect(noGoal.rows.map((r) => r.key)).toEqual([RETRY_RUN]);
    expect(noGoal.open).toBe(false);
  });

  test("a change's row: its home project, others, path, stage and whole totals", async () => {
    const row = rowOf(await work('?weeks=4'), OFFLINE_CHANGE);
    expect(row).toEqual({
      key: OFFLINE_CHANGE,
      title: 'Plan the offline queue and replay',
      project: 'lantern-notes',
      otherProjects: ['tidepool-api'],
      otherCount: 1,
      path: 'full',
      stage: 'implementation',
      lastActivity: '2026-11-10T16:47:31.880Z',
      runs: 2,
      sessions: 2,
      findings: 17,
      cost: expect.closeTo(15.255, 6),
    });
  });

  test("projects are named as the other views name them: a run's root by storedNames, a session-only root not at all", async () => {
    // A session root whose folder name a run's root shares names no project, so the run's root keeps its plain name.
    const body = await work('?weeks=4', undefined, 'report-work', (raw) => {
      sessionOf(raw, S_2E8D).project = '/Users/example/Scratch/lantern-notes';
    });
    const offline = rowOf(body, OFFLINE_CHANGE);
    expect(offline.project).toBe('lantern-notes');
    expect(offline.otherProjects).toEqual([]);
    expect(offline.otherCount).toBe(1);
    // A design-only change at home in a session-only root reads "other project" (null), as sessionFacts gives it.
    const design = await work('?weeks=4', undefined, 'report-work', (raw) => {
      sessionOf(raw, S_6B1F).spec = { project: SCRATCH, path: 'docs/superpowers/specs/2026-11-05-release-design.md' };
    });
    const row = rowOf(design, changeKey({ project: SCRATCH, path: 'docs/superpowers/specs/2026-11-05-release-design.md' }, null, '', ''));
    expect(row.project).toBeNull();
  });

  test("a section's totals are the sums of its rows", async () => {
    for (const section of (await work('?weeks=4')).goals) {
      const sum = (pick: (r: (typeof section.rows)[number]) => number | null) =>
        section.rows.reduce<number | null>((s, r) => (pick(r) === null ? s : (s ?? 0) + pick(r)!), null);
      expect(section.changes).toBe(section.rows.length);
      expect(section.runs).toBe(sum((r) => r.runs));
      expect(section.sessions).toBe(sum((r) => r.sessions) ?? 0);
      expect(section.cost).toBeCloseTo(sum((r) => r.cost) ?? NaN, 6);
    }
  });

  test('a filter never cuts a change: one week keeps its whole cost', async () => {
    const body = await work('?weeks=1');
    expect(rowOf(body, OFFLINE_CHANGE).cost).toBeCloseTo(15.255, 6);
    expect(rowKeys(body)).not.toContain(TIDY_RUN);
    expect(rowKeys(body)).not.toContain(RETRY_RUN);
  });

  test('the project filter lists a change any of whose units ran in it', async () => {
    const keys = rowKeys(await work('?weeks=4&project=' + projectKey(TIDEPOOL)));
    expect(keys).toEqual(expect.arrayContaining([OFFLINE_CHANGE, WEBHOOKS_CHANGE, RETRY_RUN]));
    expect(keys).not.toContain(TIDY_RUN);
  });

  test("the goal filter lists only that goal's section", async () => {
    const body = await work('?weeks=4&goal=' + goalKey('Webhooks'));
    expect(body.goals.map((g) => g.name)).toEqual(['Webhooks']);
    expect(body.goals[0]!.rows.map((r) => r.key)).toEqual([WEBHOOKS_CHANGE]);
  });

  test('with no goals in the store, anyGoal is false', async () => {
    const body = await work('?weeks=52', undefined, 'report-v7');
    expect(body.anyGoal).toBe(false);
    expect(body.goals.map((g) => g.name)).toEqual([null]);
  });

  test('showing mode lists the changes of shown homes, counts the rest, and leaks nothing', async () => {
    const body = await work('?weeks=4', [LANTERN]);
    expect(rowKeys(body)).not.toContain(WEBHOOKS_CHANGE);
    expect(body.goals.map((g) => g.name)).toEqual(['Offline sync', null]);
    // The webhooks change and fix/retry-backoff, both at home in tidepool-api.
    expect(body.hidden).toBe(2);
    const offline = rowOf(body, OFFLINE_CHANGE);
    expect(offline.otherProjects).toEqual([]);
    expect(offline.otherCount).toBe(1);
    expect(offline.cost).toBeCloseTo(15.255, 6);
    expect(body.goalOptions.map((g) => g.name)).toEqual(['Offline sync']);

    const raw = fixture('report-work');
    const { runs, sessions } = unitsOf('report-work');
    const branches = storedBranches(runs);
    const sessionIds = [
      ...new Set(JSON.stringify(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)),
    ];
    const strings = forbiddenStrings(
      [...branches.keys()],
      branches,
      [LANTERN],
      sessionIds,
      storedSessionRoots(sessions),
      goalHomes(levels(runs, sessions)),
    );
    expect(strings.forbidden).toContain('Webhooks');
    expect(strings.kinds.get('Webhooks')).toEqual(['goal name']);
    expect(strings.forbidden).not.toContain('Offline sync');
    // A goal held only by a loose session in a hidden root is hidden too.
    expect(strings.kinds.get('Release checklist')).toEqual(['goal name']);
    const scope = scopeOf([projectKey(LANTERN)], branches, {}, storedSessionRoots(sessions), goalHomes(levels(runs, sessions)))!;
    expect(maskText(scope, 'Release checklist and Offline sync')).toBe('another goal and Offline sync');
    const scratchShown = forbiddenStrings(
      [...branches.keys()],
      branches,
      [LANTERN, SCRATCH],
      [],
      storedSessionRoots(sessions),
      goalHomes(levels(runs, sessions)),
    );
    expect(scratchShown.forbidden).not.toContain('Release checklist');
    expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
  });
});

describe('a shown unit of an unlisted change', () => {
  // Webhooks gets a second change at home in lantern-notes (the <img…> run's), and tidy-imports, run in lantern-notes,
  // joins the webhooks change, at home in tidepool-api.
  const split = (raw: any) => {
    runOf(raw, IMG_RUN).goal = 'Webhooks';
    runOf(raw, TIDY_RUN).spec = WEBHOOKS_SPEC;
    runOf(raw, TIDY_RUN).goal = 'Webhooks';
  };

  test('shows no change or goal, though another change of its goal is listed', async () => {
    const { body } = await api('/api/runs?weeks=4', [LANTERN], 'report-work', split);
    const row = (key: string) => body.runs.find((r: { key: string }) => r.key === key);
    expect(row(IMG_RUN).goal).toEqual({ key: goalKey('Webhooks'), name: 'Webhooks' });
    expect(row(TIDY_RUN)).toMatchObject({ change: null, goal: null });
    expect((await api(`/api/runs/${TIDY_RUN}`, [LANTERN], 'report-work', split)).body).toMatchObject({
      change: null,
      goal: null,
    });
  });
});

describe("a listed change's title in showing mode", () => {
  // The webhooks run, in tidepool-api, becomes the offline-sync change's newest plan record.
  const moved = (raw: any) => {
    runOf(raw, WEBHOOKS_RUN).spec = OFFLINE_SPEC;
    runOf(raw, WEBHOOKS_RUN).record.path = 'plan';
  };
  const SHOWN = 'Plan the offline queue and replay';

  test("comes from the shown projects' units only", async () => {
    expect(levelsOf('report-work', moved).changeOf.get(OFFLINE_RUN)!.title).toBe('Send webhooks for note changes');
    expect(rowOf(await work('?weeks=4', [LANTERN], 'report-work', moved), OFFLINE_CHANGE).title).toBe(SHOWN);
    const page = (await changePage(OFFLINE_CHANGE, [LANTERN], 'report-work', moved)).body as ChangeResponse;
    expect(page.title).toBe(SHOWN);
    expect(page.graph.lanes[0]!.title).toBe(SHOWN);
    expect(page.sessions.find((s) => s.key === S_7D1E)!.change!.title).toBe(SHOWN);
    const runs = (await api('/api/runs?weeks=4', [LANTERN], 'report-work', moved)).body;
    expect(runs.runs.find((r: { key: string }) => r.key === OFFLINE_RUN).change.title).toBe(SHOWN);
  });

  test("falls back to its spec file's name when no shown unit has a headline", async () => {
    const page = (
      await changePage(OFFLINE_CHANGE, [LANTERN], 'report-work', (raw) => {
        moved(raw);
        runOf(raw, PLAN_RECORD).headline = null;
        runOf(raw, OFFLINE_RUN).headline = null;
      })
    ).body as ChangeResponse;
    expect(page.title).toBe('offline-sync');
  });
});

describe('goalHomes', () => {
  test("each goal's changes' home roots and its loose sessions' roots", () => {
    const homes = goalHomes(levelsOf('report-work'));
    expect(homes.get('Webhooks')).toEqual([TIDEPOOL]);
    expect(homes.get('Offline sync')).toEqual([LANTERN]);
    expect(homes.get('Release checklist')).toEqual([SCRATCH]);
  });
});

const changePage = (key: string, showing?: string[], name?: string, change?: (raw: any) => void) =>
  api(`/api/work/changes/${key}`, showing, name, change);
const goalPage = (name: string, showing?: string[], change?: (raw: any) => void) =>
  api(`/api/work/goals/${goalKey(name)}`, showing, 'report-work', change);
const OFFLINE_V7 = hash(`plan|${LANTERN}|${OFFLINE_PLAN}`);
const WEBHOOKS_V7 = hash(`plan|${TIDEPOOL}|${WEBHOOKS_PLAN}`);

/** A graph's node keys by lane, each lane's in the graph's order. */
function lanesOf(graph: SessionGraphData): string[][] {
  return graph.lanes.map((_, i) => graph.nodes.filter((n) => n.lane === i).map((n) => n.key));
}
const nodeOf = (graph: SessionGraphData, key: string) => graph.nodes.find((n) => n.key === key)!;
const sortEdges = (edges: GraphEdge[]) => [...edges].sort((a, b) => `${a.from}${a.to}`.localeCompare(`${b.from}${b.to}`));

/** What a showing-mode response of report-work may not hold, with `shownRoots` shown. */
function forbiddenFor(shownRoots: string[]) {
  const raw = fixture('report-work');
  const { runs, sessions } = unitsOf('report-work');
  const branches = storedBranches(runs);
  const sessionIds = [
    ...new Set(JSON.stringify(raw).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)),
  ];
  const strings = forbiddenStrings(
    [...branches.keys()],
    branches,
    shownRoots,
    sessionIds,
    storedSessionRoots(sessions),
    goalHomes(levels(runs, sessions)),
  );
  return { forbidden: [...strings.forbidden, '/Users/example'], shown: strings.shown };
}

describe('changeView', () => {
  test("the offline-sync change: its facts, its lane, then the other change's session that started its sessions", async () => {
    const { status, body } = await changePage(OFFLINE_CHANGE);
    expect(status).toBe(200);
    const change = body as ChangeResponse;
    expect(change).toMatchObject({
      key: OFFLINE_CHANGE,
      title: 'Plan the offline queue and replay',
      goal: { key: goalKey('Offline sync'), name: 'Offline sync' },
      project: 'lantern-notes',
      otherProjects: ['tidepool-api'],
      otherCount: 1,
      path: 'full',
      stage: 'implementation',
      spec: '2026-11-05-offline-sync-design.md',
      startedAt: '2026-11-09T13:40:12.551Z',
      lastActivity: '2026-11-10T16:47:31.880Z',
      sessionCount: 2,
      runCount: 2,
    });
    expect(change.cost).toBeCloseTo(15.255, 6);
    expect(change.graph.lanes).toEqual([
      { key: OFFLINE_CHANGE, title: 'Plan the offline queue and replay', kind: 'change' },
      { key: null, title: 'Other changes', kind: 'other' },
    ]);
    expect(lanesOf(change.graph)).toEqual([[S_2E8D, S_7D1E], [S_5A9D]]);
    expect(nodeOf(change.graph, S_7D1E)).toEqual({
      key: S_7D1E,
      title: 'Offline sync build',
      step: 'implementation',
      run: { key: OFFLINE_RUN, title: 'Queue edits offline and replay them on reconnect', branch: 'feature/offline-sync' },
      lane: 0,
      elsewhere: null,
    });
    expect(nodeOf(change.graph, S_5A9D)).toMatchObject({
      title: 'Offline sync plan',
      step: 'implementation',
      run: { key: WEBHOOKS_RUN, title: 'Send webhooks for note changes', branch: 'feature/webhooks' },
      elsewhere: { kind: 'goal', name: 'Webhooks' },
    });
    expect(sortEdges(change.graph.edges)).toEqual(
      sortEdges([
        { from: S_5A9D, to: S_7D1E, how: 'started' },
        { from: S_5A9D, to: S_2E8D, how: 'handoff' },
      ]),
    );
    expect(change.graph.hidden).toBe(0);
    expect(change.runs.map((r) => r.key)).toEqual([OFFLINE_RUN, PLAN_RECORD]);
    expect(change.sessions.map((s) => s.key)).toEqual([S_2E8D, S_7D1E]);
    const build = change.sessions.find((s) => s.key === S_7D1E)!;
    expect(build.startedBy).toEqual({ key: S_5A9D, title: 'Offline sync plan' });
    expect(build.step).toBe('implementation');
    expect(build.run).toEqual({ key: OFFLINE_RUN, title: 'Queue edits offline and replay them on reconnect', branch: 'feature/offline-sync' });
    expect(build.change).toEqual({ key: OFFLINE_CHANGE, title: 'Plan the offline queue and replay' });
  });

  test("a session row's length, models and cost are the Sessions view's", async () => {
    const change = (await changePage(OFFLINE_CHANGE)).body as ChangeResponse;
    const sessions = (await api('/api/sessions?weeks=4')).body.sessions as SessionRow[];
    for (const row of change.sessions) {
      const listed = sessions.find((s) => s.key === row.key)!;
      expect({ ...row }).toMatchObject({
        title: listed.title,
        start: listed.start,
        end: listed.end,
        minutes: listed.minutes,
        models: listed.models,
        cost: listed.cost,
      });
    }
  });

  test("a session of the same goal's other change reads that change", async () => {
    const { body } = await changePage(OFFLINE_CHANGE, undefined, 'report-work', (raw) => {
      runOf(raw, WEBHOOKS_RUN).goal = 'Offline sync';
      sessionOf(raw, S_5A9D).goal = 'Offline sync';
    });
    expect(nodeOf(body.graph, S_5A9D).elsewhere).toEqual({ kind: 'change', title: 'Send webhooks for note changes' });
  });

  test('an unknown key is a 404', async () => {
    expect((await changePage('0000000000000000')).status).toBe(404);
  });

  test("handoffs before started_by: a session's or a held run's handoff_to naming a stored session is a handoff edge", async () => {
    const { status, body } = await changePage(WEBHOOKS_V7, undefined, 'report-v7');
    expect(status).toBe(200);
    expect(lanesOf(body.graph)).toEqual([[S_5A9D], [S_2E8D]]);
    expect(nodeOf(body.graph, S_2E8D).elsewhere).toEqual({ kind: 'none' });
    // The webhooks run's handoff_to, 9c41e07b5d28a3f6, names no stored session.
    expect(body.graph.edges).toEqual([{ from: S_5A9D, to: S_2E8D, how: 'handoff' }]);
    const offline = (await changePage(OFFLINE_V7, undefined, 'report-v7')).body;
    expect(offline.graph.edges).toEqual([]);
    expect(offline.sessions.every((s: WorkSessionRow) => s.startedBy === null)).toBe(true);
  });

  test("a held run's handoff_to gives the edge too", async () => {
    const { body } = await changePage(WEBHOOKS_V7, undefined, 'report-v7', (raw) => {
      sessionOf(raw, S_5A9D).context.handoff_to = null;
      runOf(raw, WEBHOOKS_RUN).context.handoff_to = S_2E8D;
    });
    expect(body.graph.edges).toEqual([{ from: S_5A9D, to: S_2E8D, how: 'handoff' }]);
  });

  test('a started_by wins over a handoff_to for the same pair', async () => {
    const { body } = await changePage(OFFLINE_CHANGE, undefined, 'report-work', (raw) => {
      sessionOf(raw, S_2E8D).started_by = { key: S_5A9D, how: 'started' };
    });
    expect(body.graph.edges).toContainEqual({ from: S_5A9D, to: S_2E8D, how: 'started' });
    expect(body.graph.edges.filter((e: GraphEdge) => e.to === S_2E8D)).toHaveLength(1);
  });

  test('a started_by naming no stored session gives no edge', async () => {
    const { body } = await changePage(OFFLINE_CHANGE, undefined, 'report-work', (raw) => {
      sessionOf(raw, S_7D1E).started_by = { key: 'ffffffffffffffff', how: 'started' };
    });
    expect(body.graph.edges.filter((e: GraphEdge) => e.to === S_7D1E)).toEqual([]);
    expect(body.sessions.find((s: WorkSessionRow) => s.key === S_7D1E).startedBy).toBeNull();
  });

  test('a session with no start is in no list or graph', async () => {
    const { body } = await changePage(OFFLINE_CHANGE, undefined, 'report-work', (raw) => {
      sessionOf(raw, S_D4A7).spec = OFFLINE_SPEC;
      sessionOf(raw, S_D4A7).started_by = { key: S_7D1E, how: 'started' };
    });
    expect(body.sessions.map((s: WorkSessionRow) => s.key)).not.toContain(S_D4A7);
    expect(body.graph.nodes.map((n: GraphNode) => n.key)).not.toContain(S_D4A7);
    expect(body.graph.edges.filter((e: GraphEdge) => e.to === S_D4A7)).toEqual([]);
  });
});

describe('goalView', () => {
  test("the Webhooks goal: its change's lane, then Other goals with the sessions it started", async () => {
    const { status, body } = await goalPage('Webhooks');
    expect(status).toBe(200);
    const goal = body as GoalResponse;
    expect(goal.graph.lanes).toEqual([
      { key: WEBHOOKS_CHANGE, title: 'Send webhooks for note changes', kind: 'change' },
      { key: null, title: 'Other goals', kind: 'other' },
    ]);
    expect(lanesOf(goal.graph)).toEqual([[S_5A9D], [S_2E8D, S_7D1E]]);
    expect(nodeOf(goal.graph, S_5A9D).elsewhere).toBeNull();
    expect(nodeOf(goal.graph, S_7D1E).elsewhere).toEqual({ kind: 'goal', name: 'Offline sync' });
    expect(nodeOf(goal.graph, S_2E8D).elsewhere).toEqual({ kind: 'goal', name: 'Offline sync' });
    expect(sortEdges(goal.graph.edges)).toEqual(
      sortEdges([
        { from: S_5A9D, to: S_7D1E, how: 'started' },
        { from: S_5A9D, to: S_2E8D, how: 'handoff' },
      ]),
    );
    expect(goal.sessions.map((s) => s.key)).toEqual([S_5A9D]);
    expect(goal.changes.map((c) => c.key)).toEqual([WEBHOOKS_CHANGE]);
  });

  test('the Offline sync goal: a lane per change with a session, none for the session that started them', async () => {
    const goal = (await goalPage('Offline sync')).body as GoalResponse;
    expect(goal).toMatchObject({
      key: goalKey('Offline sync'),
      name: 'Offline sync',
      projects: ['lantern-notes', 'tidepool-api'],
      changeCount: 2,
      runCount: 3,
      sessionCount: 2,
    });
    expect(goal.cost).toBeCloseTo(15.255, 6);
    expect(goal.graph.lanes).toEqual([{ key: OFFLINE_CHANGE, title: 'Plan the offline queue and replay', kind: 'change' }]);
    expect(lanesOf(goal.graph)).toEqual([[S_2E8D, S_7D1E]]);
    expect(goal.graph.edges).toEqual([]);
    expect(goal.changes.map((c) => c.key)).toEqual([TIDY_RUN, OFFLINE_CHANGE]);
  });

  test("lanes go in order of their change's start", async () => {
    const release = { project: LANTERN, path: 'docs/superpowers/specs/2026-11-05-release-design.md' };
    const goal = (
      await goalPage('Offline sync', undefined, (raw) => {
        sessionOf(raw, S_6B1F).spec = release;
        sessionOf(raw, S_6B1F).goal = 'Offline sync';
      })
    ).body as GoalResponse;
    expect(goal.graph.lanes.map((l) => l.key)).toEqual([changeKey(release, null, '', ''), OFFLINE_CHANGE]);
    expect(lanesOf(goal.graph)).toEqual([[S_6B1F], [S_2E8D, S_7D1E]]);
  });

  test("a loose session of the goal has the No change lane, and its cost counts in the goal's", async () => {
    const goal = (
      await goalPage('Offline sync', undefined, (raw) => {
        sessionOf(raw, S_6B1F).goal = 'Offline sync';
      })
    ).body as GoalResponse;
    expect(goal.graph.lanes.map((l) => [l.kind, l.title])).toEqual([
      ['change', 'Plan the offline queue and replay'],
      ['none', 'No change'],
    ]);
    expect(lanesOf(goal.graph)).toEqual([[S_2E8D, S_7D1E], [S_6B1F]]);
    expect(nodeOf(goal.graph, S_6B1F).elsewhere).toBeNull();
    const loose = goal.sessions.find((s) => s.key === S_6B1F)!;
    expect(loose.change).toBeNull();
    expect(goal.sessionCount).toBe(3);
    expect(goal.cost).toBeCloseTo(15.255 + loose.cost!, 6);
    // The tidy-imports change started before the loose session.
    expect(goal.startedAt).toBe('2026-11-03T09:55:00Z');
  });

  test('an unknown key is a 404', async () => {
    expect((await api('/api/work/goals/0000000000000000')).status).toBe(404);
  });
});

describe('the change and goal pages in showing mode', () => {
  test('lantern-notes shown: the webhooks change and goal are missing; the offline change leaves out tidepool-api', async () => {
    expect((await changePage(WEBHOOKS_CHANGE, [LANTERN])).status).toBe(404);
    expect((await goalPage('Webhooks', [LANTERN])).status).toBe(404);
    const { status, body } = await changePage(OFFLINE_CHANGE, [LANTERN]);
    expect(status).toBe(200);
    const change = body as ChangeResponse;
    expect(nodeOf(change.graph, S_5A9D)).toMatchObject({
      elsewhere: { kind: 'unlisted' },
      run: { key: PLAN_RECORD, title: 'Plan the offline queue and replay', branch: 'feature/offline-sync' },
    });
    expect(change.graph.nodes.map((n) => n.key)).not.toContain(S_2E8D);
    expect(change.graph.edges).toEqual([{ from: S_5A9D, to: S_7D1E, how: 'started' }]);
    expect(change.graph.hidden).toBe(1);
    expect(change.sessions.map((s) => s.key)).toEqual([S_7D1E]);
    expect(change.runs.map((r) => r.key)).toEqual([OFFLINE_RUN, PLAN_RECORD]);
    expect(change.sessionCount).toBe(2);
    expect(change.cost).toBeCloseTo(15.255, 6);
    expect(change.otherProjects).toEqual([]);
    expect(change.otherCount).toBe(1);

    const goal = (await goalPage('Offline sync', [LANTERN])).body as GoalResponse;
    expect(goal.projects).toEqual(['lantern-notes']);
    expect(goal.sessionCount).toBe(2);

    const { forbidden, shown } = forbiddenFor([LANTERN]);
    expect(leaks(change, forbidden, shown)).toEqual([]);
    expect(leaks(goal, forbidden, shown)).toEqual([]);
  });

  test("a goal's page leaves out a session of its change that Work doesn't list, and counts it", async () => {
    const release = { project: TIDEPOOL, path: 'docs/superpowers/specs/2026-11-05-release-design.md' };
    const moved = (raw: any) => {
      sessionOf(raw, S_6B1F).spec = release;
      sessionOf(raw, S_6B1F).goal = 'Offline sync';
      sessionOf(raw, S_6B1F).project = LANTERN;
    };
    const all = (await goalPage('Offline sync', undefined, moved)).body as GoalResponse;
    expect(all.graph.nodes.map((n) => n.key)).toContain(S_6B1F);
    const { status, body } = await goalPage('Offline sync', [LANTERN], moved);
    expect(status).toBe(200);
    const goal = body as GoalResponse;
    expect(goal.graph.nodes.map((n) => n.key)).toEqual([S_7D1E]);
    expect(goal.graph.lanes.map((l) => l.kind)).toEqual(['change']);
    // 6b1f…, of the unlisted release change, and 2e8d…, in tidepool-api.
    expect(goal.graph.hidden).toBe(2);
    expect(goal.sessions.map((s) => s.key)).toEqual([S_7D1E]);
    expect(goal.changes.map((c) => c.key)).toEqual([TIDY_RUN, OFFLINE_CHANGE]);
    expect(goal).toMatchObject({ changeCount: 3, runCount: 3, sessionCount: 3, findings: all.findings });
    expect(goal.cost).toBeCloseTo(all.cost!, 6);
    const { forbidden, shown } = forbiddenFor([LANTERN]);
    expect(leaks(goal, forbidden, shown)).toEqual([]);
  });

  test("tidepool-api shown: offline sync is missing, and a starter that isn't shown is named by nothing", async () => {
    expect((await changePage(OFFLINE_CHANGE, [TIDEPOOL])).status).toBe(404);
    expect((await goalPage('Offline sync', [TIDEPOOL])).status).toBe(404);
    const moved = (raw: any) => {
      sessionOf(raw, S_2E8D).spec = WEBHOOKS_SPEC;
      sessionOf(raw, S_2E8D).goal = 'Webhooks';
    };
    const { status, body } = await changePage(WEBHOOKS_CHANGE, [TIDEPOOL], 'report-work', moved);
    expect(status).toBe(200);
    const change = body as ChangeResponse;
    const port = change.sessions.find((s) => s.key === S_2E8D)!;
    expect(port.startedBy).toEqual({ key: null, title: null });
    expect(change.sessions.map((s) => s.key)).toEqual([S_2E8D]);
    expect(change.graph.nodes.map((n) => n.key)).toEqual([S_2E8D]);
    expect(change.graph.edges).toEqual([]);
    // 5a9d… and 7d1e…, both in lantern-notes.
    expect(change.graph.hidden).toBe(2);
    const goal = (await goalPage('Webhooks', [TIDEPOOL], moved)).body as GoalResponse;
    expect(goal.sessions.map((s) => s.key)).toEqual([S_2E8D]);

    const plain = (await changePage(WEBHOOKS_CHANGE, [TIDEPOOL])).body as ChangeResponse;
    expect(plain.graph.nodes.map((n) => n.key)).not.toContain(S_5A9D);

    const { forbidden, shown } = forbiddenFor([TIDEPOOL]);
    expect(leaks(change, forbidden, shown)).toEqual([]);
    expect(leaks(goal, forbidden, shown)).toEqual([]);
    expect(leaks(plain, forbidden, shown)).toEqual([]);
  });
});
