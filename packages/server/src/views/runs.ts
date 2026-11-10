import {
  parseTime,
  projectNames,
  projectRoot,
  runFacts,
  weekOf,
  weekStart,
  type Finding,
  type FindingRow,
  type RunEntry,
  type RunFacts,
  type RunResponse,
  type RunsQuery,
  type RunsResponse,
  type SessionEntry,
  type Step,
  type StepKind,
  type TimelineGroup,
  type TimelineStep,
} from '@cwd/shared';
import { categoryLabels, type ActiveList } from '../categories.ts';
import { findingKey, type StoredLabel } from '../db/labels.ts';
import type { StoredUnit, StoredWarning } from '../db/read.ts';
import { projectKey } from '../keys.ts';
import { maskText, showFacts, showSession, showWarning, type Scope } from './scope.ts';

const WEEK = 7 * 24 * 60 * 60 * 1000;

// A logged step whose kind the reporter gave; it always gives one.
type KnownStep = Step & { step: StepKind };


// A finding's label fields: the workflow's it carries, and the app's.
type LabelOf = (
  finding: Finding,
) => Pick<FindingRow, 'category' | 'validity' | 'judge' | 'relevance' | 'labelReason' | 'appCategory' | 'appRelevance'>;

/** What a skill's outcome says, never the outcome itself: a string other than 'ran' is a file path. */
export function skillOutcomeLabel(outcome: unknown): string {
  if (outcome === 'ran') return 'ran';
  if (typeof outcome === 'string') return 'wrote a file';
  if (outcome === true) return 'record written';
  if (outcome === false) return 'no record';
  if (Array.isArray(outcome)) return `${outcome.length} results`;
  if (typeof outcome === 'object' && outcome !== null && 'applied' in outcome && 'skipped' in outcome) {
    const { applied, skipped } = outcome;
    if (typeof applied === 'number' && typeof skipped === 'number') return `applied ${applied}, skipped ${skipped}`;
  }
  return '–';
}

/** A stored run's project root. */
export function rootOf(unit: StoredUnit<RunEntry>): string {
  return projectRoot(unit.merged.record?.project ?? '');
}

/** A session's project root, from its project; null with no project. */
export function sessionRootOf(project: string | null | undefined): string | null {
  return project ? projectRoot(project) : null;
}

/**
 * A session's project key from its project (sessionRootOf), only when that root is one of `runRoots`, the stored runs'
 * roots (rootOf); else null, "other project".
 */
export function sessionProjectKey(project: string | null | undefined, runRoots: Set<string>): string | null {
  const root = sessionRootOf(project);
  return root && runRoots.has(root) ? projectKey(root) : null;
}

/** The display name of every stored run's project, by root. */
export function storedNames(runs: StoredUnit<RunEntry>[]): Map<string, string> {
  return projectNames(runs.map(rootOf));
}

/** Every stored run's branch, by its project root. */
export function storedBranches(runs: StoredUnit<RunEntry>[]): Map<string, string[]> {
  const branches = new Map<string, string[]>();
  for (const run of runs) {
    const root = rootOf(run);
    const list = branches.get(root) ?? [];
    list.push(run.merged.record?.branch ?? '');
    branches.set(root, list);
  }
  return branches;
}

/** Every stored session's project root, for a session with a project. */
export function storedSessionRoots(sessions: StoredUnit<SessionEntry>[]): string[] {
  return [...new Set(sessions.flatMap(({ merged: { project } }) => sessionRootOf(project) ?? []))];
}

/** A stored run's facts: runFacts plus its stored key, its project's key and its project's name from `names`. */
export function storedFacts(unit: StoredUnit<RunEntry>, names: Map<string, string>): RunFacts {
  const root = rootOf(unit);
  return { ...runFacts(unit.merged), key: unit.key, projectKey: projectKey(root), project: names.get(root) ?? '' };
}

