import { useState } from 'react';
import type { FindingsQuery, RunTime, WeeksResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Chart, CoverageNote, singleBars } from '../home/WeeklyCharts.tsx';
import { formatCost, formatCount, formatMinutes, nonZeroCountsLabel, total, weekLabel } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';

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


/** The four small multiples, one measure each on its own axis, the weeks oldest first as the API gives them; the week
 * table is their table view. */
function SmallMultiples({ weeks }: { weeks: Week[] }) {
  const names = weeks.map((w) => w.week);
  const charts = [
    { title: 'Runs', data: weeks.map((w) => total(w.runs)) },
    { title: 'Final review findings', data: weeks.map((w) => total(w.findings)) },
    { title: 'Estimated dollars', data: weeks.map((w) => w.cost), cost: true },
    // A duration is rounded to whole minutes first.
    {
      title: 'Minutes per run',
      data: weeks.map((w) => (w.minutesPerRun === null ? null : Math.round(w.minutesPerRun))),
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

/** The week table, newest first for display. */
function WeeksTable({ weeks }: { weeks: Week[] }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Weeks' }}>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {weeks.toReversed().map((w) => (
          <TableRow key={w.week}>
            <TableHead scope="row">{weekLabel(w.week)}</TableHead>
            <TableCell>{nonZeroCountsLabel(w.runs)}</TableCell>
            <TableCell>{w.tasks}</TableCell>
            <TableCell>{nonZeroCountsLabel(w.findings)}</TableCell>
            <TableCell>{w.fixRounds}</TableCell>
            <TableCell>{w.stops}</TableCell>
            <TableCell>{formatCount(w.fablePoints)}</TableCell>
            <TableCell>{formatCount(w.allPoints)}</TableCell>
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
  const projects = useProjects();
  const data = weeks.data;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Weeks</h1>
      <ListFilters
        query={query}
        projects={projects}
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
          {data.weeks.every((w) => total(w.runs) === 0) && <p className="text-sm">No runs in this period.</p>}
          <CoverageNote coverageFrom={data.coverageFrom} firstWeek={data.weeks[0].week} />
          <WeeksTable weeks={data.weeks} />
          <RunTimeTable runTime={data.runTime} />
        </>
      )}
    </div>
  );
}
