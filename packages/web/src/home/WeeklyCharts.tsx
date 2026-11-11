import ReactECharts from 'echarts-for-react';
import { parseTime, weekOf, type HomeResponse, type StepKind } from '@cwd/shared';
import { STEP_LABELS, formatCompact, formatCost, weekLabel } from '../lib/format.ts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';

type Charts = HomeResponse['charts'];

/** The step kinds, in the order the API lists them (the reporter's). */
const stepKinds = (charts: Charts) => Object.keys(charts.findingsByStep) as StepKind[];

// The dataviz skill's reference palette, light mode, on the card's white surface: categorical slots 1 to 7 in their
// fixed order (validated: adjacent pairs pass CVD and normal-vision; aqua, yellow and magenta sit under 3:1, so the
// table view below carries every number), and the chart chrome's ink, gridline and baseline.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6'];
const SURFACE = '#ffffff';
const INK = '#52514e';
const GRID = '#e1e0d9';
const BASELINE = '#c3c2b7';

/** The options every chart shares: weeks along the bottom, one value axis, an axis tooltip, no animation. */
function baseOption(weeks: string[]) {
  return {
    animation: false,
    textStyle: { fontFamily: 'inherit' },
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: {
      type: 'category',
      data: weeks.map(weekLabel),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: BASELINE } },
      axisLabel: { color: INK },
    },
    yAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: GRID } }, axisLabel: { color: INK } },
  };
}

/**
 * One series of bars: 24px at most, a 4px rounded end, square at the baseline; a `cost` reads in dollars, and `format`
 * writes the tooltip's values and the y axis labels, an empty bar's (which ECharts passes as undefined) as null. A `cap` draws a dashed line at that value, labelled "cap 300K",
 * the y axis reaching at least to it.
 */
export function singleBars(
  weeks: string[],
  name: string,
  data: (number | null)[],
  options: { cost?: boolean; cap?: number; format?: (value: number | null) => string } = {},
) {
  const base = baseOption(weeks);
  const { cost = false, cap } = options;
  const format = cost ? formatCost : options.format;
  return {
    ...base,
    // Room above the plot for the cap's label when the axis ends at the cap.
    grid: cap === undefined ? base.grid : { ...base.grid, top: 20 },
    tooltip: { ...base.tooltip, valueFormatter: format && ((value?: number | null) => format(value ?? null)) },
    yAxis: {
      ...base.yAxis,
      max: cap === undefined ? undefined : ({ max }: { max: number }) => Math.max(max, cap),
      axisLabel: { ...base.yAxis.axisLabel, formatter: cost ? '${value}' : format },
    },
    series: [
      {
        name,
        type: 'bar',
        data,
        barMaxWidth: 24,
        itemStyle: { color: SERIES[0], borderRadius: [4, 4, 0, 0] },
        markLine:
          cap === undefined
            ? undefined
            : {
                silent: true,
                symbol: 'none',
                lineStyle: { color: INK, type: 'dashed', width: 1.5 },
                label: {
                  color: INK,
                  position: 'insideEndTop',
                  formatter: `cap ${formatCompact(cap)}`,
                  textBorderColor: SURFACE,
                  textBorderWidth: 3,
                },
                data: [{ yAxis: cap }],
              },
      },
    ],
  };
}

/**
 * Bars of several series by week, each series a palette slot in order, a 1px surface border between bars, with a
 * legend; stacked per week when `stack` names the stack, else side by side. `legendRoom` is the room under the plot
 * for the legend: 64px by default, for a legend that wraps (Home's step kinds), 28px for one that fits on one line.
 */
export function barsOption(
  weeks: string[],
  series: { name: string; data: (number | null)[] }[],
  { stack, legendRoom = 64 }: { stack?: string; legendRoom?: number } = {},
) {
  const base = baseOption(weeks);
  return {
    ...base,
    grid: { ...base.grid, bottom: legendRoom },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: INK } },
    series: series.map(({ name, data }, i) => ({
      name,
      type: 'bar',
      stack,
      data,
      barMaxWidth: 24,
      itemStyle: { color: SERIES[i], borderColor: SURFACE, borderWidth: 1 },
    })),
  };
}

/** The findings of each step kind, stacked per week. */
function findingsOption(charts: Charts) {
  return barsOption(
    charts.weeks,
    stepKinds(charts).map((kind) => ({ name: STEP_LABELS[kind], data: charts.findingsByStep[kind] })),
    { stack: 'findings' },
  );
}

export function Chart({ title, option, height }: { title: string; option: object; height: number }) {
  return (
    <div className="min-w-0 flex-1 rounded-lg border bg-card p-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <ReactECharts
        role="img"
        aria-label={`${title}: bars by week; the numbers are in the table below.`}
        option={option}
        opts={{ renderer: 'svg' }}
        style={{ height }}
      />
    </div>
  );
}

/** Every charted number, a row per week, so no value depends on telling colors apart. */
function ChartsTable({ charts }: { charts: Charts }) {
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted-foreground">The charts as a table</summary>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Week</TableHead>
            {stepKinds(charts).map((kind) => (
              <TableHead key={kind}>{STEP_LABELS[kind]} findings</TableHead>
            ))}
            <TableHead>Cost</TableHead>
            <TableHead>Warnings</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {charts.weeks.map((week, i) => (
            <TableRow key={week}>
              <TableHead scope="row">{weekLabel(week)}</TableHead>
              {stepKinds(charts).map((kind) => (
                <TableCell key={kind}>{charts.findingsByStep[kind][i]}</TableCell>
              ))}
              <TableCell>{formatCost(charts.cost[i])}</TableCell>
              <TableCell>{charts.warnings[i]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </details>
  );
}

/** A note when the reporter's coverage starts after `firstWeek`: the earlier weeks hold only what was stored. */
export function CoverageNote({ coverageFrom, firstWeek }: { coverageFrom: string | null; firstWeek: string }) {
  if (coverageFrom === null || weekOf(parseTime(coverageFrom)) <= firstWeek) return null;
  return (
    <p className="text-sm text-muted-foreground">
      Weeks before {parseTime(coverageFrom).toLocaleDateString(undefined, { dateStyle: 'medium' })} show what was
      stored; the reporter can no longer read them.
    </p>
  );
}

/**
 * The weekly charts: findings by step, cost and warnings over the charted weeks, with a note when the reporter's
 * coverage starts after the first of them (the earlier weeks hold only what was stored).
 */
export function WeeklyCharts({ charts, coverageFrom }: { charts: Charts; coverageFrom: string | null }) {
  return (
    <section aria-label="Weekly charts" className="flex flex-col gap-2">
      <div className="flex gap-3">
        <Chart title="Findings by week, by step" option={findingsOption(charts)} height={260} />
        <Chart title="Cost by week" option={singleBars(charts.weeks, 'Cost', charts.cost, { cost: true })} height={260} />
        <Chart title="Warnings by week" option={singleBars(charts.weeks, 'Warnings', charts.warnings)} height={260} />
      </div>
      <CoverageNote coverageFrom={coverageFrom} firstWeek={charts.weeks[0]} />
      <ChartsTable charts={charts} />
    </section>
  );
}