/**
 * The stored warnings that are current, those the latest export still reports: a run's, the texts in its latest
 * merged `warns`, and a session's, the texts in its latest merged `warns` while the latest export holds the session;
 * the store only gives their first-seen times.
 */
export function currentWarnings(
  runs: StoredUnit<RunEntry>[],
  sessions: StoredUnit<SessionEntry>[],
  warnings: StoredWarning[],
): StoredWarning[] {
  const warns = {
    run: new Map(runs.map((run) => [run.key, run.merged.warns ?? []])),
    session: new Map(sessions.filter((s) => s.missingSince === null).map((s) => [s.key, s.merged.warns ?? []])),
  };
  return warnings.filter((w) => warns[w.kind].get(w.key)?.includes(w.text) ?? false);
}

/** Whether a stored session's warning is listed under `scope`: showSession of the session's project, by its key. */
export function sessionWarningShown(scope: Scope | null, sessions: StoredUnit<SessionEntry>[]): (key: string) => boolean {
  const projects = new Map(sessions.map((unit) => [unit.key, unit.merged.project]));
  return (key) => showSession(scope, projects.get(key));
}

/**
 * A query's period: its last `weeks` weeks (this week and the ones before it, weeks starting Sunday 07:00 UTC), oldest
 * first, each named by weekOf, whether a run's facts match the query's path and project key (`filters`), and whether
 * they are in it (`matches`): finished in one of those weeks, and matching the filters.
 */
export function period(
  query: Pick<RunsQuery, 'weeks' | 'path' | 'project'>,
  now: Date,
): {
  weeks: string[];
  filters: (row: Pick<RunFacts, 'path' | 'projectKey'>) => boolean;
  matches: (row: RunFacts) => boolean;
} {
  const start = weekStart(now).getTime();
  const weeks = Array.from({ length: query.weeks }, (_, i) => weekOf(new Date(start - (query.weeks - 1 - i) * WEEK)));
  const filters = (row: Pick<RunFacts, 'path' | 'projectKey'>) =>
    (!query.path || row.path === query.path) && (!query.project || row.projectKey === query.project);
  // A stored run always has its finish time (finishedAt), the date its key is made from.
  const matches = (row: RunFacts) => weeks.includes(weekOf(parseTime(row.finishedAt ?? ''))) && filters(row);
  return { weeks, filters, matches };
}

/** Adds `n` to a count record's `key`. */
export function addCount(counts: Record<string, number>, key: string, n = 1): void {
  counts[key] = (counts[key] ?? 0) + n;
}

/** The stored runs in the query's period (period), as their merged entries, and its weeks. */
export function periodRuns(
  runs: StoredUnit<RunEntry>[],
  query: Pick<RunsQuery, 'weeks' | 'path' | 'project'>,
  now: Date,
): { weeks: string[]; runs: RunEntry[] } {
  const { weeks, matches } = period(query, now);
  const names = storedNames(runs);
  return { weeks, runs: runs.filter((unit) => matches(storedFacts(unit, names))).map((unit) => unit.merged) };
}

/** The stored sessions that started in one of `weeks` (a period's weeks); a session with no start is in none. */
export function periodSessions(sessions: StoredUnit<SessionEntry>[], weeks: string[]): StoredUnit<SessionEntry>[] {
  return sessions.filter(({ merged: { start } }) => !!start && weeks.includes(weekOf(parseTime(start))));
}

/**
 * The query's period's units, as their merged entries: its runs (periodRuns) and its sessions (periodSessions) that
 * match period's filters, a session having no path, so a path filter leaves every session out, and its project's key
 * from its root (sessionRootOf) when that is a stored run's root, else '', which no project filter matches; and its
 * weeks.
 */
