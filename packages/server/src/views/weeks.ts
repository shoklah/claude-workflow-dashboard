import type { FindingsQuery, RunEntry, RunTime, WeeksResponse } from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { coverageFrom, emptyWeek, median, weekSums } from './home.ts';
import { periodRuns } from './runs.ts';

/** Full runs with waves and without, as the reporter's run_time: how many, how many have minutes, and their median. */
export function runTime(runs: RunEntry[]): RunTime {
  const full = runs.filter((run) => run.record?.path === 'full');
  const group = (of: RunEntry[]) => {
    const minutes = of.map((run) => run.minutes ?? null);
    return { runs: of.length, timed: minutes.filter((m) => m !== null).length, medianMinutes: median(minutes) };
  };
  return {
    withWaves: group(full.filter((run) => (run.waves?.length ?? 0) > 0)),
    withoutWaves: group(full.filter((run) => !run.waves?.length)),
  };
}

/**
 * The Weeks page: over the stored runs in the query's period (period), each of its weeks' sums (weekSums), newest
 * first, a week with no runs empty, and the Full runs' run time. It holds no project text, so showing mode changes
 * nothing: its sums count every project, as every page's do.
 */
export function weeksView(input: { runs: StoredUnit<RunEntry>[]; query: FindingsQuery; now: Date }): WeeksResponse {
  const { weeks, runs } = periodRuns(input.runs, input.query, input.now);
  const sums = weekSums(runs);
  return {
    weeks: weeks.toReversed().map((week) => ({ week, ...(sums.get(week) ?? emptyWeek()) })),
    runTime: runTime(runs),
    coverageFrom: coverageFrom(input.runs),
  };
}
