import type { FindingSplit, RunFacts, StepKind } from '@cwd/shared';

/** Shown where a fact is missing (null, or a record from before steps). */
export const NONE = '–';

/** A step kind's name on screen. */
export const STEP_LABELS: Record<StepKind, string> = {
  plan_simplify: 'Plan simplify',
  plan_review: 'Plan review',
  task_review: 'Task review',
  fix_check: 'Fix-check',
  simplify: 'simplify',
  final_review: 'Final review',
  final_fix_check: 'Final fix-check',
};

/** A key of a step's count line as words: `not_proportionate` as "not proportionate". */
export function countLabel(key: string): string {
  return key.replaceAll('_', ' ');
}

/** A cost in dollars, or a dash when it isn't known. */
export function formatCost(cost: number | null): string {
  return cost === null ? NONE : `$${cost.toFixed(2)}`;
}

/** A duration, rounded to whole minutes: "25 min", "2 h 10", "2 h 05"; a dash when it isn't known. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return NONE;
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`;
}

/** The parts of a line that are known, joined: "atlas · feat/search · full". */
export function joined(parts: (string | null)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/** A run's name: its project and branch, as far as they are known. */
export function runName(run: { project: string | null; branch: string | null }): string {
  return joined([run.project, run.branch]);
}

/** "14 · 12 closed"; "–" for a record from before steps, which has no findings to count. */
export function findingsLabel(run: Pick<RunFacts, 'findings' | 'beforeSteps'>): string {
  if (run.beforeSteps) return NONE;
  // closed: acted on + not acted on, the findings with an outcome other than open.
  const closed = run.findings.actedOn + run.findings.notActedOn;
  return `${run.findings.total} · ${closed} closed`;
}

/** A count with its noun, plural unless it is 1: "1 run", "2 runs". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** The findings' split as the tiles and the feed read it: "13 acted on · 1 open". */
export function actedOnSplit(findings: FindingSplit): string {
  return `${findings.actedOn} acted on · ${findings.open} open`;
}
