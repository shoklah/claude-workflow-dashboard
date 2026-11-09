import {
  runFacts,
  splitSessionId,
  weekStart,
  type FindingRow,
  type RunEntry,
  type RunFacts,
  type RunResponse,
  type RunsQuery,
  type RunsResponse,
  type Step,
  type StepKind,
  type TimelineGroup,
  type TimelineStep,
} from '@cwd/shared';
import type { StoredUnit, StoredWarning } from '../db/read.ts';

const WEEK = 7 * 24 * 60 * 60 * 1000;

// A logged step whose kind the reporter gave; it always gives one.
type KnownStep = Step & { step: StepKind };

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

/**
 * The runs finished in the query's last `weeks` weeks (this week and the ones before it, weeks starting Sunday
 * 07:00 UTC) that match its path, project and "has warnings" (a stored run warning), newest first.
 */
export function runsList(
  runs: StoredUnit<RunEntry>[],
  warnings: StoredWarning[],
  query: RunsQuery,
  now: Date,
): RunsResponse {
  const rows = runs.map((run) => runFacts(run.merged));
  const from = weekStart(now).getTime() - (query.weeks - 1) * WEEK;
  const warned = new Set(warnings.filter((w) => w.kind === 'run').map((w) => w.key));
  // A stored run always has its finish time (finishedAt), the date its key is made from.
  const finished = (row: { finishedAt: string | null }) => Date.parse(row.finishedAt ?? '');
  return {
    runs: rows
      .filter((row) => finished(row) >= from)
      .filter((row) => !query.path || row.path === query.path)
      .filter((row) => !query.project || row.project === query.project)
      .filter((row) => !query.warnings || warned.has(row.key))
      .sort((a, b) => finished(b) - finished(a)),
    projects: [...new Set(rows.map((row) => row.project).filter(Boolean))].sort(),
  };
}

function findingRows(step: KnownStep): FindingRow[] {
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
  }));
}

function timelineSteps(steps: KnownStep[]): TimelineStep[] {
  return steps.map((step) => ({
    step: step.step,
    round: step.round ?? null,
    agent: step.agent ?? null,
    counts: step.counts ?? {},
    findings: findingRows(step),
  }));
}

/** A group with no tasks; `at` only for start and end. */
function group(kind: TimelineGroup['kind'], label: string, steps: KnownStep[] = [], at: string | null = null) {
  return { kind, label, at, tasks: [], steps: timelineSteps(steps) };
}

/**
 * The untimed timeline, in the workflow's order: start, plan, a group per wave (its tasks' steps, then its wave
 * check's steps), a group per task in no wave, simplify, final review, end. A plan, simplify or final group with no
 * steps is left out, except a run from before steps, which gets an empty final group between start and end.
 */
function timeline(run: RunEntry, steps: KnownStep[], facts: RunFacts): TimelineGroup[] {
  const start = group('start', 'Start', [], facts.startedAt);
  const end = group('end', 'End', [], facts.finishedAt);
  if (facts.beforeSteps) return [start, group('final', 'Final review'), end];
  const kinds = (...k: StepKind[]) => steps.filter((s) => k.includes(s.step));
  const ofTask = (task: number) => ({ task, steps: timelineSteps(steps.filter((s) => s.task === task)) });
  const waves = run.waves ?? [];
  const inWave = new Set(waves.flatMap((w) => w.tasks ?? []));
  const loose = [...new Set(steps.map((s) => s.task).filter((t) => t != null && !inWave.has(t)))] as number[];
  return [
    start,
    group('plan', 'Plan', kinds('plan_simplify', 'plan_review')),
    ...waves.map((w) => ({
      ...group('wave', `Wave ${w.wave ?? ''}`, steps.filter((s) => s.wave != null && s.wave === w.wave)),
      tasks: (w.tasks ?? []).map(ofTask),
    })),
    ...loose.sort((a, b) => a - b).map((task) => ({ ...group('task', `Task ${task}`), tasks: [ofTask(task)] })),
    group('simplify', 'Simplify', kinds('simplify')),
    group('final', 'Final review', kinds('final_review', 'final_fix_check')),
    end,
  ].filter((g) => !['plan', 'simplify', 'final'].includes(g.kind) || g.steps.length > 0);
}

/** One run: its facts, timeline and findings, its skills, models and advisor notes, and its stored warnings. */
export function runView(run: StoredUnit<RunEntry>, warnings: StoredWarning[]): RunResponse {
  const entry = run.merged;
  const facts = runFacts(entry);
  const steps = (entry.steps ?? []).filter((s): s is KnownStep => s.step != null);
  const calls = entry.advisor?.calls;
  const notes = entry.notes?.notes;
  return {
    facts,
    timeline: timeline(entry, steps, facts),
    findings: steps.flatMap(findingRows),
    skills: (entry.skills ?? []).map((s) => ({ name: s.name ?? '', outcome: skillOutcomeLabel(s.outcome) })),
    models: Object.entries(entry.models ?? {}).map(([model, m]) => ({ model, cost: m.cost ?? null })),
    advisor: calls != null && notes != null ? { calls, notes } : null,
    warnings: warnings
      .filter((w) => w.kind === 'run' && w.key === run.key)
      .map((w) => splitSessionId(w.text)),
  };
}
