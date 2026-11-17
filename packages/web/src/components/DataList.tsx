import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight } from 'lucide-react';
import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
  type PaginationState,
  type RowData,
} from '@tanstack/react-table';
import { cn } from 'cn';
import { EmptyRow, NUM } from './Num.tsx';
import { Pairs } from './Panel.tsx';
import { RowToggle } from './RowToggle.tsx';
import { Button } from './ui/button.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.tsx';

/** A list's rows to a page. */
export const PAGE_SIZE = 10;

/**
 * A first-glance column: what it sorts by (`value`, unknown last) and what it shows (`cell`). `wide` is the one column
 * that takes the room and wraps; `fold` hides it under a 768 px container and moves it into the opened row. `text`, on
 * the toggle column, is the row's name as plain text for `RowToggle`; null (or no `text`) means the cell is a link, and
 * the toggle is a chevron button of its own.
 */
export type ListColumn<T> = {
  id: string;
  header: string;
  value: (row: T) => string | number | null;
  cell: (row: T) => ReactNode;
  num?: boolean;
  wide?: boolean;
  fold?: boolean;
  text?: (row: T) => string | null;
};

/** A fact of the opened row: its term and its value, left out when null. */
export type ListFact<T> = [string, (row: T) => ReactNode | null];

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

/** A fold column's head and cells: shown only while the list's container is at least 768 px wide. */
const FOLD = 'hidden @3xl:table-cell';

/**
 * One list of items: first-glance columns that sort by a header click, pages of `PAGE_SIZE`, and a row that opens in
 * place to its folded columns (while narrow), its `facts` and `extra`. `label` names the table's region, `className`
 * adds to its container, and `rowKey` keeps a row open across sorts and pages (`index`: its place in `rows`).
 */
