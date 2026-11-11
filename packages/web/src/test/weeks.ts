import type { WeekRow, WeeksResponse } from '@cwd/shared';

// Invented answers of GET /api/weeks for the Weeks page's stories: twelve weeks, oldest first as the API gives them.

const WEEKS = [
  '2026-08-23',
  '2026-08-30',
  '2026-09-06',
  '2026-09-13',
  '2026-09-20',
  '2026-09-27',
  '2026-10-04',
  '2026-10-11',
  '2026-10-18',
  '2026-10-25',
  '2026-11-01',
  '2026-11-08',
];

const empty: WeekRow = {
  runs: { small: 0, full: 0, plan: 0 },
  tasks: 0,
  findings: { critical: 0, important: 0, minor: 0, unneeded: 0 },
  fixRounds: 0,
  stops: 0,
  fablePoints: null,
  allPoints: null,
  cost: null,
  minutesPerRun: null,
  laterFixes: 0,
};

/** A week with runs: its paths' runs and final review findings as given, the rest made up from them. */
function week(
  runs: WeekRow['runs'],
  findings: WeekRow['findings'],
  more: Partial<WeekRow> = {},
): WeekRow {
  const count = runs.small + runs.full + runs.plan;
  return {
    runs,
    tasks: runs.full * 4 + runs.small,
    findings,
    fixRounds: runs.full * 2 + runs.small,
    stops: 0,
    fablePoints: count * 2,
    allPoints: count,
    cost: count * 5.5,
    minutesPerRun: 140,
    laterFixes: 0,
    ...more,
  };
}

const ROWS: WeekRow[] = [
  empty,
  empty,
  empty,
  empty,
  // Before the reporter's coverage: no window, so no cost or points.
  week({ small: 1, full: 0, plan: 0 }, { critical: 0, important: 0, minor: 0, unneeded: 0 }, {
    cost: null,
    fablePoints: null,
    allPoints: null,
    minutesPerRun: 50,
  }),
  empty,
  week({ small: 0, full: 1, plan: 0 }, { critical: 0, important: 1, minor: 2, unneeded: 0 }, {
    cost: null,
    fablePoints: null,
    allPoints: null,
    minutesPerRun: 135,
  }),
  week({ small: 2, full: 0, plan: 0 }, { critical: 0, important: 0, minor: 1, unneeded: 0 }, { minutesPerRun: 35 }),
  week({ small: 1, full: 2, plan: 0 }, { critical: 0, important: 2, minor: 4, unneeded: 2 }, { minutesPerRun: 190 }),
  week({ small: 2, full: 1, plan: 1 }, { critical: 1, important: 1, minor: 3, unneeded: 0 }),
  week({ small: 3, full: 1, plan: 0 }, { critical: 0, important: 2, minor: 5, unneeded: 1 }, { stops: 1, minutesPerRun: 165.5 }),
  week({ small: 4, full: 2, plan: 1 }, { critical: 0, important: 3, minor: 8, unneeded: 0 }, { laterFixes: 1, cost: 38.4 }),
];

/** Full: runs in most weeks, the reporter's coverage starting in the week of Oct 11. */
export const weeksFull: WeeksResponse = {
  weeks: WEEKS.map((w, i) => ({ week: w, ...ROWS[i] })),
  runTime: {
    withWaves: { runs: 3, timed: 3, medianMinutes: 150 },
    withoutWaves: { runs: 4, timed: 3, medianMinutes: 185.4 },
  },
  coverageFrom: '2026-10-13T09:00:00Z',
};

/** Empty: twelve weeks with no runs, and no coverage known. */
export const weeksEmpty: WeeksResponse = {
  weeks: WEEKS.map((w) => ({ week: w, ...empty })),
  runTime: {
    withWaves: { runs: 0, timed: 0, medianMinutes: null },
    withoutWaves: { runs: 0, timed: 0, medianMinutes: null },
  },
  coverageFrom: null,
};
