import type { StepKind } from './report.ts';

// The areas a finding's step belongs to, each with its own category list, and the labeller's relevance calls. The
// category lists themselves are the workflow's, from the export (the server's activeList).

export const AREAS = ['plan', 'implementation', 'cleanup'] as const;
export type Area = (typeof AREAS)[number];

export const RELEVANCE = ['valid', 'invalid', 'unclear'] as const;
export type Relevance = (typeof RELEVANCE)[number];

const STEP_AREAS: Record<StepKind, Area> = {
  plan_simplify: 'plan',
  plan_review: 'plan',
  task_review: 'implementation',
  fix_check: 'implementation',
  final_review: 'implementation',
  final_fix_check: 'implementation',
  simplify: 'cleanup',
};

/** The area of the step that found a finding, which picks its category list. */
export function areaOf(step: StepKind): Area {
  return STEP_AREAS[step];
}
