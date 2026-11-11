import type { ComplianceResponse, ComplianceWarning } from '@cwd/shared';
import { fullRun, smallRun } from './runs.ts';

// Invented answers of GET /api/compliance for the Compliance page's stories: four weeks, each cell's count matching
// the warnings listed in it.

const WEEKS = ['2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'];

/** A run's warning as the page lists it, in `fullRun` unless given. */
function warning(
  w: Pick<ComplianceWarning, 'kind' | 'family' | 'week' | 'text'> & Partial<ComplianceWarning>,
  run: typeof fullRun = fullRun,
): ComplianceWarning {
  return { sessionId: null, runKey: run.key, project: run.project, branch: run.branch, step: null, isNew: false, ...w };
}

export const complianceEmpty: ComplianceResponse = {
  weeks: WEEKS,
  rows: [],
  newWarnings: 0,
  warnings: [],
  hidden: 0,
  information: null,
};

/**
 * Every family but skills and offers, then "other": a kind the dashboard doesn't know and the row of warnings stored
 * with no kind. "step has no agent id" holds the grid's largest count, and its Nov 8 warning is new; the Nov 8
 * startup warning is a session's. The reporter writes three information lines.
 */
export const complianceFull: ComplianceResponse = {
  weeks: WEEKS,
  rows: [
    { family: 'review_flow', kind: 'final_review_without_simplify', cells: [1, 0, 0, 0] },
    { family: 'review_flow', kind: 'plan_review_without_simplify', cells: [0, 0, 1, 0] },
    { family: 'steps_record', kind: 'step_agent_missing', cells: [0, 0, 2, 1] },
    { family: 'agents_models', kind: 'model_less_dispatch', cells: [0, 1, 0, 0] },
    { family: 'sessions', kind: 'startup_missing', cells: [0, 0, 0, 1] },
    { family: 'other', kind: 'brand_new_check', cells: [0, 0, 0, 1] },
    { family: 'other', kind: null, cells: [1, 0, 0, 0] },
  ],
  newWarnings: 2,
  warnings: [
    warning({
      kind: 'final_review_without_simplify',
      family: 'review_flow',
      week: '2026-10-18',
      text: 'WARN: feat/search (2026-10-20): final review without simplify: final_review at step 4',
      step: 'final_review',
    }),
    warning({
      kind: 'plan_review_without_simplify',
      family: 'review_flow',
      week: '2026-11-01',
      text: 'WARN: feat/search (2026-11-03): plan review without plan-simplifier: plan review 1',
      step: 'plan_review',
    }),
    warning(
      {
        kind: 'step_agent_missing',
        family: 'steps_record',
        week: '2026-11-01',
        text: 'WARN: feat/import (2026-11-02): task_review step 2 has no agent id',
        step: 'task_review',
      },
      smallRun,
    ),
    warning(
      {
        kind: 'step_agent_missing',
        family: 'steps_record',
        week: '2026-11-01',
        text: 'WARN: feat/import (2026-11-02): task_review step 3 has no agent id',
        step: 'task_review',
      },
      smallRun,
    ),
    warning({
      kind: 'step_agent_missing',
      family: 'steps_record',
      week: '2026-11-08',
      text: 'WARN: feat/search (2026-11-10): final_review step 0 has no agent id',
      step: 'final_review',
      isNew: true,
    }),
    warning({
      kind: 'model_less_dispatch',
      family: 'agents_models',
      week: '2026-10-25',
      text: 'WARN: feat/search (2026-10-27): model-less general-purpose dispatch launched: Explore the router',
    }),
    {
      kind: 'startup_missing',
      family: 'sessions',
      week: '2026-11-08',
      text: 'WARN: session {session}: startup guidelines missing',
      sessionId: '5f0c9a1e-7d2b-4c3a-9e8f-0a1b2c3d4e5f',
      runKey: null,
      project: null,
      branch: null,
      step: null,
      isNew: true,
    },
    warning({
      kind: 'brand_new_check',
      family: 'other',
      week: '2026-11-08',
      text: 'WARN: feat/search (2026-11-11): a check from a later reporter flagged this run',
    }),
    warning({ kind: null, family: 'other', week: '2026-10-18', text: 'WARN: feat/search (2026-10-19): an older warning' }),
  ],
  hidden: 0,
  information: {
    lines: [
      'atlas feat/search: the handoff came 12 calls after the cap',
      'inline sweeps: 2',
      'over the cap without a handoff: 1 transcripts',
    ],
    hidden: 0,
    source: 'reporter',
  },
};

/**
 * Showing mode's answer to the same period: no "other" rows, the list without the session's and "other" warnings, and
 * those three counted in `hidden`; the three information lines hidden and counted.
 */
export const complianceShowing: ComplianceResponse = {
  ...complianceFull,
  rows: complianceFull.rows.filter((row) => row.family !== 'other'),
  warnings: complianceFull.warnings.filter((w) => w.family !== 'other' && w.sessionId === null),
  hidden: 3,
  information: { lines: [], hidden: 3, source: 'reporter' },
};
