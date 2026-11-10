import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.tsx';
import { cellShade, formatCount, weekLabel } from '../lib/format.ts';

/** A cell of a heatmap: its row's id and a week. */
export type HeatmapSelection = { id: string; week: string };

/** A row of a heatmap: `id` identifies it in the selection, `name` names it in its cells' labels, `header` is what its
 * header shows; `texts`, when given, is each cell's text in place of `format`'s. */
export type HeatmapRow = { id: string; name: string; header: ReactNode; values: (number | null)[]; texts?: string[] };

/** A group of rows, under a full-width heading row unless its heading is null. */
export type HeatmapGroup = { heading: ReactNode | null; rows: HeatmapRow[] };

/**
 * Rows down and the weeks across, each cell a button with its number written in it (`format`, a count by default), so
 * the heatmap is its own table view. One blue ramp shades the cells against `max`, the grey for 0 or an unknown value.
 * It scrolls sideways over many weeks, in a region named `label`; `corner` heads the rows' column. With `total`, a last
 * "Total" column holds each row's values summed.
 */
export function HeatmapTable({
  label,
  corner,
  weeks,
  groups,
  max,
  format = formatCount,
  total = false,
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
  selected: HeatmapSelection | null;
  onSelect: (cell: HeatmapSelection) => void;
}) {
  return (
    // Its container is a named tab stop for keyboard users, since it scrolls sideways.
    <Table className="w-auto" containerProps={{ tabIndex: 0, role: 'region', 'aria-label': label }}>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{corner}</TableHead>
          {weeks.map((week) => (
            <TableHead key={week} className="text-center">
              {weekLabel(week)}
            </TableHead>
          ))}
          {total && <TableHead className="text-right">Total</TableHead>}
        </TableRow>
      </TableHeader>
      {groups.map((group, g) => (
        <TableBody key={g}>
          {group.heading !== null && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead scope="rowgroup" colSpan={weeks.length + (total ? 2 : 1)} className="pt-3 font-semibold text-foreground">
                {group.heading}
              </TableHead>
            </TableRow>
          )}
          {group.rows.map((row) => (
            <TableRow key={row.id} className="border-0 hover:bg-transparent">
              <TableHead scope="row" className="font-normal">
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
                        'h-7 min-w-12 rounded-sm px-1 text-xs whitespace-nowrap tabular-nums',
                        cellShade(value ?? 0, max),
                        pressed && 'outline-2 outline-offset-1 outline-foreground',
                      )}
                    >
                      {text}
                    </button>
                  </TableCell>
                );
              })}
              {total && (
                <TableCell className="text-right text-xs tabular-nums">
                  {row.values.reduce<number>((sum, value) => sum + (value ?? 0), 0)}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      ))}
    </Table>
  );
}
