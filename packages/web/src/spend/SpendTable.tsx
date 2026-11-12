import { useState } from 'react';
import type { SpendGroupRow, SpendResponse, SpendRow } from '@cwd/shared';
import { ShareBar } from '../components/ShareBar.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { SPEND_GROUP_COLORS } from '../home/WeeklyCharts.tsx';
import { SPEND_GROUP_LABELS, formatCost, phaseLabel } from '../lib/format.ts';

const COST = 'text-right tabular-nums';

/** A row's figures after its name: cost, share, cost by model and the advisor's calls and cost. */
function Figures({ row, models }: { row: SpendRow; models: string[] }) {
  return (
    <>
      <TableCell className={COST}>{formatCost(row.cost)}</TableCell>
      <TableCell>{row.share !== null && <ShareBar share={row.share} />}</TableCell>
      {models.map((model) => (
        <TableCell key={model} className={COST}>
          {formatCost(row.byModel[model] ?? null)}
        </TableCell>
      ))}
      <TableCell className={COST}>{row.advisor.calls}</TableCell>
      <TableCell className={COST}>{formatCost(row.advisor.cost)}</TableCell>
    </>
  );
}

/** A group's row after its colour's swatch and, when it names a phase other than itself and is open, its phases' rows
 * below it. */
function GroupRows({ row, models }: { row: SpendGroupRow; models: string[] }) {
  const [open, setOpen] = useState(false);
  const name = SPEND_GROUP_LABELS[row.group];
  const opens = row.phases.some((phase) => phase.name !== row.group);
  return (
    <>
      <TableRow className="font-semibold">
        <TableCell>
          <span aria-hidden className="mr-1.5 inline-block w-3 text-muted-foreground">
            {opens ? (open ? '▾' : '▸') : ''}
          </span>
          <i
            aria-hidden
            className="mr-1.5 inline-block size-2.5 rounded-xs align-baseline"
            style={{ background: SPEND_GROUP_COLORS[row.group] }}
          />
          {opens ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="text-left underline-offset-2 hover:underline"
            >
              {name}
            </button>
          ) : (
            name
          )}
        </TableCell>
        <Figures row={row} models={models} />
      </TableRow>
      {opens &&
        open &&
        row.phases.map((phase) => (
          <TableRow key={phase.name} className="text-muted-foreground">
            <TableCell className="pl-11">{phaseLabel(phase.name)}</TableCell>
            <Figures row={phase} models={models} />
          </TableRow>
        ))}
    </>
  );
}

/**
 * The period's spend by phase: a row per group, a group naming a phase other than itself opening to its phases' rows,
 * one column per model (the API's order, largest first), then the advisor's calls and cost, counted apart; a total row.
 * It scrolls sideways when the models are many.
 */
export function SpendTable({ response }: { response: SpendResponse }) {
  const { models } = response;
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-sm font-semibold">By phase, over the period</h2>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Spend by phase' }}>
        <TableHeader>
          <TableRow>
            <TableCell colSpan={3} />
            {models.length > 0 && (
              <TableHead colSpan={models.length} scope="colgroup" className="border-b text-center">
                By model
              </TableHead>
            )}
            <TableHead colSpan={2} scope="colgroup" className="border-b text-center">
              Advisor, counted apart
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead>Phase</TableHead>
            <TableHead className={COST}>Cost</TableHead>
            <TableHead>Share</TableHead>
            {models.map((model) => (
              <TableHead key={model} className={COST}>
                {model}
              </TableHead>
            ))}
            <TableHead className={COST}>Calls</TableHead>
            <TableHead className={COST}>Cost</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {response.groups.map((row) => (
            <GroupRows key={row.group} row={row} models={models} />
          ))}
          <TableRow className="border-t font-semibold">
            <TableCell>Total</TableCell>
            <Figures row={response.total} models={models} />
          </TableRow>
        </TableBody>
      </Table>
    </section>
  );
}