export function DataList<T extends RowData>({
  rows,
  rowKey,
  name,
  columns,
  facts = [],
  extra,
  label,
  empty,
  className,
}: {
  rows: T[];
  rowKey: (row: T, index: number) => string;
  name: (row: T) => string;
  columns: ListColumn<T>[];
  facts?: ListFact<T>[];
  extra?: (row: T) => ReactNode;
  label: string;
  empty: ReactNode;
  className?: string;
}) {
  const defs = useMemo(() => {
    const helper = createColumnHelper<typeof features, T>();
    return helper.columns(
      columns.map((c) => {
        const known = rows.map(c.value).find((v) => v !== null);
        return helper.accessor((r: T) => c.value(r) ?? undefined, {
          id: c.id,
          sortFn: typeof known === 'number' ? 'basic' : 'alphanumeric',
          sortUndefined: 'last',
          sortDescFirst: false,
        });
      }),
    );
  }, [columns, rows]);
  const table = useTable({
    features,
    columns: defs,
    data: rows,
    // A new array of the same rows keeps the page; new rows or a new sort go back to page 1 (below).
    autoResetPageIndex: false,
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
  });
  const keys = rows.map(rowKey).join('\n');
  const sorting = table.state.sorting;
  useEffect(() => table.setPageIndex(0), [keys, sorting]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const folded = columns.filter((c) => c.fold);
  const opens = facts.length > 0 || extra !== undefined || folded.length > 0;
  const toggleColumn = columns.find((c) => !c.fold);
  return (
    <div className="@container flex flex-col gap-3">
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': label, className, ...{ 'data-list': '' } }}>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <SortHead
                key={c.id}
                column={table.getColumn(c.id)!}
                num={c.num}
                className={cn(c.num && NUM, !c.wide && 'w-0', c.fold && FOLD)}
              >
                {c.header}
              </SortHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && <EmptyRow columns={columns.length}>{empty}</EmptyRow>}
          {table.getRowModel().rows.map((row) => {
            const r = row.original;
            const key = rowKey(r, row.index);
            const isOpen = open.has(key);
            const pairsOf = (list: ListFact<T>[]) =>
              list
                .map(([term, value]): [string, ReactNode] => [term, value(r)])
                .filter(([, value]) => value !== null && value !== '');
            const factPairs = pairsOf(facts);
            const narrowPairs = [...pairsOf(folded.map((c) => [c.header, c.cell])), ...factPairs];
            const toggleCell = (c: ListColumn<T>) => {
              const text = c.text?.(r) ?? null;
              if (text !== null) {
                return (
                  <RowToggle open={isOpen} onToggle={() => toggle(key)}>
                    {text}
                  </RowToggle>
                );
              }
              const Chevron = isOpen ? ChevronDown : ChevronRight;
              return (
                <span className="flex items-start gap-2">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-label={`Details of ${name(r)}`}
                    onClick={() => toggle(key)}
                    className="mt-0.5 rounded-sm"
                  >
                    <Chevron aria-hidden className="size-4 text-muted-foreground" />
                  </button>
                  {c.cell(r)}
                </span>
              );
            };
            return (
              <Fragment key={key}>
                <TableRow className={cn(isOpen && 'border-b-0')}>
                  {columns.map((c) => (
                    <TableCell
                      key={c.id}
                      className={cn('align-top', c.num && NUM, c.wide && 'w-full min-w-0 whitespace-normal', c.fold && FOLD)}
                    >
                      {opens && c === toggleColumn ? toggleCell(c) : c.cell(r)}
                    </TableCell>
                  ))}
                </TableRow>
                {isOpen && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columns.length} className="pt-0 pb-4 pl-8 whitespace-normal">
                      <div className="flex max-w-3xl flex-col gap-3">
                        {narrowPairs.length > 0 && <Pairs text pairs={narrowPairs} className="@3xl:hidden" />}
                        {factPairs.length > 0 && <Pairs text pairs={factPairs} className="hidden @3xl:grid" />}
                        {extra && <div className="w-0 min-w-full">{extra(r)}</div>}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
      <Pager table={table} label={label} />
    </div>
  );
}

/** A column's header that sorts on click: ascending, descending, then the list's own order; on a numeric column the
 * arrow sits left of the label, so the label stays flush right. */
function SortHead({
  column,
  num = false,
  className,
  children,
}: {
  column: { getIsSorted: () => false | 'asc' | 'desc'; getToggleSortingHandler: () => undefined | ((event: unknown) => void) };
  num?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const sorted = column.getIsSorted();
  const Arrow = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  const arrow = <Arrow aria-hidden className={cn('size-3.5 flex-none', !sorted && 'text-muted-foreground')} />;
  return (
    <TableHead aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined} className={className}>
      <button type="button" onClick={column.getToggleSortingHandler()} className="inline-flex items-center gap-1 rounded-sm">
        {num && arrow}
        {children}
        {!num && arrow}
      </button>
    </TableHead>
  );
}

/** The pages under a list of more than `PAGE_SIZE` rows: the range shown out of the table's rows before pagination,
 * announced when it changes, and Previous and Next, each disabled at its end; nothing at one page. */
export function Pager({
  table,
  label,
}: {
  table: {
    state: { pagination: PaginationState };
    getPrePaginatedRowModel: () => { rows: unknown[] };
    getCanPreviousPage: () => boolean;
    getCanNextPage: () => boolean;
    previousPage: () => void;
    nextPage: () => void;
  };
  label: string;
}) {
  const total = table.getPrePaginatedRowModel().rows.length;
  if (total <= PAGE_SIZE) return null;
  const { pageIndex, pageSize } = table.state.pagination;
  const first = pageIndex * pageSize + 1;
  const last = Math.min(total, first + pageSize - 1);
  return (
    <nav aria-label={`${label} pages`} className="flex flex-wrap items-center justify-end gap-3 text-sm">
      <span className="tabular-nums" aria-live="polite">
        {first}–{last} of {total}
      </span>
      <Button variant="outline" size="sm" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>
        Previous
      </Button>
      <Button variant="outline" size="sm" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>
        Next
      </Button>
    </nav>
  );
}
