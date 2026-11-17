import { useMemo } from 'react';
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  filterFn_equalsString,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type { FindingItem, FindingRow, StepKind } from '@cwd/shared';
import { EmptyRow, Text, Unknown } from '../components/Num.tsx';
import { TERM } from '../components/Panel.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.tsx';
import { STEP_LABELS, appCallLabel, capitalize, categoryLabel, countName } from '../lib/format.ts';

const features = tableFeatures({
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { equalsString: filterFn_equalsString },
});
// A finding, and with `run` its run's key, project and branch, as the Findings page lists them.
type Row = FindingRow & Partial<Pick<FindingItem, 'runKey' | 'project' | 'branch'>>;

const helper = createColumnHelper<typeof features, Row>();
/** The finding columns, each category named by `labels`. */
const columnsOf = (labels: Record<string, string>) => helper.columns([
  helper.accessor('id', { header: '#', cell: (c) => <Text value={c.getValue()} /> }),
  helper.accessor('step', { header: 'Step', filterFn: 'equalsString', cell: (c) => STEP_LABELS[c.getValue()] }),
  helper.accessor((f) => (f.task !== null ? String(f.task) : f.wave !== null ? `Wave ${f.wave}` : null), {
    id: 'task',
    header: 'Task',
    cell: (c) => <Text value={c.getValue()} unknown="no task" />,
  }),
  helper.accessor('severity', {
    header: 'Severity',
    filterFn: 'equalsString',
    cell: (c) => <Text value={c.getValue() && countName(c.getValue()!)} />,
  }),
  helper.accessor('category', {
    header: 'Category',
    cell: (c) => categoryLabel(c.getValue(), labels),
  }),
  helper.accessor((f) => (f.category === null ? null : f.judge === 'app' ? 'App' : 'Workflow'), {
    id: 'labelledBy',
    header: 'Labelled by',
    cell: (c) => <Text value={c.getValue()} unknown="not labelled" />,
  }),
  helper.accessor('summary', { header: 'Summary', cell: (c) => <Text value={c.getValue()} /> }),
  helper.accessor('outcome', {
    header: 'Outcome',
    filterFn: 'equalsString',
    cell: (c) => <Text value={c.getValue() && countName(c.getValue()!)} />,
  }),
  helper.accessor('reason', {
    header: 'Reason',
    cell: (c) => (
      <span className="text-muted-foreground">
        <Text value={c.getValue()} unknown="no reason" />
      </span>
    ),
  }),
  helper.accessor('verdicts', {
    header: 'Fix-check verdicts',
    cell: (c) =>
      c.getValue().length === 0 ? (
        <Unknown label="none" />
      ) : (
        c.getValue().map((verdict, i) => (
          <span key={i} className="block">
            {countName(verdict)}
          </span>
        ))
      ),
  }),
  // The session's call, as the workflow records it.
  helper.accessor('validity', { header: 'Valid', cell: (c) => <Text value={c.getValue() && countName(c.getValue()!)} /> }),
  helper.accessor('relevance', {
    header: 'App',
    cell: (c) => {
      if (c.getValue() === null) return <Unknown label="no app label" />;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className={TERM}>
              {capitalize(appCallLabel(c.row.original, labels))}
            </span>
          </TooltipTrigger>
          <TooltipContent>{c.row.original.labelReason}</TooltipContent>
        </Tooltip>
      );
    },
  }),
]);
const runColumn = helper.columns([
  helper.accessor((f) => f.branch ?? null, {
    id: 'run',
    header: 'Run',
    cell: (c) => (
      <RunLink runKey={c.row.original.runKey ?? ''} branch={c.getValue()} className="font-medium" />
    ),
  }),
  helper.accessor((f) => f.project ?? null, { id: 'project', header: 'Project', cell: (c) => <Text value={c.getValue()} /> }),
]);

// The filters: each lists the values its column holds, in order, labelled as the column shows them.
const FILTERS = [
  { id: 'step', label: 'Step', show: (v: string) => STEP_LABELS[v as StepKind] },
  { id: 'severity', label: 'Severity', show: countName },
  { id: 'outcome', label: 'Outcome', show: countName },
] as const;

/**
 * Every finding of the run in one table, filtered by step, severity and outcome, with its labels: the workflow's, which
 * win, and the app's; each category named by `categoryLabels` (the response's). With `run`, a first column links each
 * finding to its run.
 */
export function FindingsTable({
  findings,
  categoryLabels,
  run,
}: {
  findings: Row[];
  categoryLabels: Record<string, string>;
  run?: boolean;
}) {
  const columns = useMemo(() => [...(run ? runColumn : []), ...columnsOf(categoryLabels)], [run, categoryLabels]);
  const table = useTable({ features, columns, data: findings });
  const rows = table.getRowModel().rows;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        {FILTERS.map((filter) => {
          const column = table.getColumn(filter.id)!;
          const values = [...new Set(findings.map((f) => f[filter.id]).filter((v) => v !== null))].sort();
          return (
            <label key={filter.id} className="flex items-center gap-1.5">
              {filter.label}
              <select
                value={String(column.getFilterValue() ?? '')}
                onChange={(e) => column.setFilterValue(e.target.value)}
              >
                <option value="">All</option>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {filter.show(value)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      {/* It scrolls sideways, so its container is a named tab stop for keyboard users. */}
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Findings' }}>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableHead key={header.id}>
                  <table.FlexRender header={header} />
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <EmptyRow columns={table.getAllLeafColumns().length}>
              {findings.length === 0
                ? 'No findings.'
                : 'No findings match these filters. Set a filter back to All to see more.'}
            </EmptyRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={cell.column.id === 'summary' || cell.column.id === 'reason' ? 'min-w-64 align-top whitespace-normal' : 'align-top'}>
                  <table.FlexRender cell={cell} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
