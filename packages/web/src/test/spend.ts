import type { SpendGroup, SpendGroupRow, SpendPhase, SpendResponse, SpendRow, SpendWeek } from '@cwd/shared';

// Invented answers of GET /api/spend for the Spend page's stories, after the approved mockup: eight weeks, oldest first
// as the API gives them, three priced models and a fourth the reporter has no price for.

const MODELS = ['claude-opus-5-5', 'claude-fable-5-2', 'claude-haiku-5-5', 'claude-nova-1'];
const TOTAL = 763;

/** A row: its cost by priced model (the unpriced model null), its share of the period's total, its advisor. */
function row([opus, fable, haiku]: number[], [calls, advisor]: number[]): SpendRow {
  const cost = opus + fable + haiku;
  return {
    cost,
    share: (cost / TOTAL) * 100,
    byModel: { [MODELS[0]]: opus, [MODELS[1]]: fable, [MODELS[2]]: haiku, [MODELS[3]]: null },
    advisor: { calls, cost: advisor },
  };
}

const phase = (name: string, models: number[], advisor: number[]): SpendPhase => ({ name, ...row(models, advisor) });

function group(name: SpendGroup, models: number[], advisor: number[], phases: SpendPhase[]): SpendGroupRow {
  return { group: name, ...row(models, advisor), phases };
}

// A week: its cost by group (plan, implement, review, coordination, unattributed) and its uncounted units.
function week(w: string, [plan, implement, review, coordination, unattributed]: number[], runs = 0, sessions = 0): SpendWeek {
  return {
    week: w,
    groups: { plan, implement, review, coordination, unattributed },
    total: plan + implement + review + coordination + unattributed,
    uncounted: { runs, sessions },
  };
}

export const spendFull: SpendResponse = {
  weeks: [
    week('2026-09-20', [14, 31, 12, 9, 6], 3),
    week('2026-09-27', [18, 38, 17, 11, 9], 0, 1),
    week('2026-10-04', [9, 22, 8, 6, 14]),
    week('2026-10-11', [22, 44, 19, 13, 8]),
    week('2026-10-18', [25, 52, 24, 15, 7]),
    week('2026-10-25', [17, 36, 15, 10, 11]),
    week('2026-11-01', [28, 47, 22, 14, 9]),
    week('2026-11-08', [21, 40, 18, 12, 10]),
  ],
  groups: [
    group('plan', [50, 104, 0], [13, 8], [
      phase('design', [17, 41, 0], [9, 6]),
      phase('plan_writing', [11, 36, 0], [4, 2]),
      phase('plan_simplify', [19, 0, 0], [0, 0]),
      phase('plan_review', [3, 27, 0], [0, 0]),
    ]),
    group('implement', [301, 6, 3], [31, 17], [phase('implement', [301, 6, 3], [31, 17])]),
    group('review', [123, 12, 0], [2, 1], [
      phase('task_review', [44, 0, 0], [0, 0]),
      phase('fix_check', [17, 0, 0], [0, 0]),
      phase('simplify', [21, 0, 0], [2, 1]),
      phase('final_review', [29, 12, 0], [0, 0]),
      phase('final_fix_check', [12, 0, 0], [0, 0]),
    ]),
    group('coordination', [82, 8, 0], [14, 8], [phase('coordination', [82, 8, 0], [14, 8])]),
    group('unattributed', [49, 22, 3], [6, 4], [phase('unattributed', [49, 22, 3], [6, 4])]),
  ],
  total: { ...row([605, 152, 6], [66, 38]), share: null },
  models: MODELS,
  unpriced: true,
  fullFrom: '2026-10-04',
  uncounted: { runs: 3, sessions: 1 },
};

/** Full, but Unattributed holds one phase only, a name the app doesn't know. */
export const spendUnknownPhase: SpendResponse = {
  ...spendFull,
  groups: spendFull.groups.map((g) =>
    g.group === 'unattributed' ? { ...g, phases: [{ ...g.phases[0], name: 'deploy_check' }] } : g,
  ),
};

const ZERO: SpendRow = { cost: 0, share: null, byModel: {}, advisor: { calls: 0, cost: 0 } };
const GROUPS: SpendGroup[] = ['plan', 'implement', 'review', 'coordination', 'unattributed'];

/** Eight weeks with nothing counted: zeros, no model, no phase. */
export const spendEmpty: SpendResponse = {
  weeks: spendFull.weeks.map((w) => week(w.week, [0, 0, 0, 0, 0])),
  groups: GROUPS.map((g) => ({ group: g, ...ZERO, phases: [] })),
  total: ZERO,
  models: [],
  unpriced: false,
  fullFrom: '2026-09-20',
  uncounted: { runs: 0, sessions: 0 },
};

/** Empty, with two runs of the last week that have no spend by phase. */
export const spendUncounted: SpendResponse = {
  ...spendEmpty,
  weeks: spendEmpty.weeks.map((w, i) => (i === spendEmpty.weeks.length - 1 ? week(w.week, [0, 0, 0, 0, 0], 2) : w)),
  fullFrom: null,
  uncounted: { runs: 2, sessions: 0 },
};

/** Spend on one model only, which the reporter has no price for: every cost 0 and every share null. */
const UNPRICED: SpendRow = { cost: 0, share: null, byModel: { [MODELS[3]]: null }, advisor: { calls: 0, cost: 0 } };
export const spendUnpriced: SpendResponse = {
  ...spendEmpty,
  groups: GROUPS.map((g) => ({
    group: g,
    ...UNPRICED,
    phases: g === 'implement' || g === 'unattributed' ? [{ name: g, ...UNPRICED }] : [],
  })),
  total: UNPRICED,
  models: [MODELS[3]],
  unpriced: true,
};
