import {
  addKnown,
  foundFindings,
  modelsCost,
  parseTime,
  projectRoot,
  runFacts,
  sessionRootOf,
  weekOf,
  type ChangeResponse,
  type ChangeRow,
  type GoalResponse,
  type GoalSection,
  type GraphEdge,
  type GraphNode,
  type HeldRun,
  type RunEntry,
  type SessionEntry,
  type SessionGraphData,
  type SpecRef,
  type WorkQuery,
  type WorkResponse,
  type WorkSessionRow,
  type WorkStep,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { changeKey, goalKey, projectKey } from '../keys.ts';
import { periodStoredUnits, rootOf, storedFacts } from './runs.ts';
import { maskText, showFacts, showSession, type Scope } from './scope.ts';
import { heldRuns, sessionFacts, sessionRow, shownSession } from './sessions.ts';

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

/** Each goal's name with its changes' home roots and its loose sessions' roots (sessionRootOf), for showing mode's
 * hidden goal names (scopeOf, forbiddenStrings). */
export function goalHomes(levels: Levels): Map<string, string[]> {
  const homes = new Map<string, string[]>();
  const add = (goal: string | null | undefined, root: string | null) => {
    if (goal && root) homes.set(goal, [...new Set([...(homes.get(goal) ?? []), root])]);
  };
  for (const { goal, home } of levels.changes) add(goal, home);
  for (const { merged } of levels.loose) add(merged.goal, sessionRootOf(merged.project));
  return homes;
}

/** Whether showing mode shows a root: always without a scope. */
function shownRoot(scope: Scope | null, root: string): boolean {
  return !scope || scope.shown.has(projectKey(root));
}

/** A root's project name: the scope's, else the stored one; null for a root no stored run has ("other project"), as
 * sessionFacts names a session's. */
function rootName(scope: Scope | null, names: Map<string, string>, root: string): string | null {
  return scope?.names.get(projectKey(root)) ?? names.get(root) ?? null;
}

/** A change's row: its whole totals, its title masked (maskText), its home named, its other projects the shown, named
 * ones by name and every one in the count. */
function changeRow(change: Change, scope: Scope | null, names: Map<string, string>): ChangeRow {
  const others = change.roots.filter((root) => root !== change.home);
  return {
    key: change.key,
    title: maskText(scope, change.title),
    project: rootName(scope, names, change.home),
    otherProjects: others
      .filter((root) => shownRoot(scope, root))
      .flatMap((root) => rootName(scope, names, root) ?? []),
    otherCount: others.length,
    path: change.path,
    stage: change.stage,
    lastActivity: change.last,
    runs: change.runs.length,
    sessions: change.sessions.length,
    findings: change.findings,
    cost: change.cost,
  };
}

/** A unit's change as Work lists it: null when it has none or, with a scope, when its change's home isn't shown. */
export function listedChange(
  levels: Levels,
  scope: Scope | null,
  unitKey: string,
): { key: string; title: string } | null {
  const change = levels.changeOf.get(unitKey);
  return change && shownRoot(scope, change.home) ? { key: change.key, title: maskText(scope, change.title) } : null;
}

/** A unit's goal (goalOf) as Work lists it: null when it has none or, with a scope, when none of the goal's homes
 * (goalHomes) is shown. */
export function listedGoal(
  levels: Levels,
  scope: Scope | null,
  unitKey: string,
): { key: string; name: string } | null {
  const goal = levels.goalOf(unitKey);
  if (!goal || !(goalHomes(levels).get(goal) ?? []).some((root) => shownRoot(scope, root))) return null;
  return { key: goalKey(goal), name: maskText(scope, goal) };
}

/**
 * The links between dated sessions: a session's `started_by` naming a stored session (`how` 'handoff' a handoff, any
 * other a start), then a handoff to a stored session its own or a held run's `context.handoff_to` names; one edge per
 * pair, a `started_by` winning.
 */
function sessionEdges(dated: StoredUnit<SessionEntry>[], held: Map<string, StoredUnit<RunEntry>[]>): GraphEdge[] {
  const stored = new Set(dated.map((s) => s.key));
  const edges = new Map<string, GraphEdge>();
  const add = (from: string, to: string, how: GraphEdge['how']) => {
    const pair = `${from}|${to}`;
    if (from !== to && stored.has(from) && stored.has(to) && !edges.has(pair)) edges.set(pair, { from, to, how });
  };
  for (const s of dated) {
    const by = s.merged.started_by;
    if (by) add(by.key, s.key, by.how === 'handoff' ? 'handoff' : 'started');
  }
  for (const s of dated) {
    for (const unit of [s, ...(held.get(s.merged.file) ?? [])]) {
      const to = unit.merged.context?.handoff_to;
      if (to) add(s.key, to, 'handoff');
    }
  }
  return [...edges.values()];
}

/** What a change's or goal's page reads: the levels, the dated sessions in start order, their edges and held runs. */
type Pages = {
  levels: Levels;
  scope: Scope | null;
  names: Map<string, string>;
  runRoots: Set<string>;
  held: Map<string, StoredUnit<RunEntry>[]>;
  dated: StoredUnit<SessionEntry>[];
  edges: GraphEdge[];
};

function pagesOf(
  runs: StoredUnit<RunEntry>[],
  sessions: StoredUnit<SessionEntry>[],
  scope: Scope | null,
  names: Map<string, string>,
): Pages {
  const held = heldRuns(runs);
  const dated = sessions.filter((s) => s.merged.start).sort((a, b) => time(a.merged.start) - time(b.merged.start));
  const edges = sessionEdges(dated, held);
  return { levels: levels(runs, sessions), scope, names, runRoots: new Set(runs.map(rootOf)), held, dated, edges };
}

/** A session's newest held run that showing mode shows (showFacts), by its headline (masked) and branch. */
function shownRun(pages: Pages, session: StoredUnit<SessionEntry>): HeldRun | null {
  for (const run of newestFirst(pages.held.get(session.merged.file) ?? [], runTime)) {
    const facts = showFacts(pages.scope, storedFacts(run, pages.names));
    if (facts) return { key: run.key, title: maskText(pages.scope, run.merged.headline ?? null), branch: facts.branch };
  }
  return null;
}

const shownSessions = (pages: Pages, keys: Set<string>) =>
  pages.dated.filter((s) => keys.has(s.key) && showSession(pages.scope, s.merged.project));

/** A shown session's row: sessionRow's facts, its step, its starter (the edge into it; key and title null when
 * shownSession hides it), its newest shown held run and its listed change. */
function workRow(pages: Pages, unit: StoredUnit<SessionEntry>): WorkSessionRow {
  const { key, title, start, end, minutes, models, cost } = sessionRow(unit, pages.runRoots, pages.names, pages.scope);
  const starter = pages.edges.find((edge) => edge.to === unit.key);
  const from = starter && pages.dated.find((s) => s.key === starter.from);
  const shown = from && shownSession(from.merged, pages.runRoots, pages.names, pages.scope);
  return {
    key,
    title,
    start,
    end,
    minutes,
    models,
    cost,
    step: stepOf(pages.held.get(unit.merged.file) ?? []),
    startedBy: starter ? (shown ? { key: starter.from, title: shown.title } : { key: null, title: null }) : null,
    run: shownRun(pages, unit),
    change: listedChange(pages.levels, pages.scope, key),
  };
}

/** Where a session of the other lane belongs, seen from a page of `goal`: another goal, else another change, by
 * listedGoal and listedChange ('unlisted' when Work doesn't list it), else no change. */
function elsewhereOf(pages: Pages, key: string, goal: string | null): GraphNode['elsewhere'] {
  const { levels, scope } = pages;
  const own = levels.goalOf(key);
  if (own && own !== goal) {
    const listed = listedGoal(levels, scope, key);
    return listed ? { kind: 'goal', name: listed.name } : { kind: 'unlisted' };
  }
  if (levels.changeOf.has(key)) {
    const listed = listedChange(levels, scope, key);
    return listed ? { kind: 'change', title: listed.title } : { kind: 'unlisted' };
  }
  return { kind: 'none' };
}

/**
 * The session graph of a page's `members`, with the sessions linked to them (by an edge from a member, or with
 * `either` into one too): a member in one of `changes` (listed, in lane order) sits in its change's lane, a member in
 * no change in No change, any other in the other lane titled `other`, saying where it belongs (elsewhereOf). Lanes
 * without a box are left out; with a scope, the sessions showSession doesn't hold are left out with their edges and
 * counted in `hidden`.
 */
function graphOf(
  pages: Pages,
  members: Set<string>,
  either: boolean,
  changes: Change[],
  other: string,
  goal: string | null,
): SessionGraphData {
  const linked = pages.edges
    .filter((edge) => members.has(edge.from) || (either && members.has(edge.to)))
    .flatMap((edge) => [edge.from, edge.to]);
  const all = new Set([...members, ...linked]);
  const nodes = shownSessions(pages, all);
  const hidden = pages.dated.filter((s) => all.has(s.key)).length - nodes.length;
  const laneOf = (key: string): { key: string | null; title: string; kind: 'change' | 'none' | 'other' } => {
    const change = pages.levels.changeOf.get(key);
    if (members.has(key) && change && changes.includes(change)) {
      return { key: change.key, title: maskText(pages.scope, change.title), kind: 'change' };
    }
    if (members.has(key) && !change) return { key: null, title: 'No change', kind: 'none' };
    return { key: null, title: other, kind: 'other' };
  };
  const placed = nodes.map((unit) => ({ unit, lane: laneOf(unit.key) }));
  const rank = (lane: { key: string | null; kind: string }) => {
    if (lane.kind === 'change') return changes.findIndex((c) => c.key === lane.key);
    return lane.kind === 'none' ? changes.length : changes.length + 1;
  };
  const lanes = [...new Map(placed.map(({ lane }) => [`${lane.kind}|${lane.key}`, lane])).values()].sort(
    (a, b) => rank(a) - rank(b),
  );
  const index = (lane: { key: string | null; kind: string }) =>
    lanes.findIndex((l) => l.kind === lane.kind && l.key === lane.key);
  const shown = new Set(nodes.map((s) => s.key));
  return {
    lanes,
    nodes: placed.map(({ unit, lane }) => ({
      key: unit.key,
      title: sessionFacts(unit.merged, pages.runRoots, pages.names, pages.scope).title,
      step: stepOf(pages.held.get(unit.merged.file) ?? []),
      run: shownRun(pages, unit),
      lane: index(lane),
      elsewhere: lane.kind === 'other' ? elsewhereOf(pages, unit.key, goal) : null,
    })),
    edges: pages.edges.filter((edge) => shown.has(edge.from) && shown.has(edge.to)),
    hidden,
  };
}

/**
 * A change's page: its facts and whole totals, its graph (its sessions in its lane, the sessions of other changes
 * linked to them either way in "Other changes"), its shown runs (showFacts, newest first) and its shown dated sessions;
 * null for an unknown key or, with a scope, a change Work doesn't list (its home isn't shown).
 */
export function changeView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  key: string;
  scope: Scope | null;
  names: Map<string, string>;
}): ChangeResponse | null {
  const { scope, names } = input;
  const pages = pagesOf(input.runs, input.sessions, scope, names);
  const change = pages.levels.changes.find((c) => c.key === input.key);
  if (!change || !shownRoot(scope, change.home)) return null;
  const row = changeRow(change, scope, names);
  const members = new Set(change.sessions.map((s) => s.key));
  return {
    key: change.key,
    title: row.title,
    goal: listedGoal(pages.levels, scope, (change.runs[0] ?? change.sessions[0])!.key),
    project: row.project,
    otherProjects: row.otherProjects,
    otherCount: row.otherCount,
    path: change.path,
    stage: change.stage,
    spec: change.spec ? maskText(scope, change.spec.path.split('/').at(-1) ?? '') : null,
    startedAt: change.start,
    lastActivity: change.last,
    sessionCount: change.sessions.length,
    runCount: change.runs.length,
    cost: change.cost,
    graph: graphOf(pages, members, true, [change], 'Other changes', change.goal),
    runs: newestFirst(change.runs, runTime).flatMap((run) => showFacts(scope, storedFacts(run, names)) ?? []),
    sessions: shownSessions(pages, members).map((unit) => workRow(pages, unit)),
  };
}

