import type { Area, FindingCell, FindingsResponse } from '@cwd/shared';
import { HeatmapTable } from '../components/HeatmapTable.tsx';
import { CategoryBadge } from '../runs/FindingsTable.tsx';
import { byAppSplit, categoryLabel, formatCount, formatPercent } from '../lib/format.ts';

export type Measure = 'raised' | 'actedOn' | 'invalid' | 'appDiffers' | 'strengths';

// The measures that are counts; the others are shares of the findings raised.
const COUNTS: Measure[] = ['raised', 'appDiffers', 'strengths'];

/** A cell of the grid: a row's category (null for the unlabelled row) and a week. */
export type Selection = { category: string | null; week: string };

/** A cell's value under the measure: a count, or a whole percent of the count raised, null when none was raised. */
function value(cell: FindingCell, measure: Measure): number | null {
  if (COUNTS.includes(measure)) return cell[measure];
  return cell.raised === 0 ? null : Math.round((100 * cell[measure]) / cell.raised);
}

/** Whether any finding in the response's period shows the workflow's label: a labelled row's count not the app's. */
export function workflowLabelled(response: FindingsResponse): boolean {
  return response.rows.some((row) => row.category !== null && row.cells.some((c) => c.raised > c.byApp));
}

/**
 * The area's categories down and the weeks across, in the heatmap: a count shaded against the grid's largest, a share
 * against 100%. Once a finding of the period shows the workflow's label, a raised count with some of it the app's says
 * so ("2 · 1 by the app") and the categories leave the app's dashed badge; until then the page's line says every label
 * is the app's.
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
  const count = COUNTS.includes(measure);
  const max = count ? Math.max(0, ...rows.flatMap((row) => row.cells.map((c) => value(c, measure) ?? 0))) : 100;
  const byWorkflow = workflowLabelled(response);
  return (
    <HeatmapTable
      label="Findings by category and week"
      corner="Category"
      weeks={response.weeks}
      groups={[
        {
          heading: null,
          rows: rows.map((row) => ({
            id: row.category ?? '',
            name: label(row.category),
            header: (
              <CategoryBadge
                category={row.category}
                judge={byWorkflow ? null : 'app'}
                labels={response.categoryLabels}
              />
            ),
            values: row.cells.map((cell) => value(cell, measure)),
            texts: byWorkflow && measure === 'raised' ? row.cells.map(byAppSplit) : undefined,
          })),
        },
      ]}
      max={max}
      format={count ? formatCount : formatPercent}
      selected={selected && { id: selected.category ?? '', week: selected.week }}
      onSelect={(cell) =>
        onSelect({ category: cell.id || null, week: cell.week })
      }
    />
  );
}
