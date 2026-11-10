import { useState } from 'react';
import type { FindingsQuery, RunTime, RunsResponse, WeeksResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Chart, CoverageNote, singleBars } from '../home/WeeklyCharts.tsx';
import { NONE, formatCost, formatMinutes, nonZeroCountsLabel, weekLabel } from '../lib/format.ts';
import { ListFilters, listPath } from '../runs/RunsPage.tsx';

type Week = WeeksResponse['weeks'][number];

// The static page's "Whole workflow" columns.
const COLUMNS = [
  'Week',
  'Runs',
  'Tasks',
  'Findings',
  'Fix rounds',
  'Stops',
  'Fable points',
  'All points',
  'Estimated dollars',
  'Minutes per run',
  'Later fix commits',
];

const RUN_TIMES: { key: keyof RunTime; label: string }[] = [
  { key: 'withWaves', label: 'with waves' },
  { key: 'withoutWaves', label: 'without waves' },
];

const sum = (counts: Record<string, number>) => Object.values(counts).reduce((n, c) => n + c, 0);

/** The four small multiples, one measure each on its own axis, the weeks oldest first; the week table is their table
 * view. */
function SmallMultiples({ weeks }: { weeks: Week[] }) {
  const oldestFirst = weeks.toReversed();
  const names = oldestFirst.map((w) => w.week);
  const charts = [
    { title: 'Runs', data: oldestFirst.map((w) => sum(w.runs)) },
    { title: 'Final review findings', data: oldestFirst.map((w) => sum(w.findings)) },
    { title: 'Estimated dollars', data: oldestFirst.map((w) => w.cost), cost: true },
    // A duration is rounded to whole minutes first.
    {
      title: 'Minutes per run',
      data: oldestFirst.map((w) => (w.minutesPerRun === null ? null : Math.round(w.minutesPerRun))),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {charts.map((chart) => (
        <Chart
          key={chart.title}
          title={chart.title}
          option={singleBars(names, chart.title, chart.data, chart.cost)}
          height={180}
        />
      ))}
    </div>
  );
}

function WeeksTable({ weeks }: { weeks: Week[] }) {
  return (
    <Table aria-label="Weeks" containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Weeks' }}>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {weeks.map((w) => (
          <TableRow key={w.week}>
            <TableHead scope="row">{weekLabel(w.week)}</TableHead>
            <TableCell>{nonZeroCountsLabel(w.runs)}</TableCell>
            <TableCell>{w.tasks}</TableCell>
            <TableCell>{nonZeroCountsLabel(w.findings)}</TableCell>
            <TableCell>{w.fixRounds}</TableCell>
            <TableCell>{w.stops}</TableCell>
            <TableCell>{w.fablePoints ?? NONE}</TableCell>
            <TableCell>{w.allPoints ?? NONE}</TableCell>
            <TableCell>{formatCost(w.cost)}</TableCell>
            <TableCell>{formatMinutes(w.minutesPerRun)}</TableCell>
            <TableCell>{w.laterFixes}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RunTimeTable({ runTime }: { runTime: RunTime }) {
  return (
    <Table aria-label="Full runs" className="w-auto">
      <TableHeader>
        <TableRow>
          {['Full runs', 'Runs', 'With a run time', 'Median minutes'].map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {RUN_TIMES.map(({ key, label }) => (
          <TableRow key={key}>
            <TableHead scope="row">{label}</TableHead>
            <TableCell>{runTime[key].runs}</TableCell>
            <TableCell>{runTime[key].timed}</TableCell>
            <TableCell>{formatMinutes(runTime[key].medianMinutes)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The Weeks page (the static page's "Whole workflow"): the period's four small multiples, its weeks newest first in
 * the static page's columns, and its Full runs' run time, with and without waves.
 */
export function WeeksPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 12 });
  const weeks = useLiveQuery<WeeksResponse>(listPath('/api/weeks', query));
  // The project options: every project of the longest period.
  const runs = useLiveQuery<RunsResponse>(listPath('/api/runs', { weeks: 52 }));
  const data = weeks.data;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Weeks</h1>
      <ListFilters
        query={query}
        projects={runs.data?.projects}
        onChange={(change) => setQuery({ ...query, ...change })}
      />
      {weeks.isPending && <p className="text-sm text-muted-foreground">Loading the weeks…</p>}
      {weeks.isError && <p className="text-sm">Couldn't load the weeks.</p>}
      {data && (
        <>
          <SmallMultiples weeks={data.weeks} />
          <p className="text-sm text-muted-foreground">
            Findings here are the final review's, as the reporter counts them per week.
          </p>
          {data.weeks.every((w) => sum(w.runs) === 0) && <p className="text-sm">No runs in this period.</p>}
          <CoverageNote coverageFrom={data.coverageFrom} firstWeek={data.weeks.at(-1)!.week} />
          <WeeksTable weeks={data.weeks} />
          <RunTimeTable runTime={data.runTime} />
        </>
      )}
    </div>
  );
}
