import { useState } from 'react';
import type { ContextResponse, ContextWeek, FindingsQuery } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Chart, barsOption, singleBars } from '../home/WeeklyCharts.tsx';
import { TOOL_CLASS_LABELS, formatCompact, formatShare, uncountedLabel, weekLabel } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';
import { ContextUnits } from './ContextUnits.tsx';

const CLASSES = Object.keys(TOOL_CLASS_LABELS);
const COUNT = 'text-right tabular-nums';

/** The five charts, the weeks oldest first as the API gives them, the cap drawn on the two token charts. */
function ContextCharts({ weeks, cap }: { weeks: ContextWeek[]; cap: number }) {
  const names = weeks.map((w) => w.week);
  const tokens = { cap, format: formatCompact };
  const charts = [
    { title: 'Mean context per call', option: singleBars(names, 'Mean per call', weeks.map((w) => w.meanTokens), false, tokens) },
    { title: 'Largest context', option: singleBars(names, 'Largest', weeks.map((w) => w.maxTokens), false, tokens) },
    { title: 'Runs and sessions over the cap', option: singleBars(names, 'Over the cap', weeks.map((w) => w.unitsOverCap)) },
    {
      title: 'Read share of tool results',
      option: singleBars(names, 'Read share', weeks.map((w) => w.readShare), false, { format: formatShare }),
    },
    {
      title: 'Sweeps',
      option: barsOption(names, [
        { name: 'inline', data: weeks.map((w) => w.sweeps.inline) },
        { name: 'delegated', data: weeks.map((w) => w.sweeps.delegated) },
      ]),
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {charts.map((chart) => (
        <Chart key={chart.title} title={chart.title} option={chart.option} height={180} />
      ))}
    </div>
  );
}

/** The charts' table view: a row per week, newest first, with the tool results' characters by class. */
function ContextTable({ weeks }: { weeks: ContextWeek[] }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">The charts as a table</summary>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Weekly context' }}>
        <TableHeader>
          <TableRow>
            <TableCell colSpan={6} />
            <TableHead colSpan={CLASSES.length} scope="colgroup" className="border-b text-center">
              Tool-result characters
            </TableHead>
            <TableCell colSpan={3} />
          </TableRow>
          <TableRow>
            <TableHead>Week</TableHead>
            {['Units', 'Calls', 'Mean per call', 'Largest', 'Over the cap'].map((column) => (
              <TableHead key={column} className={COUNT}>
                {column}
              </TableHead>
            ))}
            {CLASSES.map((kind) => (
              <TableHead key={kind} className={COUNT}>
                {TOOL_CLASS_LABELS[kind]}
              </TableHead>
            ))}
            {['Read share', 'Inline', 'Delegated'].map((column) => (
              <TableHead key={column} className={COUNT}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {weeks.toReversed().map((w) => (
            <TableRow key={w.week}>
              <TableHead scope="row">{weekLabel(w.week)}</TableHead>
              <TableCell className={COUNT}>{w.units}</TableCell>
              <TableCell className={COUNT}>{w.calls}</TableCell>
              <TableCell className={COUNT}>{formatCompact(w.meanTokens)}</TableCell>
              <TableCell className={COUNT}>{formatCompact(w.maxTokens)}</TableCell>
              <TableCell className={COUNT}>{w.unitsOverCap}</TableCell>
              {CLASSES.map((kind) => (
                <TableCell key={kind} className={COUNT}>
                  {formatCompact(w.toolResults[kind] ?? 0)}
                </TableCell>
              ))}
              <TableCell className={COUNT}>{formatShare(w.readShare)}</TableCell>
              <TableCell className={COUNT}>{w.sweeps.inline}</TableCell>
              <TableCell className={COUNT}>{w.sweeps.delegated}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}

/**
 * The Context page: the period's weekly context (mean and largest per call against the cap, units over the cap, the
 * read share of tool results and the sweeps), their table view, and the runs and sessions behind them, over the cap by
 * default.
 */
export function ContextPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 12 });
  const [over, setOver] = useState(true);
  const context = useLiveQuery<ContextResponse>(listPath('/api/context', { ...query, over }));
  const projects = useProjects();
  const data = context.data;
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Context</h1>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })} />
      {context.isPending && <p className="text-sm text-muted-foreground">Loading the context…</p>}
      {context.isError && <p className="text-sm">Couldn't load the context.</p>}
      {data && (
        <>
          <ContextCharts weeks={data.weeks} cap={data.cap} />
          <p className="text-sm text-muted-foreground">
            Context is a main call's input plus cache tokens, as the reporter counts it. A week sums its runs, by finish,
            and its sessions, by start. {uncountedLabel(data.uncounted)} The dashed line is the context cap,{' '}
            {formatCompact(data.cap)}: the app's default until the reporter exports its own.
          </p>
          <ContextTable weeks={data.weeks} />
          <ContextUnits units={data.units} hidden={data.hidden} over={over} onOverChange={setOver} />
        </>
      )}
    </div>
  );
}
