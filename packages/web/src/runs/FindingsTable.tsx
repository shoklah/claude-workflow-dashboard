import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  filterFn_equalsString,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type { FindingRow } from '@cwd/shared';
import { Badge } from '../components/ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { NONE, stepLabel } from './format.ts';

const features = tableFeatures({
  columnFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  filterFns: { equalsString: filterFn_equalsString },
});
const helper = createColumnHelper<typeof features, FindingRow>();
const columns = helper.columns([
  helper.accessor('id', { header: '#', cell: (c) => c.getValue() ?? NONE }),
  helper.accessor('step', { header: 'Step', filterFn: 'equalsString', cell: (c) => stepLabel(c.getValue()) }),
  helper.accessor((f) => (f.task !== null ? String(f.task) : f.wave !== null ? `Wave ${f.wave}` : NONE), {
    id: 'task',
    header: 'Task',
  }),
  helper.accessor('severity', { header: 'Severity', filterFn: 'equalsString', cell: (c) => c.getValue() ?? NONE }),
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
]);

// The filters: each lists the values its column holds, in order, labelled as the column shows them.
const FILTERS = [
  { id: 'step', label: 'Step', show: stepLabel },
  { id: 'severity', label: 'Severity', show: (v: string) => v },
  { id: 'outcome', label: 'Outcome', show: (v: string) => v },
] as const;

/** Every finding of the run in one table, filtered by step, severity and outcome. */
export function FindingsTable({ findings }: { findings: FindingRow[] }) {
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
      <Table>
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
              <TableCell colSpan={columns.length} className="text-muted-foreground">
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
