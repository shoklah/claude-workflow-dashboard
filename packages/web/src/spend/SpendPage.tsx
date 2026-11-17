import { useState } from 'react';
import type { FindingsQuery, SpendGroup, SpendResponse, SpendUnits } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { NUM, Num } from '../components/Num.tsx';
import { Option, Options } from '../components/Option.tsx';
import { Details, PageTitle, State } from '../components/Panel.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Chart, SPEND_GROUP_COLORS, barsOption } from '../home/WeeklyCharts.tsx';
import { SPEND_GROUP_LABELS, formatDollars, spendUncountedLabel, total, weekLabel } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';
import { SpendTable } from './SpendTable.tsx';

const TITLE = 'Estimated cost by week, by phase group ($)';
const UNITS: { units: SpendUnits; label: string }[] = [
  { units: 'all', label: 'All' },
  { units: 'runs', label: 'Runs' },
  { units: 'sessions', label: 'Sessions' },
];

/** The chart's table view: a row per week, oldest first as the chart reads, its cost by group, total and uncounted
 * units. */
function SpendWeeks({ response, groups }: { response: SpendResponse; groups: SpendGroup[] }) {
  const columns = [...groups.map((group) => `${SPEND_GROUP_LABELS[group]} ($)`), 'Total ($)', 'Runs and sessions not counted'];
  return (
    <Details summary="The chart as a table">
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Weekly spend' }}>
        <TableHeader>
          <TableRow>
            <TableHead>Week</TableHead>
            {columns.map((column) => (
              <TableHead key={column} className={NUM}>
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
                <TableCell key={group} className={NUM}>
                  <Num value={w.groups[group]} format={formatDollars} />
                </TableCell>
              ))}
              <TableCell className={NUM}>
                <Num value={w.total} format={formatDollars} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={total(w.uncounted)} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Details>
  );
}

/** How spend is counted, in the approved mockup's words, folded under the table. */
function SpendNote({ response }: { response: SpendResponse }) {
  return (
    <Details summary="How spend is counted">
      <p className="max-w-prose">
        List-price estimates from the reporter; the five groups are the app's grouping of the reporter's phases. A week
        sums its runs, by finish, and its sessions, by start. Weeks and Home count runs only; this page also counts
        sessions. Unattributed is spend outside any workflow step, mostly in sessions with no run. Advisor cost is
        counted apart, in its own columns.
        {response.unpriced && " Spend on a model with no price isn't counted."}
      </p>
      {total(response.uncounted) > 0 && (
        <p className="max-w-prose">{spendUncountedLabel(response.uncounted, response.fullFrom)}</p>
      )}
    </Details>
  );
}

/**
 * The Spend page: the period's estimated cost by week stacked by phase group, its table view, the period's spend by
 * phase and model, and how spend is counted; the "Count" switch sums all units, runs or sessions, locked on runs under
 * a path filter, since sessions have no path.
 */
export function SpendPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 12 });
  const [units, setUnits] = useState<SpendUnits>('all');
  const shown = query.path ? 'runs' : units;
  const spend = useLiveQuery<SpendResponse>(listPath('/api/spend', { ...query, units: shown }));
  const projects = useProjects();
  const data = spend.data;
  const groups = data?.groups.map((row) => row.group) ?? [];
  const empty = data?.groups.every((row) => row.phases.length === 0);
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Spend</PageTitle>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })}>
        <Options label="Count" shown>
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
        </Options>
      </ListFilters>
      {spend.isPending && <State>Loading the spend…</State>}
      {spend.isError && <State error>Couldn't load the spend.</State>}
      {data && empty && (
        <State>
          No spend by phase in this period.
          {total(data.uncounted) > 0 && ` ${spendUncountedLabel(data.uncounted, data.fullFrom)}`}
        </State>
      )}
      {data && !empty && (
        <>
          <Chart
            title={TITLE}
            option={{
              baseOption: barsOption(
                data.weeks.map((w) => w.week),
                groups.map((group) => ({
                  name: SPEND_GROUP_LABELS[group],
                  data: data.weeks.map((w) => w.groups[group]),
                  color: SPEND_GROUP_COLORS[group],
                })),
                { stack: 'spend', cost: true, totals: true, legendRoom: 28 },
              ),
              // Below this width ECharts wraps the five groups' legend to two lines (measured in the theme's font), so
              // it gets their room, clear of the week labels.
              media: [{ query: { maxWidth: 445 }, option: { grid: { bottom: 56 } } }],
            }}
            height={260}
          />
          <SpendWeeks response={data} groups={groups} />
          <SpendTable response={data} />
          <SpendNote response={data} />
        </>
      )}
    </div>
  );
}
