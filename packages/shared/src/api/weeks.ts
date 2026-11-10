import type { Path } from '../report.ts';

/** One week's sums over its runs, as the reporter's week_rows: runs by path, the summed tasks, final review findings,
 * fix rounds and stops, the summed known Fable and all points (null when none is known), the priced cost (null when
 * no run has models), the median of the known minutes (null when none is known) and the later fix commits. */
export type WeekRow = {
  runs: Record<Path, number>;
  tasks: number;
  findings: { critical: number; important: number; minor: number; unneeded: number };
  fixRounds: number;
  stops: number;
  fablePoints: number | null;
  allPoints: number | null;
  cost: number | null;
  minutesPerRun: number | null;
  laterFixes: number;
};

/** Full runs with waves and without, as the reporter's run_time: how many, how many have a run time, and their median
 * minutes (null when none has one). */
export type RunTime = Record<'withWaves' | 'withoutWaves', { runs: number; timed: number; medianMinutes: number | null }>;

/** `GET /api/weeks`: the period's weeks, newest first, each with its sums; the period's Full run time; and the earliest
 * finish time of the runs whose transcript the reporter could read. */
export type WeeksResponse = { weeks: (WeekRow & { week: string })[]; runTime: RunTime; coverageFrom: string | null };