/**
 * A goal's page: its facts and whole totals (its changes', plus its sessions in no change), its graph (a lane per
 * listed change with a box, in order of the change's start, then No change, then "Other goals" for the sessions its
 * sessions started), its listed changes in that order and its shown dated sessions; null for an unknown key or, with
 * a scope, a goal none of whose homes (goalHomes) is shown.
 */
export function goalView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  key: string;
  scope: Scope | null;
  names: Map<string, string>;
}): GoalResponse | null {
  const { scope, names } = input;
  const pages = pagesOf(input.runs, input.sessions, scope, names);
  const homes = goalHomes(pages.levels);
  const goal = [...homes.keys()].find((name) => goalKey(name) === input.key);
  if (!goal || !homes.get(goal)!.some((root) => shownRoot(scope, root))) return null;
  const startOf = (change: Change) => (change.start ? time(change.start) : Infinity);
  const changes = pages.levels.changes.filter((c) => c.goal === goal).sort((a, b) => startOf(a) - startOf(b));
  const listed = changes.filter((c) => shownRoot(scope, c.home));
  const loose = pages.levels.loose.filter((s) => s.merged.goal === goal);
  const looseRoots = loose.flatMap((s) => sessionRootOf(s.merged.project) ?? []);
  const members = new Set([...changes.flatMap((c) => c.sessions), ...loose].map((s) => s.key));
  return {
    key: input.key,
    name: maskText(scope, goal),
    projects: [...new Set([...changes.flatMap((c) => c.roots), ...looseRoots])]
      .filter((root) => shownRoot(scope, root))
      .flatMap((root) => rootName(scope, names, root) ?? [])
      .sort(),
    startedAt: earliest([...changes.map((c) => c.start), ...loose.map((s) => s.merged.start)]),
    lastActivity: latest([...changes.map((c) => c.last), ...loose.map((s) => s.merged.end)]),
    changeCount: changes.length,
    runCount: changes.reduce((sum, c) => sum + c.runs.length, 0),
    sessionCount: changes.reduce((sum, c) => sum + c.sessions.length, 0) + loose.length,
    findings: changes.reduce<number | null>((sum, c) => addKnown(sum, c.findings), null),
    cost: [...changes.map((c) => c.cost), ...loose.map((s) => modelsCost(s.merged.models))].reduce<number | null>(
      (sum, cost) => addKnown(sum, cost),
      null,
    ),
    graph: graphOf(pages, members, false, listed, 'Other goals', goal),
    changes: listed.map((change) => changeRow(change, scope, names)),
    sessions: shownSessions(pages, members).map((unit) => workRow(pages, unit)),
  };
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
  const isShown = (root: string) => shownRoot(scope, root);
  const byLatest = <T>(items: T[], at: (item: T) => string | null) => newestFirst(items, (item) => time(at(item)));

  const listed = periodChanges.filter(
    (change) =>
      (!query.project || change.roots.some((root) => projectKey(root) === query.project)) &&
      (!query.goal || (change.goal !== null && goalKey(change.goal) === query.goal)),
  );
  const sections = new Map<string | null, ChangeRow[]>();
  for (const change of listed.filter((c) => isShown(c.home))) {
    sections.set(change.goal, [...(sections.get(change.goal) ?? []), changeRow(change, scope, names)]);
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
