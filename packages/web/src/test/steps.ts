import { STEP_KINDS, type StepRow, type StepsResponse } from '@cwd/shared';

// Invented answers of GET /api/steps for the Steps and rules page's stories.

const NO_TOKENS = { input: 0, output: 0, cache_read: 0, cache_write: 0 };

/** A step kind's row with nothing run. */
function idle(step: StepRow['step']): StepRow {
  const spend = step === 'simplify' ? { tokens: null, cost: null } : { tokens: NO_TOKENS, cost: 0 };
  return { step, ran: 0, found: 0, counts: {}, fixedOrApplied: 0, declined: 0, deferred: 0, openOrToOwner: 0, ...spend };
}

const tokens = (input: number, output: number, cache_read: number, cache_write: number) => ({
  input,
  output,
  cache_read,
  cache_write,
});

export const stepsFull: StepsResponse = {
  steps: [
    { step: 'plan_simplify', ran: 4, found: 4, counts: { cuts: 11, flags: 5 }, fixedOrApplied: 11, declined: 2, deferred: 0, openOrToOwner: 3, tokens: tokens(40_000, 18_000, 1_100_000, 60_000), cost: 4.1 },
    { step: 'plan_review', ran: 4, found: 3, counts: { findings: 9 }, fixedOrApplied: 7, declined: 2, deferred: 0, openOrToOwner: 0, tokens: tokens(60_000, 30_000, 1_800_000, 110_000), cost: 6.3 },
    { step: 'task_review', ran: 31, found: 22, counts: { critical: 1, important: 18, minor: 47 }, fixedOrApplied: 24, declined: 3, deferred: 38, openOrToOwner: 1, tokens: tokens(210_000, 90_000, 9_200_000, 300_000), cost: 21.4 },
    { step: 'fix_check', ran: 19, found: 3, counts: { fixed: 22, not_proportionate: 2, open: 1 }, fixedOrApplied: 0, declined: 0, deferred: 0, openOrToOwner: 0, tokens: tokens(50_000, 20_000, 2_400_000, 130_000), cost: 3.9 },
    { step: 'simplify', ran: 5, found: 5, counts: { applied: 14, skipped: 41 }, fixedOrApplied: 14, declined: 41, deferred: 0, openOrToOwner: 0, tokens: null, cost: null },
    { step: 'final_review', ran: 5, found: 5, counts: { critical: 0, important: 9, minor: 13, unneeded: 6 }, fixedOrApplied: 9, declined: 0, deferred: 13, openOrToOwner: 6, tokens: tokens(70_000, 40_000, 2_800_000, 190_000), cost: 12.8 },
    { step: 'final_fix_check', ran: 2, found: 2, counts: { fixed: 3, not_proportionate: 0, open: 0 }, fixedOrApplied: 0, declined: 0, deferred: 0, openOrToOwner: 0, tokens: tokens(8_000, 3_000, 400_000, 20_000), cost: 0.6 },
  ],
  rules: {
    failingTest: { passed: 22, failed: 1, no_tests: 1, couldnt_run: 2, exempt: 1 },
    fixRoundCap: { runs: 1, ruled: 2 },
    stopRule: 1,
    offers: {
      'grill-me': { offered: 3, accepted: 2, skipped: 1, not_offered: 0, updated: 0 },
      graphify: { offered: 3, accepted: 3, skipped: 0, not_offered: 1, updated: 0 },
    },
  },
  reporter: {
    source: 'reporter',
    dispatchGuard: { no_model: 2, no_simplify: 1 },
    advisor: { calls: 14, notes: 12, changed: 9, cost: 3.2, share: 7.8 },
    startup: { with: 38, without: 3 },
  },
};

/** Nothing ran in the period; the reporter's all-time figures still show. */
export const stepsEmpty: StepsResponse = {
  steps: STEP_KINDS.map(idle),
  rules: {
    failingTest: { passed: 0, failed: 0, no_tests: 0, couldnt_run: 0, exempt: 0 },
    fixRoundCap: { runs: 0, ruled: 0 },
    stopRule: 0,
    offers: {},
  },
  reporter: stepsFull.reporter,
};

/** An export from the old reporter, with no scoreboard: its figures are null. */
export const stepsOldReporter: StepsResponse = {
  ...stepsFull,
  reporter: { source: 'reporter', dispatchGuard: null, advisor: null, startup: null },
};
