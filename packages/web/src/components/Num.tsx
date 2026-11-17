import { cloneElement, isValidElement, type ComponentProps, type ReactNode } from 'react';
import { cn } from 'cn';
import { TableCell, TableHead, TableRow } from './ui/table.tsx';
import { formatWhole, NONE, type Pair } from '../lib/format.ts';

/** A numeric column's alignment, for its header and its cells. */
export const NUM = 'text-right tabular-nums';

/** A title column's cells (a run's, a change's, a session's): the title wraps between 9 rem and 18 rem, never down to a
 * word and never as wide as its longest title. */
export const TITLE = 'min-w-36 max-w-72 whitespace-normal';

/** A wide table's other text cells and headers: they wrap at their spaces and hyphens, so the table fits its panel. */
export const WRAP = 'whitespace-normal';

/** A group header over its sub-columns, in a table's two-row header. */
export const GROUP = 'h-8 border-b text-center';

/** A group header over `span` sub-columns, scoped to their column group. */
export function GroupHead({ span, className, children }: { span: number; className?: string; children: ReactNode }) {
  return (
    <TableHead colSpan={span} scope="colgroup" className={cn(GROUP, className)}>
      {children}
    </TableHead>
  );
}

/** A sub-column's header, under its group. */
export const SUB = 'h-8 font-medium text-muted-foreground';

/** An unknown value: a muted dash, read out as "not known"; with `backdrop`, in primary ink, since it sits on the
 * backdrop (a goal section's totals). */
export function Unknown({ label = 'not known', backdrop = false }: { label?: string; backdrop?: boolean }) {
  return (
    <span className={cn(!backdrop && 'text-muted-foreground')}>
      <span aria-hidden>{NONE}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A number, whole and grouped unless `format` says otherwise: zero muted, unknown as the muted dash. */
export function Num({ value, format = formatWhole }: { value: number | null | undefined; format?: (n: number) => string }) {
  if (value == null) return <Unknown />;
  return <span className={cn(value === 0 && 'text-muted-foreground')}>{format(value)}</span>;
}

/** A text value, unknown as the muted dash. */
export function Text({ value, unknown }: { value: string | null | undefined; unknown?: string }) {
  return value ? <>{value}</> : <Unknown label={unknown} />;
}

/** A table's one row saying it has none, across its `columns`. */
export function EmptyRow({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

/** A count line: its name and its number. */
export type Count = [string, number | null];

/** A cell spanning an item's lines: a whole `TableCell`, which gets the span, or a value, put in a numeric cell. */
function spanning(cell: ReactNode, i: number, lines: number) {
  if (isValidElement<ComponentProps<typeof TableCell>>(cell) && cell.type === TableCell) {
    return cloneElement(cell, { key: i, rowSpan: lines });
  }
  return (
    <TableCell key={i} rowSpan={lines} className={cn(NUM, 'align-top')}>
      {cell}
    </TableCell>
  );
}

/**
 * An item's rows, one per line (a step's or rule's counts, a skill's outcomes, an agent's models), with no border
 * between them: its name a row header, and the `before` and `after` cells spanning the lines. Each line is a count of
 * `counts`, its name and number, or `line(i)`'s cells for `lines` lines; with none, `none` across a line's two
 * columns, or the dash when the counts aren't known.
 */
export function Lines({
  name,
  before = [],
  after = [],
  none = '',
  ...each
}: {
  name: ReactNode;
  before?: ReactNode[];
  after?: ReactNode[];
  none?: string;
} & ({ counts: Count[] | null } | { lines: number; line: (i: number) => ReactNode })) {
  const counts = 'counts' in each ? each.counts : undefined;
  const count = 'counts' in each ? (counts?.length ?? 0) : each.lines;
  const line =
    'line' in each
      ? each.line
      : (i: number) => (
          <>
            <TableCell className="text-muted-foreground">{counts![i][0]}</TableCell>
            <TableCell className={NUM}>
              <Num value={counts![i][1]} />
            </TableCell>
          </>
        );
  const lines = Math.max(1, count);
  return Array.from({ length: lines }, (_, i) => (
    <TableRow key={i} className={cn(i < lines - 1 && 'border-b-0')}>
      {i === 0 && (
        <TableHead scope="row" rowSpan={lines} className="h-auto py-2 align-top">
          {name}
        </TableHead>
      )}
      {i === 0 && before.map((cell, j) => spanning(cell, j, lines))}
      {i < count ? (
        line(i)
      ) : (
        <TableCell colSpan={2} className="text-muted-foreground">
          {counts === null ? <Unknown /> : none}
        </TableCell>
      )}
      {i === 0 && after.map((cell, j) => spanning(cell, j, lines))}
    </TableRow>
  ));
}

/** One side of a line: a model, its effort and how many ran so; past the list's end an empty cell, or `none` on the
 * first line of an empty list. */
export function PairCells({ pairs, line, unset, none }: { pairs: Pair[]; line: number; unset: string; none: string }) {
  const pair = pairs[line];
  if (!pair) {
    return (
      <TableCell colSpan={3} className="text-muted-foreground">
        {line === 0 && none}
      </TableCell>
    );
  }
  return (
    <>
      <TableCell>
        <Text value={pair.model} unknown={unset} />
      </TableCell>
      <TableCell>
        <Text value={pair.effort} unknown={unset} />
      </TableCell>
      <TableCell className={NUM}>
        <Num value={pair.count} />
      </TableCell>
    </>
  );
}
