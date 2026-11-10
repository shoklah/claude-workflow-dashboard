import { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  filterFn_equalsString,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type { FindingItem, FindingRow, StepKind } from '@cwd/shared';
import { Badge } from '../components/ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.tsx';
import { NONE, STEP_LABELS, categoryLabel, runName } from '../lib/format.ts';

const features = tableFeatures({
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { equalsString: filterFn_equalsString },
});
// A finding, and with `run` its run's key, project and branch, as the Findings page lists them.
type Row = FindingRow & Partial<Pick<FindingItem, 'runKey' | 'project' | 'branch'>>;

/** A finding's category by its label from `labels`, in a dashed badge that marks it as the app's label, never the
 * reporter's; "unlabelled" bare. */
export function CategoryBadge({ category, labels }: { category: string | null; labels: Record<string, string> }) {
  return category === null ? (
    categoryLabel(null, labels)
  ) : (
    <Badge variant="outline" className="border-dashed" title="The app's label">
      {categoryLabel(category, labels)}
    </Badge>
  );
}

const helper = createColumnHelper<typeof features, Row>();
/** The finding columns, each category named by `labels`. */
const columnsOf = (labels: Record<string, string>) => helper.columns([
  helper.accessor('id', { header: '#', cell: (c) => c.getValue() ?? NONE }),
  helper.accessor('step', { header: 'Step', filterFn: 'equalsString', cell: (c) => STEP_LABELS[c.getValue()] }),
  helper.accessor((f) => (f.task !== null ? String(f.task) : f.wave !== null ? `Wave ${f.wave}` : NONE), {
    id: 'task',
    header: 'Task',
  }),
  helper.accessor('severity', { header: 'Severity', filterFn: 'equalsString', cell: (c) => c.getValue() ?? NONE }),
  helper.accessor('category', {
    header: 'Category',
    cell: (c) => <CategoryBadge category={c.getValue()} labels={labels} />,
  }),
  helper.accessor('summary', { header: 'Summary', cell: (c) => c.getValue() ?? NONE }),
  helper.accessor('outcome', {
    header: 'Outcome',
    filterFn: 'equalsString',
    cell: (c) => {
      const outcome = c.getValue();
      return outcome ? <Badge variant="outline">{outcome}</Badge> : NONE;
    },
  }),
  helper.accessor('reason', { header: 'Reason', cell: (c) => c.getValue() ?? NONE }),
  helper.accessor((f) => (f.verdicts.length ? f.verdicts.join(', ') : NONE), { id: 'verdicts', header: 'Verdicts' }),
  // The session's call, which the workflow doesn't record yet (CR10).
  helper.accessor(() => NONE, { id: 'valid', header: 'Valid' }),
  helper.accessor('relevance', {
    header: 'App',
    cell: (c) => {
      const relevance = c.getValue();
      if (relevance === null) return NONE;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} className="underline decoration-dotted underline-offset-2">
              {relevance}
            </span>
          </TooltipTrigger>
          <TooltipContent>{c.row.original.labelReason}</TooltipContent>
        </Tooltip>
      );
    },
  }),
]);
const runColumn = helper.columns([
  helper.accessor((f) => runName({ project: f.project ?? null, branch: f.branch ?? null }), {
    id: 'run',
    header: 'Run',
    cell: (c) => (
      <Link to="/runs/$key" params={{ key: c.row.original.runKey ?? '' }} className="underline-offset-2 hover:underline">
        {c.getValue()}
      </Link>
    ),
  }),
]);

// The filters: each lists the values its column holds, in order, labelled as the column shows them.
const FILTERS = [
  { id: 'step', label: 'Step', show: (v: string) => STEP_LABELS[v as StepKind] },
  { id: 'severity', label: 'Severity', show: (v: string) => v },
  { id: 'outcome', label: 'Outcome', show: (v: string) => v },
] as const;

/**
 * Every finding of the run in one table, filtered by step, severity and outcome, with the app's label of each, its
 * category named by `categoryLabels` (the response's). With `run`, a first column links each finding to its run.
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
                className="rounded-md border bg-background px-2 py-1"
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
            <TableRow>
              <TableCell colSpan={table.getAllLeafColumns().length} className="text-muted-foreground">
                No findings.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={cell.column.id === 'summary' || cell.column.id === 'reason' ? 'whitespace-normal' : undefined}>
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
