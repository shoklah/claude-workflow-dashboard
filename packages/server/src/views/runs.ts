import {
  parseTime,
  projectNames,
  projectRoot,
  runFacts,
  weekOf,
  weekStart,
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
import { maskText, showFacts, showWarning, type Scope } from './scope.ts';

const WEEK = 7 * 24 * 60 * 60 * 1000;

// A logged step whose kind the reporter gave; it always gives one.
type KnownStep = Step & { step: StepKind };

type Finding = NonNullable<Step['findings']>[number];

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

/**
 * A query's period: its last `weeks` weeks (this week and the ones before it, weeks starting Sunday 07:00 UTC), oldest
 * first, each named by weekOf, whether a run's facts match the query's path and project key (`filters`), and whether
 * they are in it (`matches`): finished in one of those weeks, and matching the filters.
 */
export function period(
  query: Pick<RunsQuery, 'weeks' | 'path' | 'project'>,
  now: Date,
): { weeks: string[]; filters: (row: RunFacts) => boolean; matches: (row: RunFacts) => boolean } {
  const start = weekStart(now).getTime();
  const weeks = Array.from({ length: query.weeks }, (_, i) => weekOf(new Date(start - (query.weeks - 1 - i) * WEEK)));
  const filters = (row: RunFacts) =>
    (!query.path || row.path === query.path) && (!query.project || row.projectKey === query.project);
  // A stored run always has its finish time (finishedAt), the date its key is made from.
  const matches = (row: RunFacts) => weeks.includes(weekOf(parseTime(row.finishedAt ?? ''))) && filters(row);
  return { weeks, filters, matches };
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
  const mask = (text: string | null | undefined) => (scope && text ? maskText(scope, text) : text);
  const steps = (entry.steps ?? [])
    .filter((s): s is KnownStep => s.step != null)
    .map((s) => ({
      ...s,
      findings: s.findings?.map((f) => ({
        ...f,
        kind: mask(f.kind),
        summary: mask(f.summary),
        reason: mask(f.reason),
        verdicts: f.verdicts?.map((v) => mask(v) ?? v),
      })),
      strengths: s.strengths?.map((strength) => ({ ...strength, summary: mask(strength.summary) })),
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
      labelReason: mask(label?.reason) ?? null,
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
    warnings: currentWarnings([run], [], warnings)
      .map((w) => showWarning(scope, w.text)),
    categoryLabels: categoryLabels(list),
  };
}
