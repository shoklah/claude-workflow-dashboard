import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadReport, type RunEntry, type SessionEntry } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { openDb } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { listUnits, type StoredUnit } from '../src/db/read.ts';
import { changeKey, goalKey, hash } from '../src/keys.ts';
import { levels, stepOf } from '../src/views/work.ts';

const NOW = new Date('2026-11-12T12:00:00Z');
const LANTERN = '/Users/example/Work/lantern-notes';
const TIDEPOOL = '/Users/example/Work/tidepool-api';
const OFFLINE_SPEC = { project: LANTERN, path: 'docs/superpowers/specs/2026-11-05-offline-sync-design.md' };
const OFFLINE_PLAN = 'docs/superpowers/plans/2026-11-08-offline-sync.md';
const WEBHOOKS_PLAN = 'docs/superpowers/plans/2026-11-11-webhooks.md';

// report-work's units, by their stored keys.
const PLAN_RECORD = '51120289e82db399'; // offline sync's plan record, transcript 5a9d…
const OFFLINE_RUN = '97d6367dec7d9739'; // offline sync's full run, transcript 7d1e…
const WEBHOOKS_RUN = '2e10cc2ee4d14576'; // feature/webhooks, transcript 5a9d…
const TIDY_RUN = 'db2cf90d5739f4d0'; // chore/tidy-imports, no spec, no plan
const RATE_LIMITS_RUN = '7599a116b2739d9f'; // feature/rate-limits, no spec, no plan
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
