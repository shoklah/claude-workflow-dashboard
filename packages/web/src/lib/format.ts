import type { FindingSplit, StepKind } from '@cwd/shared';

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

/** A cost in dollars, or a dash when it isn't known. */
export function formatCost(cost: number | null): string {
  return cost === null ? '–' : `$${cost.toFixed(2)}`;
}

/** A duration: "25 min", "2 h", "2 h 10 min". */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** A count with its noun, plural unless it is 1: "1 run", "2 runs". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** The findings' split as the tiles and the feed read it: "13 acted on · 1 open". */
export function actedOnSplit(findings: FindingSplit): string {
  return `${findings.actedOn} acted on · ${findings.open} open`;
}
