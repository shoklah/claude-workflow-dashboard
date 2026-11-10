import { useState, type ReactNode } from 'react';
import type { FindingsQuery, RunsResponse, StepsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Badge } from '../components/ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import {
  NONE,
  RULE_LABELS,
  STEP_LABELS,
  countsLabel,
  formatCost,
  formatPercent,
  formatTokens,
  reporterMark,
} from '../lib/format.ts';
import { ListFilters, listPath } from '../runs/RunsPage.tsx';

const COLUMNS = [
  'Step or rule',
  'Ran',
  'Found something',
  'Counts',
  'Fixed or applied',
  'Declined',
  'Deferred',
  'Open or to owner',
  'Tokens',
  'Est. cost',
];

/** The dashed mark on a figure from the latest export's totals, not summed over the period. */
function ReporterMark() {
  return (
    <Badge variant="outline" className="ml-2 border-dashed font-normal" title={reporterMark.tooltip}>
      {reporterMark.text}
    </Badge>
  );
}

const known = (n: number | null | undefined) => (n == null ? NONE : String(n));
const sum = (counts: Record<string, number> | null) =>
  counts === null ? null : Object.values(counts).reduce((total, n) => total + n, 0);

/** A rule's row: its name, what ran, what found something and its counts; a cost only for the advisor. */
function RuleRow(props: { name: ReactNode; ran: number | null; found?: number | null; counts: string; cost?: string }) {
  return (
    <TableRow>
      <TableHead scope="row">{props.name}</TableHead>
      <TableCell>{known(props.ran)}</TableCell>
      <TableCell>{known(props.found)}</TableCell>
      <TableCell>{props.counts}</TableCell>
      <TableCell colSpan={5} />
      <TableCell>{props.cost}</TableCell>
    </TableRow>
  );
}

/** The static page's "Rules and steps" table: each step kind, then each rule, over the period. */
function StepsTable({ response }: { response: StepsResponse }) {
  const { steps, rules, reporter } = response;
  const { advisor, startup } = reporter;
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Steps and rules' }}>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={COLUMNS.length} className="font-semibold">
            Steps
          </TableCell>
        </TableRow>
        {steps.map((row) => (
          <TableRow key={row.step}>
            <TableHead scope="row">{STEP_LABELS[row.step]}</TableHead>
            <TableCell>{row.ran}</TableCell>
            <TableCell>{row.found}</TableCell>
            <TableCell>{countsLabel(row.counts)}</TableCell>
            <TableCell>{row.fixedOrApplied}</TableCell>
            <TableCell>{row.declined}</TableCell>
            <TableCell>{row.deferred}</TableCell>
            <TableCell>{row.openOrToOwner}</TableCell>
            <TableCell>{formatTokens(row.tokens)}</TableCell>
            <TableCell>{formatCost(row.cost)}</TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={COLUMNS.length} className="font-semibold">
            Rules
          </TableCell>
        </TableRow>
        <RuleRow name={RULE_LABELS.failingTest} ran={sum(rules.failingTest)} counts={countsLabel(rules.failingTest)} />
        <RuleRow
          name={<>{RULE_LABELS.dispatchGuard}<ReporterMark /></>}
          ran={null}
          found={sum(reporter.dispatchGuard)}
          counts={countsLabel(reporter.dispatchGuard)}
        />
        <RuleRow
          name={<>{RULE_LABELS.advisor}<ReporterMark /></>}
          ran={advisor?.calls ?? null}
          counts={
            advisor
              ? `notes ${known(advisor.notes)} · changed ${known(advisor.changed)} · share ${formatPercent(advisor.share === null ? null : Math.round(advisor.share))}`
              : NONE
          }
          cost={formatCost(advisor?.cost ?? null)}
        />
        <RuleRow
          name={<>{RULE_LABELS.startup}<ReporterMark /></>}
          ran={startup && startup.with !== null && startup.without !== null ? startup.with + startup.without : null}
          counts={startup ? `with ${known(startup.with)} · without ${known(startup.without)}` : NONE}
        />
        <RuleRow name={RULE_LABELS.fixRoundCap} ran={null} counts={countsLabel(rules.fixRoundCap)} />
        <RuleRow name={RULE_LABELS.stopRule} ran={null} counts={countsLabel({ stops: rules.stopRule })} />
        {Object.entries(rules.offers).map(([skill, { offered, ...outcomes }]) => (
          <RuleRow key={skill} name={`${RULE_LABELS.offer} ${skill}`} ran={offered} counts={countsLabel(outcomes)} />
        ))}
      </TableBody>
    </Table>
  );
}

/** The Steps and rules page: each step kind and rule over the period, the reporter's all-time figures marked. */
export function StepsPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const steps = useLiveQuery<StepsResponse>(listPath('/api/steps', query));
  // The project options: every project of the longest period.
  const runs = useLiveQuery<RunsResponse>(listPath('/api/runs', { weeks: 52 }));
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Steps and rules</h1>
      <ListFilters query={query} projects={runs.data?.projects} onChange={(change) => setQuery({ ...query, ...change })} />
      {steps.isPending && <p className="text-sm text-muted-foreground">Loading the steps and rules…</p>}
      {steps.isError && <p className="text-sm">Couldn't load the steps and rules.</p>}
      {steps.data && <StepsTable response={steps.data} />}
    </div>
  );
}