export function periodUnits(
  runs: StoredUnit<RunEntry>[],
  sessions: StoredUnit<SessionEntry>[],
  query: Pick<RunsQuery, 'weeks' | 'path' | 'project'>,
  now: Date,
): { weeks: string[]; runs: RunEntry[]; sessions: SessionEntry[] } {
  const { filters } = period(query, now);
  const { weeks, runs: inPeriod } = periodRuns(runs, query, now);
  const runRoots = new Set(runs.map(rootOf));
  const kept = ({ project }: SessionEntry) =>
    filters({ path: null, projectKey: sessionProjectKey(project, runRoots) ?? '' });
  return { weeks, runs: inPeriod, sessions: periodSessions(sessions, weeks).map((unit) => unit.merged).filter(kept) };
}

/**
 * The runs in the query's period (period) that have a current run warning when it asks "has warnings", newest first,
 * and every stored run's project, by name. With a scope, only the shown projects' runs and projects, and `hidden`
 * counts the matching runs it left out.
 */
export function runsList(
  runs: StoredUnit<RunEntry>[],
  warnings: StoredWarning[],
  query: RunsQuery,
  now: Date,
  scope: Scope | null,
): RunsResponse {
  const names = storedNames(runs);
  const all = runs.map((run) => storedFacts(run, names));
  const rows = all.flatMap((row) => showFacts(scope, row) ?? []);
  const inPeriod = period(query, now).matches;
  const warned = new Set(currentWarnings(runs, [], warnings).map((w) => w.key));
  const finished = (row: { finishedAt: string | null }) => parseTime(row.finishedAt ?? '').getTime();
  const matches = (row: RunFacts) => inPeriod(row) && (!query.warnings || warned.has(row.key));
  const shown = rows.filter(matches);
  return {
    runs: shown.sort((a, b) => finished(b) - finished(a)),
    projects: [...new Map(rows.filter((row) => row.project).map((row) => [row.projectKey, row.project]))]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    hidden: all.filter(matches).length - shown.length,
  };
}

function findingRows(step: KnownStep, labelOf: LabelOf): FindingRow[] {
  return (step.findings ?? []).map((f) => ({
    id: f.id ?? null,
    step: step.step,
    task: step.task ?? null,
    wave: step.wave ?? null,
    round: step.round ?? null,
    closedRound: f.closed_round ?? null,
    severity: f.severity ?? null,
    kind: f.kind ?? null,
    summary: f.summary ?? null,
    outcome: f.outcome ?? null,
    reason: f.reason ?? null,
    verdicts: f.verdicts ?? [],
    ...labelOf(f),
  }));
}

function timelineSteps(steps: KnownStep[], labelOf: LabelOf): TimelineStep[] {
  return steps.map((step) => ({
    step: step.step,
    round: step.round ?? null,
    agent: step.agent ?? null,
    counts: step.counts ?? {},
    findings: findingRows(step, labelOf),
  }));
}

/** A group with no tasks; `at` only for start and end. */
function group(
  kind: TimelineGroup['kind'],
  label: string,
  labelOf: LabelOf,
  steps: KnownStep[] = [],
  at: string | null = null,
) {
  return { kind, label, at, tasks: [], steps: timelineSteps(steps, labelOf) };
}

/**
 * The untimed timeline, in the workflow's order: start, plan, a group per wave (its tasks' steps, then its wave
 * check's steps), a group per task in no wave, simplify, final review, end. A plan, simplify or final group with no
 * steps is left out, except a run from before steps, which gets an empty final group between start and end.
 */
