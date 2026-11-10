import type { StepKind } from './report.ts';

// The app's finding categories, by the area of the step that found them. A label records the list's version, so a
// changed list makes the old labels stale.

export const CATEGORY_LIST_VERSION = 1;

export const AREAS = ['plan', 'implementation', 'cleanup'] as const;
export type Area = (typeof AREAS)[number];

const IMPLEMENTATION = [
  'correctness',
  'error handling',
  'data safety',
  'security and privacy',
  'reuse and duplication',
  'conventions',
  'simplicity',
  'tests',
  'naming and clarity',
  'performance',
  'docs',
] as const;

export const CATEGORIES: Record<Area, readonly string[]> = {
  plan: ['scope', 'task split and order', 'spec gap', 'risk missed', 'test plan'],
  implementation: IMPLEMENTATION,
  cleanup: IMPLEMENTATION,
};

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
