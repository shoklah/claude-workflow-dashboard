import {
  addKnown,
  foundFindings,
  modelsCost,
  parseTime,
  projectRoot,
  runFacts,
  sessionRootOf,
  weekOf,
  type ChangeRow,
  type GoalSection,
  type RunEntry,
  type SessionEntry,
  type SpecRef,
  type WorkQuery,
  type WorkResponse,
  type WorkStep,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { changeKey, goalKey, projectKey } from '../keys.ts';
import { periodStoredUnits, rootOf } from './runs.ts';
import { maskText, type Scope } from './scope.ts';
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

/** Each goal's name with its changes' home roots, for showing mode's hidden goal names (scopeOf, forbiddenStrings). */
export function goalHomes(levels: Levels): Map<string, string[]> {
  const homes = new Map<string, string[]>();
  for (const { goal, home } of levels.changes) {
    if (goal) homes.set(goal, [...new Set([...(homes.get(goal) ?? []), home])]);
  }
  return homes;
}

/**
 * The Changes view: the changes with a unit in the query's period (periodStoredUnits over its weeks alone), any of whose
 * roots is the project filter's and whose goal is the goal filter's, by goal, each section's rows and the sections
 * most recently active first, "No goal" last. A row's numbers are its change's whole numbers, and a section's the sums
 * of its rows; a section is open when one of its changes was last active this week. `looseSessions` counts the
 * period's sessions in no change. With a scope, a change is listed only when its home is shown, named by the scope,
 * its hidden projects only in `otherCount`, its title and goal masked (maskText); `hidden` counts the changes it left
 * out.
 */
export function workView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  query: WorkQuery;
  now: Date;
  scope: Scope | null;
  names: Map<string, string>;
}): WorkResponse {
  const { query, scope, names } = input;
  const { changes, changeOf } = levels(input.runs, input.sessions);
  const inPeriod = periodStoredUnits(input.runs, input.sessions, { weeks: query.weeks }, input.now);
  const thisWeek = inPeriod.weeks.at(-1);
  const periodKeys = new Set([...inPeriod.runs, ...inPeriod.sessions].map((unit) => unit.key));
  const periodChanges = changes.filter((change) =>
    [...change.runs, ...change.sessions].some((unit) => periodKeys.has(unit.key)),
  );
  const isShown = (root: string) => !scope || scope.shown.has(projectKey(root));
  const nameOf = (root: string) => scope?.names.get(projectKey(root)) ?? names.get(root) ?? '';
  const byLatest = <T>(items: T[], at: (item: T) => string | null) => newestFirst(items, (item) => time(at(item)));

  const listed = periodChanges.filter(
    (change) =>
      (!query.project || change.roots.some((root) => projectKey(root) === query.project)) &&
      (!query.goal || (change.goal !== null && goalKey(change.goal) === query.goal)),
  );
  const sections = new Map<string | null, ChangeRow[]>();
  for (const change of listed.filter((c) => isShown(c.home))) {
    const others = change.roots.filter((root) => root !== change.home);
    sections.set(change.goal, [
      ...(sections.get(change.goal) ?? []),
      {
        key: change.key,
        title: maskText(scope, change.title),
        project: nameOf(change.home),
        otherProjects: others.filter(isShown).map(nameOf),
        otherCount: others.length,
        path: change.path,
        stage: change.stage,
        lastActivity: change.last,
        runs: change.runs.length,
        sessions: change.sessions.length,
        findings: change.findings,
        cost: change.cost,
      },
    ]);
  }

  const goals: GoalSection[] = [...sections].map(([goal, rows]) => ({
    key: goal === null ? null : goalKey(goal),
    name: maskText(scope, goal),
    open: rows.some((row) => !!row.lastActivity && weekOf(parseTime(row.lastActivity)) === thisWeek),
    changes: rows.length,
    runs: rows.reduce((sum, row) => sum + row.runs, 0),
    sessions: rows.reduce((sum, row) => sum + row.sessions, 0),
    cost: rows.reduce<number | null>((sum, row) => addKnown(sum, row.cost), null),
    lastActivity: latest(rows.map((row) => row.lastActivity)),
    rows: byLatest(rows, (row) => row.lastActivity),
  }));
  const goalNames = [...new Set(periodChanges.filter((c) => isShown(c.home)).flatMap((c) => c.goal ?? []))];

  return {
    goals: [
      ...byLatest(
        goals.filter((g) => g.key !== null),
        (g) => g.lastActivity,
      ),
      ...goals.filter((g) => g.key === null),
    ],
    looseSessions: inPeriod.sessions.filter((session) => !changeOf.has(session.key)).length,
    anyGoal: [...input.runs, ...input.sessions].some((unit) => !!unit.merged.goal),
    goalOptions: goalNames
      .map((name) => ({ key: goalKey(name), name: maskText(scope, name) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    hidden: listed.filter((change) => !isShown(change.home)).length,
  };
}
