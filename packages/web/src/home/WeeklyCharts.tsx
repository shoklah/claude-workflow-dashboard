import ReactECharts from 'echarts-for-react';
import type { HomeResponse, StepKind } from '@cwd/shared';
// By path: the package's entry also loads Node-only code (keys.ts imports node:crypto), which a browser can't run.
import { parseTime, weekOf } from '../../../shared/src/week.ts';
import { STEP_LABELS, formatCost } from '../lib/format.ts';
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

/** A week's start date on an axis: "Nov 8". */
function weekLabel(week: string): string {
  return new Date(week).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

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

/** One series of bars: 24px at most, a 4px rounded end, square at the baseline; a cost reads in dollars. */
function singleBars(weeks: string[], name: string, data: (number | null)[], cost = false) {
  const base = baseOption(weeks);
  return {
    ...base,
    tooltip: { ...base.tooltip, valueFormatter: cost ? formatCost : undefined },
    yAxis: { ...base.yAxis, axisLabel: { ...base.yAxis.axisLabel, formatter: cost ? '${value}' : undefined } },
    series: [
      { name, type: 'bar', data, barMaxWidth: 24, itemStyle: { color: SERIES[0], borderRadius: [4, 4, 0, 0] } },
    ],
  };
}

/** The findings of each step kind, stacked per week, a 2px surface gap between segments, with a legend. */
function findingsOption(charts: Charts) {
  const base = baseOption(charts.weeks);
  return {
    ...base,
    grid: { ...base.grid, bottom: 64 },
    legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: INK } },
    series: stepKinds(charts).map((kind, i) => ({
      name: STEP_LABELS[kind],
      type: 'bar',
      stack: 'findings',
      data: charts.findingsByStep[kind],
      barMaxWidth: 24,
      itemStyle: { color: SERIES[i], borderColor: SURFACE, borderWidth: 1 },
    })),
  };
}

function Chart({ title, option, height }: { title: string; option: object; height: number }) {
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

/**
 * The weekly charts: findings by step, cost and warnings over the charted weeks, with a note when the reporter's
 * coverage starts after the first of them (the earlier weeks hold only what was stored).
 */
export function WeeklyCharts({ charts, coverageFrom }: { charts: Charts; coverageFrom: string | null }) {
  const coverageWeek = coverageFrom === null ? null : weekOf(parseTime(coverageFrom));
  return (
    <section aria-label="Weekly charts" className="flex flex-col gap-2">
      <div className="flex gap-3">
        <Chart title="Findings by week, by step" option={findingsOption(charts)} height={260} />
        <Chart title="Cost by week" option={singleBars(charts.weeks, 'Cost', charts.cost, true)} height={260} />
        <Chart title="Warnings by week" option={singleBars(charts.weeks, 'Warnings', charts.warnings)} height={260} />
      </div>
      {coverageWeek !== null && coverageWeek > charts.weeks[0] && (
        <p className="text-sm text-muted-foreground">
          Weeks before {parseTime(coverageFrom!).toLocaleDateString(undefined, { dateStyle: 'medium' })} show what was
          stored; the reporter can no longer read them.
        </p>
      )}
      <ChartsTable charts={charts} />
    </section>
  );
}
