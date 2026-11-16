import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.tsx';
import { cellShade, formatCount, total, weekLabel } from '../lib/format.ts';
import { NUM } from './Num.tsx';

/** A cell of a heatmap: its row's id and a week. */
export type HeatmapSelection = { id: string; week: string };

/** A row of a heatmap: `id` identifies it in the selection, `name` names it in its cells' labels, `header` is what its
 * header shows; `texts`, when given, is each cell's text in place of `format`'s; `extras` are its cells in the extra columns. */
export type HeatmapRow = { id: string; name: string; header: ReactNode; values: (number | null)[]; texts?: string[]; extras?: ReactNode[] };

/** A group of rows, under a full-width heading row unless its heading is null. */
export type HeatmapGroup = { heading: ReactNode | null; rows: HeatmapRow[] };

/**
 * Rows down and the weeks across, each cell a button with its number written in it (`format`, a count by default), so
 * the heatmap is its own table view. One blue ramp shades the cells against `max`, the grey for 0 or an unknown value.
 * It scrolls sideways over many weeks, in a region named `label`; `corner` heads the rows' column. With `total`, a last
 * "Total" column holds each row's values summed, written by `format` too (muted when 0); `extras` heads numeric columns
 * after it, each row giving their cells.
 */
export function HeatmapTable({
  label,
  corner,
  weeks,
  groups,
  max,
  format = formatCount,
  total: withTotal = false,
  extras = [],
  selected,
  onSelect,
}: {
  label: string;
  corner: string;
  weeks: string[];
  groups: HeatmapGroup[];
  max: number;
  format?: (value: number | null) => string;
  total?: boolean;
  extras?: string[];
  selected: HeatmapSelection | null;
  onSelect: (cell: HeatmapSelection) => void;
}) {
  return (
    // Its container is a named tab stop for keyboard users, since it scrolls sideways.
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': label }}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{corner}</TableHead>
          {weeks.map((week) => (
            <TableHead key={week} className="text-center">
              {weekLabel(week)}
            </TableHead>
          ))}
          {withTotal && <TableHead className={NUM}>Total</TableHead>}
          {extras.map((extra) => (
            <TableHead key={extra} className={NUM}>
              {extra}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      {groups.map((group, g) => (
        <TableBody key={g}>
          {group.heading !== null && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead
                scope="rowgroup"
                colSpan={weeks.length + extras.length + (withTotal ? 2 : 1)}
                className="h-8 pt-2 text-xs font-medium text-muted-foreground"
              >
                {group.heading}
              </TableHead>
            </TableRow>
          )}
          {group.rows.map((row) => (
            <TableRow key={row.id} className="border-0 hover:bg-transparent">
              <TableHead scope="row" className="w-px font-normal whitespace-nowrap">
                {row.header}
              </TableHead>
              {row.values.map((value, i) => {
                const week = weeks[i];
                const text = row.texts?.[i] ?? format(value);
                const pressed = selected?.id === row.id && selected.week === week;
                return (
                  <TableCell key={week} className="p-0.5">
                    <button
                      type="button"
                      aria-pressed={pressed}
                      aria-label={`${row.name}, week of ${weekLabel(week)}: ${text}`}
                      onClick={() => onSelect({ id: row.id, week })}
                      className={cn(
                        'h-8 w-full min-w-12 rounded-sm px-1 text-sm whitespace-nowrap tabular-nums',
                        cellShade(value ?? 0, max),
                        pressed && 'outline-2 outline-offset-1 outline-foreground',
                      )}
                    >
                      {text}
                    </button>
                  </TableCell>
                );
              })}
              {withTotal && (
                <TableCell className={cn(NUM, total(row.values) === 0 && 'text-muted-foreground')}>{format(total(row.values))}</TableCell>
              )}
              {row.extras?.map((extra, i) => (
                <TableCell key={i} className={NUM}>
                  {extra}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      ))}
    </Table>
  );
}
