import { useState } from 'react';
import { cn } from 'cn';
import type { FindingsQuery, RunTime, WeeksResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { GroupHead, NUM, Num, SUB } from '../components/Num.tsx';
import { Line, PageTitle, Section, State } from '../components/Panel.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Chart, CoverageNote, singleBars } from '../home/WeeklyCharts.tsx';
import { PATH_LABELS, countName, formatDollars, total, weekLabel } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';

type Week = WeeksResponse['weeks'][number];

const SUBS = [
  ...Object.values(PATH_LABELS),
  ...['critical', 'important', 'minor', 'unneeded'].map(countName),
  'Fable',
  'All models',
];

const RUN_TIMES: { key: keyof RunTime; label: string }[] = [
  { key: 'withWaves', label: 'With waves' },
  { key: 'withoutWaves', label: 'Without waves' },
];

/** The four small multiples, one measure each on its own axis, its unit in its title, the weeks oldest first as the
 * API gives them; the week table is their table view. */
function SmallMultiples({ weeks }: { weeks: Week[] }) {
  const names = weeks.map((w) => w.week);
  const charts = [
    { title: 'Runs', data: weeks.map((w) => total(w.runs)) },
    { title: 'Final review findings', data: weeks.map((w) => total(w.findings)) },
    { title: 'Estimated cost ($)', data: weeks.map((w) => w.cost), cost: true },
    // A duration is rounded to whole minutes first.
    {
      title: 'Time per run (min)',
      data: weeks.map((w) => (w.minutesPerRun === null ? null : Math.round(w.minutesPerRun))),
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      {charts.map((chart) => (
        <Chart
          key={chart.title}
          title={chart.title}
          option={singleBars(names, chart.title, chart.data, { cost: chart.cost })}
          height={180}
        />
      ))}
    </div>
  );
}

/** The week table, newest first for display, one value per cell under its group. */
function WeeksTable({ weeks }: { weeks: Week[] }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'By week table' }}>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Week</TableHead>
          <GroupHead span={3}>Runs</GroupHead>
          <TableHead rowSpan={2} className={NUM}>
            Tasks
          </TableHead>
          <GroupHead span={4}>Final review findings</GroupHead>
          <TableHead rowSpan={2} className={NUM}>
            Fix rounds
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Stops
          </TableHead>
          <GroupHead span={2}>Usage (points)</GroupHead>
          <TableHead rowSpan={2} className={NUM}>
            Est. cost ($)
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Time per run (min)
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Later fix commits
          </TableHead>
        </TableRow>
        <TableRow>
          {SUBS.map((column) => (
            <TableHead key={column} className={cn(SUB, NUM)}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {weeks.toReversed().map((w) => (
          <TableRow key={w.week}>
            <TableHead scope="row">{weekLabel(w.week)}</TableHead>
            {[
              w.runs.small,
              w.runs.full,
              w.runs.plan,
              w.tasks,
              w.findings.critical,
              w.findings.important,
              w.findings.minor,
              w.findings.unneeded,
              w.fixRounds,
              w.stops,
              w.fablePoints,
              w.allPoints,
            ].map((value, i) => (
              <TableCell key={i} className={NUM}>
                <Num value={value} />
              </TableCell>
            ))}
            <TableCell className={NUM}>
              <Num value={w.cost} format={formatDollars} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={w.minutesPerRun} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={w.laterFixes} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function RunTimeTable({ runTime }: { runTime: RunTime }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Full runs, with and without waves table' }}>
      <TableHeader>
        <TableRow>
          <TableHead>Kind</TableHead>
          {['Runs', 'With a run time', 'Median time (min)'].map((column) => (
            <TableHead key={column} className={NUM}>
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {RUN_TIMES.map(({ key, label }) => (
          <TableRow key={key}>
            <TableHead scope="row">{label}</TableHead>
            <TableCell className={NUM}>
              <Num value={runTime[key].runs} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={runTime[key].timed} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={runTime[key].medianMinutes} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * The Weeks page: the period's four small multiples, its weeks newest first, and its Full runs' run time, with and
 * without waves.
 */
export function WeeksPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 12 });
  const weeks = useLiveQuery<WeeksResponse>(listPath('/api/weeks', query));
  const projects = useProjects();
  const data = weeks.data;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Weeks</PageTitle>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })} />
      {weeks.isPending && <State>Loading the weeks…</State>}
      {weeks.isError && <State error>Couldn't load the weeks.</State>}
      {data && (
        <>
          <SmallMultiples weeks={data.weeks} />
          {data.weeks.every((w) => total(w.runs) === 0) && (
            <Line>No runs in this period. A week fills once a run that finished in it is imported.</Line>
          )}
          <CoverageNote coverageFrom={data.coverageFrom} firstWeek={data.weeks[0].week} />
          <Section title="By week">
            <WeeksTable weeks={data.weeks} />
          </Section>
          <Section title="Full runs, with and without waves">
            <RunTimeTable runTime={data.runTime} />
          </Section>
        </>
      )}
    </div>
  );
}
