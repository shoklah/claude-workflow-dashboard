import type { RunFacts } from '@cwd/shared';

/** Shown where a fact is missing (null, or a record from before steps). */
export const NONE = '–';

/** A run's name: its project and branch. */
export function runName(run: Pick<RunFacts, 'project' | 'branch'>): string {
  return run.branch === null ? run.project : `${run.project} · ${run.branch}`;
}

/** Minutes as "25 min" or "2 h 10". */
export function duration(minutes: number | null): string {
  if (minutes === null) return NONE;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

/** An estimated cost in dollars. */
export function dollars(cost: number | null): string {
  return cost === null ? NONE : `$${cost.toFixed(2)}`;
}

/** "14 · 12 closed"; "–" for a record from before steps, which has no findings to count. */
export function findingsLabel(run: Pick<RunFacts, 'findings' | 'beforeSteps'>): string {
  if (run.beforeSteps) return NONE;
  // closed: acted on + not acted on, the findings with an outcome other than open.
  const closed = run.findings.actedOn + run.findings.notActedOn;
  return `${run.findings.total} · ${closed} closed`;
}

/** A step's kind as words: `task_review` as "task review". */
export function stepLabel(step: string): string {
  return step.replaceAll('_', ' ');
}
