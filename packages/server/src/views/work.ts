import {
  addKnown,
  foundFindings,
  modelsCost,
  parseTime,
  projectRoot,
  runFacts,
  sessionRootOf,
  type RunEntry,
  type SessionEntry,
  type SpecRef,
  type WorkStep,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { changeKey } from '../keys.ts';
import { rootOf } from './runs.ts';
import { heldRuns } from './sessions.ts';

/**
 * A change: the runs and plan records sharing a spec (else a plan file under one root, else one run) and the sessions
 * in it; its goal, title, home project (its spec's root, else its run's), projects, path, stage and totals as the
 * spec's "The levels" makes them.
 */
export type Change = {
  key: string;
  title: string;
  goal: string | null;
  spec: SpecRef | null;
  home: string;
  roots: string[];
  path: 'full' | 'small';
  stage: WorkStep;
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  start: string | null;
  last: string | null;
  cost: number | null;
  findings: number | null;
};

/** Every change, each unit's change by its key, the sessions in no change, and a unit's goal (its change's, else a
 * loose session's own). */
export type Levels = {
  changes: Change[];
  changeOf: Map<string, Change>;
  loose: StoredUnit<SessionEntry>[];
  goalOf(unitKey: string): string | null;
};

const time = (at: string | null | undefined) => (at ? parseTime(at).getTime() : -Infinity);
const runTime = (run: StoredUnit<RunEntry>) => time(run.merged.record?.date);
const isPlan = (run: StoredUnit<RunEntry>) => run.merged.record?.path === 'plan';
const newestFirst = <T>(units: T[], at: (unit: T) => number) => [...units].sort((a, b) => at(b) - at(a));
const known = (times: (string | null | undefined)[]) => times.filter((t): t is string => !!t);
const earliest = (times: (string | null | undefined)[]) => newestFirst(known(times), time).at(-1) ?? null;
const latest = (times: (string | null | undefined)[]) => newestFirst(known(times), time)[0] ?? null;

/** What a session held, or how far a change got: implementation with a run that isn't a plan record, else plan with a
 * plan record, else design. */
export function stepOf(held: StoredUnit<RunEntry>[]): WorkStep {
  if (held.some((run) => !isPlan(run))) return 'implementation';
  return held.length ? 'plan' : 'design';
}

/** A spec's file name without its date and `-design.md`: `2026-11-05-offline-sync-design.md` → `offline-sync`. */
function specName(path: string): string {
  return (path.split('/').at(-1) ?? '').replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/-design\.md$/, '');
}

type Group = {
  key: string;
  spec: SpecRef | null;
  home: string;
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
};

function changeOfGroup(group: Group): Change {
  const { runs, sessions, spec } = group;
  const plans = newestFirst(runs.filter(isPlan), runTime);
  const built = newestFirst(runs.filter((run) => !isPlan(run)), runTime);
  const units = newestFirst(
    [
      ...runs.map((run) => ({ at: runTime(run), goal: run.merged.goal })),
      ...sessions.map((s) => ({ at: time(s.merged.start), goal: s.merged.goal })),
    ],
    (unit) => unit.at,
  );
  const sessionRoots = sessions.map((s) => sessionRootOf(s.merged.project)).filter((root): root is string => !!root);
  const sessionStart = earliest(sessions.map((s) => s.merged.start));
  return {
    key: group.key,
    title:
      plans[0]?.merged.headline ??
      built[0]?.merged.headline ??
      (spec ? specName(spec.path) : null) ??
      newestFirst(runs, runTime)[0]?.merged.record?.branch ??
      '',
    goal: units.find((unit) => unit.goal)?.goal ?? null,
    spec,
    home: group.home,
    roots: [...new Set([...runs.map(rootOf), ...sessionRoots])].sort(),
    path: spec || runs.some((run) => run.merged.record?.path === 'full') ? 'full' : 'small',
    stage: stepOf(runs),
    runs,
    sessions,
    start: sessionStart ?? earliest(runs.map((run) => run.merged.record?.started)),
    last: latest([...runs.map((run) => run.merged.record?.date), ...sessions.map((s) => s.merged.end)]),
    cost: [...runs, ...sessions].reduce<number | null>(
      (sum, unit) => addKnown(sum, modelsCost(unit.merged.models)),
      null,
    ),
    findings: runs.reduce<number | null>((sum, run) => addKnown(sum, foundFindings(runFacts(run.merged))), null),
  };
}

/**
 * The levels above a run: runs and plan records go to the change of their spec, else of their plan file under their
 * root, else one of their own; a session to its spec's change, else to the change of the newest run or plan record it
 * holds (heldRuns), else it is loose. A change's goal is its newest unit's that has one (runs by record date, sessions
 * by start).
 */
export function levels(runs: StoredUnit<RunEntry>[], sessions: StoredUnit<SessionEntry>[]): Levels {
  const groups = new Map<string, Group>();
  const groupOf = new Map<string, Group>();
  const group = (key: string, spec: SpecRef | null, home: string) => {
    const found = groups.get(key) ?? { key, spec, home, runs: [], sessions: [] };
    groups.set(key, found);
    return found;
  };

  for (const run of runs) {
    const spec = run.merged.spec ?? null;
    const root = rootOf(run);
    const key = changeKey(spec, run.merged.record?.plan ?? null, root, run.key);
    const g = group(key, spec, spec ? projectRoot(spec.project) : root);
    g.runs.push(run);
    groupOf.set(run.key, g);
  }

  const held = heldRuns(runs);
  const loose: StoredUnit<SessionEntry>[] = [];
  for (const session of sessions) {
    const spec = session.merged.spec ?? null;
    const newest = newestFirst(held.get(session.merged.file) ?? [], runTime)[0];
    const g = spec
      ? group(changeKey(spec, null, '', ''), spec, projectRoot(spec.project))
      : newest && groupOf.get(newest.key);
    if (!g) {
      loose.push(session);
      continue;
    }
    g.sessions.push(session);
    groupOf.set(session.key, g);
  }

  const changes = [...groups.values()].map(changeOfGroup);
  const byGroupKey = new Map(changes.map((change) => [change.key, change]));
  const changeOf = new Map([...groupOf].map(([unitKey, g]) => [unitKey, byGroupKey.get(g.key)!]));
  const looseGoals = new Map(loose.map((s) => [s.key, s.merged.goal ?? null]));
  return {
    changes,
    changeOf,
    loose,
    goalOf: (unitKey) => (changeOf.has(unitKey) ? changeOf.get(unitKey)!.goal : (looseGoals.get(unitKey) ?? null)),
  };
}
