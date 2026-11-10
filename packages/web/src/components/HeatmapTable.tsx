import type { ReactNode } from 'react';
import { cn } from 'cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table.tsx';
import { cellShade, formatCount, weekLabel } from '../lib/format.ts';

/** A cell of a heatmap: its row's key and a week. */
export type HeatmapSelection = { key: string; week: string };

/** A row of a heatmap: `key` names it in its cells' labels and in the selection, `header` is what its header shows. */
export type HeatmapRow = { key: string; header: ReactNode; values: (number | null)[] };

/** A group of rows, under a full-width heading row unless its heading is null. */
export type HeatmapGroup = { heading: ReactNode | null; rows: HeatmapRow[] };

/**
 * Rows down and the weeks across, each cell a button with its number written in it (`format`, a count by default), so
 * the heatmap is its own table view. One blue ramp shades the cells against `max`, the grey for 0 or an unknown value.
 * It scrolls sideways over many weeks, in a region named `label`; `corner` heads the rows' column.
 */
export function HeatmapTable({
  label,
  corner,
  weeks,
  groups,
  max,
  format = formatCount,
  selected,
  onSelect,
}: {
  label: string;
  corner: string;
  weeks: string[];
  groups: HeatmapGroup[];
  max: number;
  format?: (value: number | null) => string;
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
        </TableRow>
      </TableHeader>
      {groups.map((group, g) => (
        <TableBody key={g}>
          {group.heading !== null && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableHead scope="rowgroup" colSpan={weeks.length + 1} className="pt-3 font-semibold text-foreground">
                {group.heading}
              </TableHead>
            </TableRow>
          )}
          {group.rows.map((row) => (
            <TableRow key={row.key} className="border-0 hover:bg-transparent">
              <TableHead scope="row" className="font-normal">
                {row.header}
              </TableHead>
              {row.values.map((value, i) => {
                const week = weeks[i];
                const text = format(value);
                const pressed = selected?.key === row.key && selected.week === week;
                return (
                  <TableCell key={week} className="p-0.5">
                    <button
                      type="button"
                      aria-pressed={pressed}
                      aria-label={`${row.key}, week of ${weekLabel(week)}: ${text}`}
                      onClick={() => onSelect({ key: row.key, week })}
                      className={cn(
                        'h-7 w-12 rounded-sm text-xs tabular-nums',
                        cellShade(value ?? 0, max),
                        pressed && 'outline-2 outline-offset-1 outline-foreground',
                      )}
                    >
                      {text}
                    </button>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      ))}
    </Table>
  );
}
