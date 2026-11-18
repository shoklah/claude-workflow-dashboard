import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
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
  type SortingState,
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
        let known: string | number | null = null;
        for (const r of rows) if ((known = c.value(r)) !== null) break;
        return helper.accessor((r: T) => c.value(r) ?? undefined, {
          id: c.id,
          sortFn: typeof known === 'number' ? 'basic' : 'alphanumeric',
          sortUndefined: 'last',
          sortDescFirst: false,
        });
      }),
    );
  }, [columns, rows]);
  // The page and the sort are this list's state, so a new key sequence or a sort goes back to page 1 in the same
  // render, never painting a stale page; a new array of the same rows keeps the page.
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE });
  const [sorting, setSorting] = useState<SortingState>([]);
  const keys = rows.map(rowKey).join('\n');
  const [seenKeys, setSeenKeys] = useState(keys);
  if (keys !== seenKeys) {
    setSeenKeys(keys);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }
  const table = useTable({
    features,
    columns: defs,
    data: rows,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: (sort) => {
      setSorting(sort);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    autoResetPageIndex: false,
  });
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (key: string) =>
    setOpen((was) => {
      const next = new Set(was);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const folded = columns.filter((c) => c.fold);
  // With nothing to open but its folded columns, a row opens only while they fold.
  const foldOnly = facts.length === 0 && extra === undefined;
  const opens = !foldOnly || folded.length > 0;
  const toggleColumn = columns.find((c) => !c.fold);
  return (
    <div className="@container flex flex-col gap-3">
      {/* `data-list` is spread in: an object literal's `data-*` key fails the excess-property check. */}
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
            const toggleCell = (c: ListColumn<T>) => {
              const text = c.text?.(r) ?? null;
              if (text !== null) {
                const rowToggle = (
                  <RowToggle open={isOpen} onToggle={() => toggle(key)}>
                    {text}
                  </RowToggle>
                );
                if (!foldOnly) return rowToggle;
                return (
                  <>
                    <span className="hidden @3xl:inline">{c.cell(r)}</span>
                    <div className="@3xl:hidden">{rowToggle}</div>
                  </>
                );
              }
              return (
                <span className="flex items-start gap-2">
                  <RowToggle
                    open={isOpen}
                    onToggle={() => toggle(key)}
                    label={`Details of ${name(r)}`}
                    className={cn('mt-0.5', foldOnly && '@3xl:hidden')}
                  />
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
                  <OpenedRow row={r} columns={columns.length} folded={folded} facts={facts} extra={extra} foldOnly={foldOnly} />
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

/** A row's facts as term and value, the empty ones left out. */
function shownPairs<T>(row: T, list: ListFact<T>[]): [string, ReactNode][] {
  return list
    .map(([term, value]): [string, ReactNode] => [term, value(row)])
    .filter(([, value]) => value !== null && value !== '');
}

/** The opened row under a row: its folded columns then its facts while narrow, its facts alone while wide, then
 * `extra`. */
function OpenedRow<T>({
  row,
  columns,
  folded,
  facts,
  extra,
  foldOnly,
}: {
  row: T;
  columns: number;
  folded: ListColumn<T>[];
  facts: ListFact<T>[];
  extra?: (row: T) => ReactNode;
  foldOnly: boolean;
}) {
  const factPairs = shownPairs(row, facts);
  const narrowPairs = [...shownPairs(row, folded.map((c): ListFact<T> => [c.header, c.cell])), ...factPairs];
  return (
    <TableRow className={cn('hover:bg-transparent', foldOnly && '@3xl:hidden')}>
      <TableCell colSpan={columns} className="pt-0 pb-4 pl-8 whitespace-normal">
        <div className="flex max-w-3xl flex-col gap-3">
          {narrowPairs.length > 0 && <Pairs text pairs={narrowPairs} className="@3xl:hidden" />}
          {factPairs.length > 0 && <Pairs text pairs={factPairs} className="hidden @3xl:grid" />}
          {extra && <div className="w-0 min-w-full">{extra(row)}</div>}
        </div>
      </TableCell>
    </TableRow>
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
