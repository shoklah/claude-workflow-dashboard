import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadReport, type RunEntry, type SessionEntry, type WorkResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp } from '../src/app.ts';
import { openDb } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, setShowing, type StoredUnit } from '../src/db/read.ts';
import { changeKey, goalKey, hash, projectKey } from '../src/keys.ts';
import { storedBranches, storedSessionRoots } from '../src/views/runs.ts';
import { forbiddenStrings, leaks } from '../src/views/scope.ts';
import { goalHomes, levels, stepOf } from '../src/views/work.ts';

const NOW = new Date('2026-11-12T12:00:00Z');
const LANTERN = '/Users/example/Work/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';
const OFFLINE_SPEC = { project: LANTERN, path: 'docs/superpowers/specs/2026-11-05-offline-sync-design.md' };
const OFFLINE_PLAN = 'docs/superpowers/plans/2026-11-08-offline-sync.md';
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

/** GET /api/work on a fresh database holding `name`, showing `showing`'s roots when given. */
async function work(query: string, showing?: string[], name = 'report-work'): Promise<WorkResponse> {
  const db = openDb(join(dir, `dashboard-${count++}.sqlite`));
  const raw = fixture(name);
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
  const res = await app.request(`/api/work${query}`, { headers: { Host: 'localhost:4317' } });
  expect(res.status).toBe(200);
  const body = await res.json();
  db.$client.close();
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
    expect(leaks(body, [...strings.forbidden, '/Users/example'], strings.shown)).toEqual([]);
  });
});

describe('goalHomes', () => {
  test("each goal's changes' home roots", () => {
    const homes = goalHomes(levelsOf('report-work'));
    expect(homes.get('Webhooks')).toEqual([TIDEPOOL]);
    expect(homes.get('Offline sync')).toEqual([LANTERN]);
    expect(homes.has('Release checklist')).toBe(false);
  });
});
