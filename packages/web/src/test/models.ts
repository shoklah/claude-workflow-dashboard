import type { ModelsResponse } from '@cwd/shared';

// Invented answers of GET /api/models for the Models and advisor page's stories.

const STAGES = { full: 'opus-5-5/medium', plan: 'fable-5-1', small: 'opus-5-5' };
const stageTable = (want: string, first: string | null = want) => ({ '1': first, '2': want, '3': want, out: want });

/** Three agents, one off its request, main sessions on two paths, and two weeks of advisor spend, one past the stop
 * share. */
export const modelsFull: ModelsResponse = {
  agents: [
    { name: 'final-reviewer', requested: { '-/xhigh': 5 }, actual: { 'fable-5-1/xhigh': 4, 'opus-5-5/xhigh': 1 }, mismatches: 1 },
    { name: 'implementer', requested: { 'opus-5-5/medium': 22 }, actual: { 'opus-5-5/medium': 22 }, mismatches: 0 },
    { name: 'task-reviewer', requested: { '-/-': 31 }, actual: { 'opus-5-5/high': 31 }, mismatches: 0 },
  ],
  mismatchesSource: 'reporter',
  main: [
    { path: 'small', recommended: stageTable(STAGES.small, null), actual: {}, differs: 0 },
    { path: 'full', recommended: stageTable(STAGES.full), actual: { 'opus-5-5/medium': 5 }, differs: 0 },
    { path: 'plan', recommended: stageTable(STAGES.plan), actual: { 'opus-5-5/high': 2, 'fable-5-1/high': 2 }, differs: 2 },
  ],
  stageSource: 'reporter',
  advisor: {
    source: 'reporter',
    facts: {
      calls: 14,
      tokens: { input: 31_000, output: 12_500, cache_read: 0, cache_write: 0 },
      cost: 3.2,
      byRole: {
        implementer: { calls: 3, flagged: false },
        main: { calls: 9, flagged: false },
        'task-reviewer': { calls: 2, flagged: true },
      },
      failed: { overloaded_error: 1 },
      notes: 12,
      changed: 9,
      missing: 2,
      trial: 'runs 8/5, weeks 0/3 CHECKPOINT',
    },
    weeks: [
      { week: '2026-11-01', advisor: 9.8, fable: 25.1, share: 39.04, stop: true },
      { week: '2026-11-08', advisor: 3.2, fable: 41, share: 7.8, stop: false },
    ],
  },
};

/** Nothing ran in the period; the reporter's stage table and advisor facts still show. */
export const modelsEmpty: ModelsResponse = {
  ...modelsFull,
  agents: [],
  main: modelsFull.main.map((row) => ({ ...row, actual: {} })),
  advisor: { ...modelsFull.advisor, weeks: [] },
};

/** An export from the old reporter, with no models or advisor totals: its figures are null. */
export const modelsOldReporter: ModelsResponse = {
  ...modelsFull,
  agents: modelsFull.agents.map((row) => ({ ...row, mismatches: null })),
  main: modelsFull.main.map((row) => ({ ...row, recommended: null, differs: null })),
  advisor: { source: 'reporter', facts: null, weeks: [] },
};
