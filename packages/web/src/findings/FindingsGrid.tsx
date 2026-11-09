import type { Area, FindingCell, FindingsResponse } from '@cwd/shared';
import { cn } from 'cn';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { CategoryBadge } from '../runs/FindingsTable.tsx';
import { categoryLabel, cellShade, formatPercent, weekLabel } from '../lib/format.ts';

export type Measure = 'raised' | 'actedOn' | 'invalid';

/** A cell of the grid: a row's category (null for the unlabelled row) and a week. */
export type Selection = { category: string | null; week: string };

/** A cell's value under the measure: its count raised, or a whole percent of it, null when none was raised. */
function value(cell: FindingCell, measure: Measure): number | null {
  if (measure === 'raised') return cell.raised;
  return cell.raised === 0 ? null : Math.round((100 * cell[measure]) / cell.raised);
}

/**
 * The area's categories down and the weeks across, each cell a button with its number written in it, so the grid is
 * its own table view. One blue ramp shades the cells: a count against the grid's largest, a share against 100%.
 */
export function FindingsGrid({
  response,
  measure,
  area,
  selected,
  onSelect,
}: {
  response: FindingsResponse;
  measure: Measure;
  area: Area;
  selected: Selection | null;
  onSelect: (cell: Selection) => void;
}) {
  const rows = response.rows.filter((row) => row.area === area);
  const max = measure === 'raised' ? Math.max(0, ...rows.flatMap((row) => row.cells.map((c) => c.raised))) : 100;
  return (
    <Table aria-label="Findings by category and week" className="w-auto">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Category</TableHead>
          {response.weeks.map((week) => (
            <TableHead key={week} className="text-center">
              {weekLabel(week)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.category} className="border-0 hover:bg-transparent">
            <TableHead scope="row" className="font-normal">
              <CategoryBadge category={row.category} />
            </TableHead>
            {row.cells.map((cell, i) => {
              const week = response.weeks[i];
              const shown = value(cell, measure);
              const text = measure === 'raised' ? String(shown) : formatPercent(shown);
              const pressed = selected?.category === row.category && selected.week === week;
              return (
                <TableCell key={week} className="p-0.5">
                  <button
                    type="button"
                    aria-pressed={pressed}
                    aria-label={`${categoryLabel(row.category)}, week of ${weekLabel(week)}: ${text}`}
                    onClick={() => onSelect({ category: row.category, week })}
                    className={cn(
                      'h-7 w-12 rounded-sm text-xs tabular-nums',
                      cellShade(shown ?? 0, max),
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
    </Table>
  );
}