function timeline(run: RunEntry, steps: KnownStep[], facts: RunFacts, labelOf: LabelOf): TimelineGroup[] {
  const start = group('start', 'Start', labelOf, [], facts.startedAt);
  const end = group('end', 'End', labelOf, [], facts.finishedAt);
  if (facts.beforeSteps) return [start, group('final', 'Final review', labelOf), end];
  const kinds = (...k: StepKind[]) => steps.filter((s) => k.includes(s.step));
  const ofTask = (task: number) => ({ task, steps: timelineSteps(steps.filter((s) => s.task === task), labelOf) });
  const waves = run.waves ?? [];
  const inWave = new Set(waves.flatMap((w) => w.tasks ?? []));
  const loose = [...new Set(steps.map((s) => s.task).filter((t) => t != null && !inWave.has(t)))] as number[];
  return [
    start,
    group('plan', 'Plan', labelOf, kinds('plan_simplify', 'plan_review')),
    ...waves.map((w) => ({
      ...group('wave', `Wave ${w.wave ?? ''}`, labelOf, steps.filter((s) => s.wave != null && s.wave === w.wave)),
      tasks: (w.tasks ?? []).map(ofTask),
    })),
    ...loose
      .sort((a, b) => a - b)
      .map((task) => ({ ...group('task', `Task ${task}`, labelOf), tasks: [ofTask(task)] })),
    group('simplify', 'Simplify', labelOf, kinds('simplify')),
    group('final', 'Final review', labelOf, kinds('final_review', 'final_fix_check')),
    end,
  ].filter((g) => !['plan', 'simplify', 'final'].includes(g.kind) || g.steps.length > 0);
}

/** One run: its facts, timeline and findings, each with the workflow's label, which wins, and the app's from `labels`
 * (currentLabels), its review steps' strengths, its skills, models and advisor notes, its current warnings, and the
 * display labels of `list`'s (the active list's) categories; its project's name from `names`, every stored run's
 * (storedNames), so it agrees with the Runs list. With a scope, null for a hidden project's run, else its project
 * named by the scope and its findings' texts, label reasons and strengths' summaries masked (maskText). */
export function runView(
  run: StoredUnit<RunEntry>,
  warnings: StoredWarning[],
  names: Map<string, string>,
  scope: Scope | null,
  labels: Map<string, StoredLabel>,
  list: ActiveList | null,
): RunResponse | null {
  const entry = run.merged;
  const facts = showFacts(scope, storedFacts(run, names));
  if (!facts) return null;
  const steps = (entry.steps ?? [])
    .filter((s): s is KnownStep => s.step != null)
    .map((s) => ({
      ...s,
      findings: s.findings?.map((f) => ({
        ...f,
        kind: maskText(scope, f.kind),
        summary: maskText(scope, f.summary),
        reason: maskText(scope, f.reason),
        verdicts: f.verdicts?.map((v) => maskText(scope, v)),
      })),
      strengths: s.strengths?.map((strength) => ({ ...strength, summary: maskText(scope, strength.summary) })),
    }));
  const labelOf: LabelOf = (f) => {
    const label = f.id ? labels.get(findingKey(run.key, f.id)) : undefined;
    const workflow = f.category ?? null;
    const validity = f.validity ?? null;
    return {
      category: workflow ?? label?.category ?? null,
      validity,
      judge: workflow !== null ? 'workflow' : label ? 'app' : null,
      relevance: label?.relevance ?? null,
      labelReason: maskText(scope, label?.reason ?? null),
      appCategory: workflow !== null && label && label.category !== workflow ? label.category : null,
      appRelevance: validity !== null && label && label.relevance !== validity ? label.relevance : null,
    };
  };
  const calls = entry.advisor?.calls;
  const notes = entry.notes?.notes;
  return {
    facts,
    timeline: timeline(entry, steps, facts, labelOf),
    findings: steps.flatMap((step) => findingRows(step, labelOf)),
    strengths: steps.flatMap((s) =>
      (s.strengths ?? []).map((strength) => ({
        step: s.step,
        task: s.task ?? null,
        round: s.round ?? null,
        category: strength.category ?? null,
        summary: strength.summary ?? null,
      })),
    ),
    skills: (entry.skills ?? []).map((s) => ({ name: s.name ?? '', outcome: skillOutcomeLabel(s.outcome) })),
    models: Object.entries(entry.models ?? {}).map(([model, m]) => ({ model, cost: m.cost ?? null })),
    advisor: calls != null && notes != null ? { calls, notes } : null,
    warnings: currentWarnings([run], [], warnings).map((w) => showWarning(scope, w.text)),
    categoryLabels: categoryLabels(list),
  };
}
