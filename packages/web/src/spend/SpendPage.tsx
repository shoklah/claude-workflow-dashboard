import { useState } from 'react';
import type { FindingsQuery, SpendGroup, SpendResponse, SpendUnits } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Option } from '../findings/FindingsPage.tsx';
import { Chart, SPEND_GROUP_COLORS, barsOption } from '../home/WeeklyCharts.tsx';
import { SPEND_GROUP_LABELS, formatCost, plural, weekLabel } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';
import { SpendTable } from './SpendTable.tsx';

const TITLE = 'Estimated cost by week, by phase group';
const COST = 'text-right tabular-nums';
const UNITS: { units: SpendUnits; label: string }[] = [
  { units: 'all', label: 'All' },
  { units: 'runs', label: 'Runs' },
  { units: 'sessions', label: 'Sessions' },
];

/** The chart's table view: a row per week, oldest first as the chart reads, its cost by group, total and uncounted
 * units. */
function SpendWeeks({ response, groups }: { response: SpendResponse; groups: SpendGroup[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">The chart as a table</summary>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Weekly spend' }}>
        <TableHeader>
          <TableRow>
            <TableHead>Week</TableHead>
            {[...groups.map((group) => SPEND_GROUP_LABELS[group]), 'Total', 'Units not counted'].map((column) => (
              <TableHead key={column} className={COST}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {response.weeks.map((w) => (
            <TableRow key={w.week}>
              <TableHead scope="row">{weekLabel(w.week)}</TableHead>
              {groups.map((group) => (
                <TableCell key={group} className={COST}>
                  {formatCost(w.groups[group])}
                </TableCell>
              ))}
              <TableCell className={COST}>{formatCost(w.total)}</TableCell>
              <TableCell className={COST}>{w.uncounted.runs + w.uncounted.sessions}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}

/** The note under the chart, in the approved mockup's words. */
function SpendNote({ response }: { response: SpendResponse }) {
  const runs = response.weeks.reduce((sum, w) => sum + w.uncounted.runs, 0);
  const sessions = response.weeks.reduce((sum, w) => sum + w.uncounted.sessions, 0);
  const uncounted =
    runs + sessions > 0
      ? `Not counted: ${plural(runs + sessions, 'unit')} with no spend by phase (${plural(runs, 'run')}, ${plural(sessions, 'session')})` +
        (response.fullFrom === null ? '. ' : `; every week from ${weekLabel(response.fullFrom)} is fully counted. `)
      : '';
  return (
    <p className="text-sm text-muted-foreground">
      List-price estimates from the reporter; the five groups are the app's grouping of the reporter's phases. A week
      sums its runs, by finish, and its sessions, by start. Weeks and Home count runs only; this page also counts
      sessions. Unattributed is spend outside any workflow step, mostly in sessions with no run. {uncounted}Advisor cost
      is counted apart, in its own columns below.
      {response.unpriced && " Spend on a model with no price isn't counted."}
    </p>
  );
}

/**
 * The Spend page: the period's estimated cost by week stacked by phase group, its note and table view, and the period's
 * spend by phase and model; the "Units" switch sums all units, runs or sessions, locked on runs under a path filter,
 * since sessions have no path.
 */
export function SpendPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 12 });
  const [units, setUnits] = useState<SpendUnits>('all');
  const shown = query.path ? 'runs' : units;
  const spend = useLiveQuery<SpendResponse>(listPath('/api/spend', { ...query, units: shown }));
  const projects = useProjects();
  const data = spend.data;
  const groups = data?.groups.map((row) => row.group) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Spend</h1>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })}>
        <div role="group" aria-label="Units" className="flex gap-1">
          {UNITS.map((option) => (
            <Option
              key={option.units}
              pressed={shown === option.units}
              onClick={() => setUnits(option.units)}
              disabledReason={query.path && option.units !== 'runs' ? 'Sessions have no path' : undefined}
            >
              {option.label}
            </Option>
          ))}
        </div>
      </ListFilters>
      {spend.isPending && <p className="text-sm text-muted-foreground">Loading the spend…</p>}
      {spend.isError && <p className="text-sm">Couldn't load the spend.</p>}
      {data && data.groups.every((row) => row.phases.length === 0) && (
        <p className="text-sm">No spend by phase in this period.</p>
      )}
      {data && data.groups.some((row) => row.phases.length > 0) && (
        <>
          <Chart
            title={TITLE}
            option={barsOption(
              data.weeks.map((w) => w.week),
              groups.map((group) => ({
                name: SPEND_GROUP_LABELS[group],
                data: data.weeks.map((w) => w.groups[group]),
                color: SPEND_GROUP_COLORS[group],
              })),
              { stack: 'spend', cost: true, totals: true, legendRoom: 28 },
            )}
            height={260}
          />
          <SpendNote response={data} />
          <SpendWeeks response={data} groups={groups} />
          <SpendTable response={data} />
        </>
      )}
    </div>
  );
}
