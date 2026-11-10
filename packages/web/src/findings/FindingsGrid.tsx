import type { Area, FindingCell, FindingsResponse } from '@cwd/shared';
import { HeatmapTable } from '../components/HeatmapTable.tsx';
import { CategoryBadge } from '../runs/FindingsTable.tsx';
import { categoryLabel, formatCount, formatPercent } from '../lib/format.ts';

export type Measure = 'raised' | 'actedOn' | 'invalid';

/** A cell of the grid: a row's category (null for the unlabelled row) and a week. */
export type Selection = { category: string | null; week: string };

/** A cell's value under the measure: its count raised, or a whole percent of it, null when none was raised. */
function value(cell: FindingCell, measure: Measure): number | null {
  if (measure === 'raised') return cell.raised;
  return cell.raised === 0 ? null : Math.round((100 * cell[measure]) / cell.raised);
}

/**
 * The area's categories down and the weeks across, in the heatmap: a count shaded against the grid's largest, a share
 * against 100%.
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
  const label = (category: string | null) => categoryLabel(category, response.categoryLabels);
  const max = measure === 'raised' ? Math.max(0, ...rows.flatMap((row) => row.cells.map((c) => c.raised))) : 100;
  return (
    <HeatmapTable
      label="Findings by category and week"
      corner="Category"
      weeks={response.weeks}
      groups={[
        {
          heading: null,
          rows: rows.map((row) => ({
            key: label(row.category),
            header: <CategoryBadge category={row.category} labels={response.categoryLabels} />,
            values: row.cells.map((cell) => value(cell, measure)),
          })),
        },
      ]}
      max={max}
      format={measure === 'raised' ? formatCount : formatPercent}
      selected={selected && { key: label(selected.category), week: selected.week }}
      onSelect={(cell) =>
        onSelect({ category: rows.find((row) => label(row.category) === cell.key)!.category, week: cell.week })
      }
    />
  );
}
