import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import type { SpendGroupRow, SpendResponse, SpendRow } from '@cwd/shared';
import { GROUP, NUM, Num, SUB, Text } from '../components/Num.tsx';
import { LINK, SectionTitle } from '../components/Panel.tsx';
import { ShareBar } from '../components/ShareBar.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { SPEND_GROUP_COLORS } from '../home/WeeklyCharts.tsx';
import { SPEND_GROUP_LABELS, formatDollars, modelLabel, phaseLabel } from '../lib/format.ts';

/** A row's figures after its name: cost, share (none on the "All phases" row), cost by model and the advisor's calls
 * and cost. */
function Figures({ row, models, total = false }: { row: SpendRow; models: string[]; total?: boolean }) {
  return (
    <>
      <TableCell className={NUM}>
        <Num value={row.cost} format={formatDollars} />
      </TableCell>
      <TableCell>{!total && <ShareBar share={row.share} />}</TableCell>
      {models.map((model) => (
        <TableCell key={model} className={NUM}>
          <Num value={row.byModel[model] ?? null} format={formatDollars} />
        </TableCell>
      ))}
      <TableCell className={NUM}>
        <Num value={row.advisor.calls} />
      </TableCell>
      <TableCell className={NUM}>
        <Num value={row.advisor.cost} format={formatDollars} />
      </TableCell>
    </>
  );
}

/** A group's row, its chevron and colour's swatch before its name, and, when it names a phase other than itself and is
 * open, its phases' rows below it. */
function GroupRows({ row, models }: { row: SpendGroupRow; models: string[] }) {
  const [open, setOpen] = useState(false);
  const name = SPEND_GROUP_LABELS[row.group];
  const opens = row.phases.some((phase) => phase.name !== row.group);
  const Chevron = open ? ChevronDown : ChevronRight;
  const swatch = (
    <i
      aria-hidden
      className="inline-block size-2.5 flex-none rounded-swatch"
      style={{ background: SPEND_GROUP_COLORS[row.group] }}
    />
  );
  return (
    <>
      <TableRow className={cn('font-medium', open && 'border-b-0')}>
        <TableCell>
          {opens ? (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="flex items-center gap-2 rounded-sm text-left"
            >
              <Chevron aria-hidden className="size-4 flex-none text-muted-foreground" />
              {swatch}
              <span className={LINK}>{name}</span>
            </button>
          ) : (
            <span className="flex items-center gap-2 pl-6">
              {swatch}
              {name}
            </span>
          )}
        </TableCell>
        <Figures row={row} models={models} />
      </TableRow>
      {opens &&
        open &&
        row.phases.map((phase, i) => (
          <TableRow key={phase.name} className={cn(i < row.phases.length - 1 && 'border-b-0')}>
            <TableCell className="pl-13 text-muted-foreground">{phaseLabel(phase.name)}</TableCell>
            <Figures row={phase} models={models} />
          </TableRow>
        ))}
    </>
  );
}

/**
 * The period's spend by phase: "All phases" first, then a row per group, a group naming a phase other than itself
 * opening to its phases' rows, one column per model (the API's order, largest first), then the advisor's calls and
 * cost, counted apart. It scrolls sideways when the models are many.
 */
export function SpendTable({ response }: { response: SpendResponse }) {
  const { models } = response;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>By phase, over the period</SectionTitle>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Spend by phase' }}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Phase</TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Est. cost ($)
            </TableHead>
            <TableHead rowSpan={2}>Share</TableHead>
            {models.length > 0 && (
              <TableHead colSpan={models.length} scope="colgroup" className={GROUP}>
                By model ($)
              </TableHead>
            )}
            <TableHead colSpan={2} scope="colgroup" className={GROUP}>
              Advisor, counted apart
            </TableHead>
          </TableRow>
          <TableRow>
            {models.map((model) => (
              <TableHead key={model} className={cn(SUB, NUM)}>
                <Text value={modelLabel(model)} />
              </TableHead>
            ))}
            <TableHead className={cn(SUB, NUM)}>Calls</TableHead>
            <TableHead className={cn(SUB, NUM)}>Cost ($)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="font-semibold">
            <TableCell className="pl-8">All phases</TableCell>
            <Figures row={response.total} models={models} total />
          </TableRow>
          {response.groups.map((row) => (
            <GroupRows key={row.group} row={row} models={models} />
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
