import { useState } from 'react';
import { cn } from 'cn';
import type { FindingsQuery, StepsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { GroupHead, Lines, NUM, Num, SUB } from '../components/Num.tsx';
import { PageTitle, SectionTitle, State } from '../components/Panel.tsx';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { RULE_LABELS, STEP_LABELS, countLines, formatCompactFixed, formatDollars, total } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';

const OUTCOMES = ['Fixed or applied', 'Declined', 'Deferred', 'Open or to owner'];

/** Each step kind over the period, then each rule, in two tables: one value per cell, a count per line. */
function StepsTables({ response }: { response: StepsResponse }) {
  const { steps, rules } = response;
  const { advisor, startup } = rules;
  const n = (value: number | null | undefined) => <Num value={value} />;
  const dollars = (value: number | null | undefined) => <Num value={value} format={formatDollars} />;
  return (
    <>
      <SectionTitle>Steps</SectionTitle>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Steps' }}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Step</TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Ran
            </TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Found something
            </TableHead>
            <GroupHead span={2}>Counts</GroupHead>
            <GroupHead span={OUTCOMES.length}>Findings, by outcome</GroupHead>
            <TableHead rowSpan={2} className={NUM}>
              Tokens
            </TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Est. cost ($)
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className={SUB}>Count</TableHead>
            <TableHead className={cn(SUB, NUM)}>Number</TableHead>
            {OUTCOMES.map((column) => (
              <TableHead key={column} className={cn(SUB, NUM)}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((row) => (
            <Lines
              none="No counts"
              key={row.step}
              name={STEP_LABELS[row.step]}
              before={[n(row.ran), n(row.found)]}
              counts={countLines(row.counts)}
              after={[
                n(row.fixedOrApplied),
                n(row.declined),
                n(row.deferred),
                n(row.openOrToOwner),
                <Num value={row.tokens && total(row.tokens)} format={formatCompactFixed} />,
                dollars(row.cost),
              ]}
            />
          ))}
        </TableBody>
      </Table>
      <SectionTitle>Rules</SectionTitle>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Rules' }}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Rule</TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Ran
            </TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Found something
            </TableHead>
            <GroupHead span={2}>Counts</GroupHead>
            <TableHead rowSpan={2} className={NUM}>
              Est. cost ($)
            </TableHead>
          </TableRow>
          <TableRow>
            <TableHead className={SUB}>Count</TableHead>
            <TableHead className={cn(SUB, NUM)}>Number</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <Lines
            none="No counts"
            name={RULE_LABELS.failingTest}
            before={[n(total(rules.failingTest)), n(null)]}
            counts={countLines(rules.failingTest)}
            after={[n(null)]}
          />
          <Lines
            none="No counts"
            name={RULE_LABELS.dispatchGuard}
            before={[n(null), n(rules.dispatchGuard && total(rules.dispatchGuard))]}
            counts={countLines(rules.dispatchGuard)}
            after={[n(null)]}
          />
          <Lines
            none="No counts"
            name={RULE_LABELS.advisor}
            before={[n(advisor?.calls), n(null)]}
            counts={
              advisor && [
                ['Notes', advisor.notes],
                ['Notes that changed something', advisor.changed],
                ['Share of Fable spend (%)', advisor.share],
              ]
            }
            after={[dollars(advisor?.cost)]}
          />
          <Lines
            none="No counts"
            name={RULE_LABELS.startup}
            before={[n(startup && startup.with + startup.without), n(null)]}
            counts={
              startup && [
                ['Sessions with them', startup.with],
                ['Sessions without', startup.without],
              ]
            }
            after={[n(null)]}
          />
          <Lines
            none="No counts"
            name={RULE_LABELS.fixRoundCap}
            before={[n(null), n(null)]}
            counts={[
              ['Runs reaching round 3', rules.fixRoundCap.runs],
              ['Findings ruled', rules.fixRoundCap.ruled],
            ]}
            after={[n(null)]}
          />
          <Lines
            none="No counts"
            name={RULE_LABELS.stopRule}
            before={[n(null), n(null)]}
            counts={[['Stops', rules.stopRule]]}
            after={[n(null)]}
          />
          {Object.entries(rules.offers).map(([skill, { offered, ...outcomes }]) => (
            <Lines
              none="No counts"
              key={skill}
              name={`${RULE_LABELS.offer} of ${skill}`}
              before={[n(offered), n(null)]}
              counts={countLines(outcomes)}
              after={[n(null)]}
            />
          ))}
        </TableBody>
      </Table>
    </>
  );
}

/** The Steps and rules page: each step kind and rule over the period. */
export function StepsPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const steps = useLiveQuery<StepsResponse>(listPath('/api/steps', query));
  const projects = useProjects();
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Steps and rules</PageTitle>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })} />
      {steps.isPending && <State>Loading the steps and rules…</State>}
      {steps.isError && (
        <State error>Couldn't load the steps and rules. Check that the dashboard server is running, then refresh.</State>
      )}
      {steps.data && <StepsTables response={steps.data} />}
    </div>
  );
}
