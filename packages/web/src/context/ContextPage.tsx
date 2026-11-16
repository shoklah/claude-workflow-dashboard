import { useState } from 'react';
import { cn } from 'cn';
import type { ContextResponse, ContextWeek, FindingsQuery } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { GroupHead, NUM, Num, SUB } from '../components/Num.tsx';
import { Option, Options } from '../components/Option.tsx';
import { Details, PageTitle, State } from '../components/Panel.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Chart, SERIES, barsOption, singleBars } from '../home/WeeklyCharts.tsx';
import {
  TOOL_CLASS_LABELS,
  formatCompact,
  formatCompactFixed,
  formatShare,
  uncountedLabel,
  weekLabel,
} from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';
import { ContextUnits } from './ContextUnits.tsx';

const CLASSES = Object.keys(TOOL_CLASS_LABELS);

/** The five charts, the weeks oldest first as the API gives them, the cap drawn on the two token charts. */
function ContextCharts({ weeks, cap }: { weeks: ContextWeek[]; cap: number }) {
  const names = weeks.map((w) => w.week);
  const tokens = { cap, format: formatCompact };
  const charts = [
    {
      title: 'Mean context per call (tokens)',
      option: singleBars(names, 'Mean per call', weeks.map((w) => w.meanTokens), tokens),
    },
    { title: 'Largest context (tokens)', option: singleBars(names, 'Largest', weeks.map((w) => w.maxTokens), tokens) },
    { title: 'Runs and sessions over the cap', option: singleBars(names, 'Over the cap', weeks.map((w) => w.unitsOverCap)) },
    {
      title: 'Read share of tool results',
      option: singleBars(names, 'Read share', weeks.map((w) => w.readShare), { format: formatShare }),
    },
    {
      title: 'Sweeps',
      // Blue and aqua: orange stays the warning's colour. Its two series' legend fits on one line.
      option: barsOption(
        names,
        [
          { name: 'Inline', data: weeks.map((w) => w.sweeps.inline), color: SERIES[0] },
          { name: 'Delegated', data: weeks.map((w) => w.sweeps.delegated), color: SERIES[2] },
        ],
        { legendRoom: 28 },
      ),
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {charts.map((chart) => (
        <Chart key={chart.title} title={chart.title} option={chart.option} height={180} />
      ))}
    </div>
  );
}

/** The charts' table view: a row per week, newest first, with the tool results' characters by class. */
function ContextTable({ weeks }: { weeks: ContextWeek[] }) {
  const subs = ['Mean per call', 'Largest', ...CLASSES.map((kind) => TOOL_CLASS_LABELS[kind]), 'Inline', 'Delegated'];
  return (
    <Details summary="The charts as a table">
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Weekly context' }}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Week</TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Runs and sessions
            </TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Calls
            </TableHead>
            <GroupHead span={2}>Context (tokens)</GroupHead>
            <TableHead rowSpan={2} className={NUM}>
              Over the cap
            </TableHead>
            <GroupHead span={CLASSES.length}>Tool results (characters)</GroupHead>
            <TableHead rowSpan={2} className={NUM}>
              Read share (%)
            </TableHead>
            <GroupHead span={2}>Sweeps</GroupHead>
          </TableRow>
          <TableRow>
            {subs.map((column) => (
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
              <TableCell className={NUM}>
                <Num value={w.units} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={w.calls} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={w.meanTokens} format={formatCompactFixed} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={w.maxTokens} format={formatCompactFixed} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={w.unitsOverCap} />
              </TableCell>
              {CLASSES.map((kind) => (
                <TableCell key={kind} className={NUM}>
                  <Num value={w.toolResults[kind] ?? 0} format={formatCompactFixed} />
                </TableCell>
              ))}
              <TableCell className={NUM}>
                <Num value={w.readShare} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={w.sweeps.inline} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={w.sweeps.delegated} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Details>
  );
}

/**
 * The Context page: the period's weekly context (mean and largest per call against the cap, units over the cap, the
 * read share of tool results and the sweeps), their table view, how they are counted, and the runs and sessions behind
 * them, over the cap by default through the "Show" switch beside their title.
 */
export function ContextPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 12 });
  const [over, setOver] = useState(true);
  const context = useLiveQuery<ContextResponse>(listPath('/api/context', { ...query, over }));
  const projects = useProjects();
  const data = context.data;
  // The units' switch, kept on an error too, so a failed "All" can go back over the cap.
  const show = (
    <Options label="Show" shown className="ml-auto">
      <Option pressed={over} onClick={() => setOver(true)}>
        Over the cap
      </Option>
      <Option pressed={!over} onClick={() => setOver(false)}>
        All
      </Option>
    </Options>
  );
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Context</PageTitle>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })} />
      {context.isPending && <State>Loading the context…</State>}
      {context.isError && (
        <>
          <State error>Couldn't load the context.</State>
          {show}
        </>
      )}
      {data && (
        <>
          <ContextCharts weeks={data.weeks} cap={data.cap} />
          <ContextTable weeks={data.weeks} />
          <Details summary="How context is counted">
            <p className="max-w-prose">
              Context is a main call's input plus cache tokens, as the reporter counts it. A week sums its runs, by
              finish, and its sessions, by start. The dashed line is the context cap, {formatCompact(data.cap)}: the
              app's default until the reporter exports its own.
            </p>
            <p className="max-w-prose">{uncountedLabel(data.uncounted)}</p>
          </Details>
          <ContextUnits units={data.units} hidden={data.hidden} over={over}>
            {show}
          </ContextUnits>
        </>
      )}
    </div>
  );
}
