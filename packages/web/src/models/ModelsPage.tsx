import { Fragment, useState, type ReactNode } from 'react';
import { cn } from 'cn';
import type { FindingsQuery, ModelsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { GROUP, NUM, Num, SUB, Text, Unknown } from '../components/Num.tsx';
import { PageTitle, Pairs, Panel, SectionTitle, State } from '../components/Panel.tsx';
import { ReporterMark } from '../components/ReporterMark.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import {
  WARNING_INK,
  countLabel,
  formatCost,
  formatDollars,
  formatShare,
  formatTokens,
  pathLabel,
  splitPair,
  weekLabel,
  yesNoLabel,
} from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';

const NO_FACTS = 'No advisor facts: the export is from before the reporter counted them.';
const STAGES = ['1', '2', '3', 'out'];

type Pair = { model: string | null; effort: string | null; count: number };
const pairsOf = (counts: Record<string, number>): Pair[] =>
  Object.entries(counts).map(([pair, count]) => ({ ...splitPair(pair), count }));

/** One side of a line: a model, its effort and how many ran so; past the list's end an empty cell, or `none` on the
 * first line of an empty list. */
function PairCells({ pairs, line, unset, none }: { pairs: Pair[]; line: number; unset: string; none: string }) {
  const pair = pairs[line];
  if (!pair) {
    return (
      <TableCell colSpan={3} className="text-muted-foreground">
        {line === 0 && none}
      </TableCell>
    );
  }
  return (
    <>
      <TableCell>
        <Text value={pair.model} unknown={unset} />
      </TableCell>
      <TableCell>
        <Text value={pair.effort} unknown={unset} />
      </TableCell>
      <TableCell className={NUM}>
        <Num value={pair.count} />
      </TableCell>
    </>
  );
}

/** A table's one row saying it has none, across its columns. */
function EmptyRow({ columns, children }: { columns: number; children: ReactNode }) {
  return (
    <TableRow>
      <TableCell colSpan={columns} className="text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

/** A line's classes: no border before the item's next line. */
const lineClass = (line: number, lines: number) => cn(line < lines - 1 && 'border-b-0');

/** The Models and advisor tables: agents, main sessions, the advisor's facts and its weeks; one value per cell. */
function ModelsTables({ response }: { response: ModelsResponse }) {
  const { agents, byPath, advisor } = response;
  const facts = advisor.facts;
  const roles = Object.entries(facts?.byRole ?? {});
  const failed = Object.entries(facts?.failed ?? {});
  return (
    <>
      <SectionTitle>Agents</SectionTitle>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Agents' }}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Agent</TableHead>
            <TableHead colSpan={3} className={GROUP}>
              Requested
            </TableHead>
            <TableHead colSpan={3} className={GROUP}>
              Ran on
            </TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Mismatches
              <ReporterMark />
            </TableHead>
          </TableRow>
          <TableRow>
            {['requested', 'actual'].map((side) => (
              <Fragment key={side}>
                <TableHead className={SUB}>Model</TableHead>
                <TableHead className={SUB}>Effort</TableHead>
                <TableHead className={cn(SUB, NUM)}>Dispatches</TableHead>
              </Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {agents.length === 0 && (
            <EmptyRow columns={8}>
              No dispatches in this period. An agent shows here once a run or session dispatches it.
            </EmptyRow>
          )}
          {agents.flatMap((row) => {
            const requested = pairsOf(row.requested);
            const actual = pairsOf(row.actual);
            const lines = Math.max(1, requested.length, actual.length);
            return Array.from({ length: lines }, (_, i) => (
              <TableRow key={`${row.name} ${i}`} className={lineClass(i, lines)}>
                {i === 0 && (
                  <TableHead scope="row" rowSpan={lines} className="h-auto py-2 align-top">
                    {row.name}
                  </TableHead>
                )}
                <PairCells pairs={requested} line={i} unset="not set" none="No dispatches" />
                <PairCells pairs={actual} line={i} unset="not known" none="No dispatches" />
                {i === 0 && (
                  <TableCell rowSpan={lines} className={cn(NUM, 'align-top')}>
                    <Num value={row.mismatches} />
                  </TableCell>
                )}
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>

      <SectionTitle>Main sessions</SectionTitle>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Main sessions' }}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Path</TableHead>
            <TableHead colSpan={4} className={GROUP}>
              Recommended, by stage
              <ReporterMark />
            </TableHead>
            <TableHead colSpan={3} className={GROUP}>
              Ran on
            </TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Differs
              <ReporterMark />
            </TableHead>
          </TableRow>
          <TableRow>
            {['Stage 1', 'Stage 2', 'Stage 3', 'Out'].map((stage) => (
              <TableHead key={stage} className={SUB}>
                {stage}
              </TableHead>
            ))}
            <TableHead className={SUB}>Model</TableHead>
            <TableHead className={SUB}>Effort</TableHead>
            <TableHead className={cn(SUB, NUM)}>Sessions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {byPath.flatMap((row) => {
            const actual = pairsOf(row.actual);
            const lines = Math.max(1, actual.length);
            return Array.from({ length: lines }, (_, i) => (
              <TableRow key={`${row.path} ${i}`} className={lineClass(i, lines)}>
                {i === 0 && (
                  <TableHead scope="row" rowSpan={lines} className="h-auto py-2 align-top">
                    {pathLabel(row.path)}
                  </TableHead>
                )}
                {i === 0 &&
                  STAGES.map((stage) => {
                    const { model, effort } = splitPair(row.recommended?.[stage] ?? '-');
                    return (
                      <TableCell key={stage} rowSpan={lines} className="align-top">
                        <Text value={model} unknown="none" />
                        {effort && <span className="block text-xs text-muted-foreground">{effort}</span>}
                      </TableCell>
                    );
                  })}
                <PairCells pairs={actual} line={i} unset="not known" none="No sessions" />
                {i === 0 && (
                  <TableCell rowSpan={lines} className={cn(NUM, 'align-top')}>
                    <Num value={row.differs} />
                  </TableCell>
                )}
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>

      <SectionTitle>Advisor</SectionTitle>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="This period">
          {facts === null ? (
            <p className="text-sm text-muted-foreground">{NO_FACTS}</p>
          ) : (
            <Pairs
              pairs={[
                ['Calls', <Num value={facts.calls} />],
                ['Tokens', formatTokens(facts.tokens)],
                ['Est. cost', formatCost(facts.cost)],
                ['Notes', <Num value={facts.notes} />],
                ['Notes that changed something', <Num value={facts.changed} />],
                ['Notes missing', <Num value={facts.missing} />],
                ['Share of Fable spend', formatShare(facts.share)],
              ]}
            />
          )}
          <p className="border-t pt-3 text-sm">
            <span className="text-muted-foreground">Trial</span>
            <ReporterMark />
            <span className="mt-1 block">
              <Text value={advisor.reporter.trial} />
            </span>
          </p>
        </Panel>
        <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Advisor calls by role' }}>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className={NUM}>Calls</TableHead>
              <TableHead>May consult</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.length === 0 && (
              <EmptyRow columns={3}>{facts === null ? NO_FACTS : 'No advisor calls in this period.'}</EmptyRow>
            )}
            {roles.map(([role, { calls, flagged }]) => (
              <TableRow key={role}>
                <TableHead scope="row">{role}</TableHead>
                <TableCell className={NUM}>
                  <Num value={calls} />
                </TableCell>
                <TableCell>
                  <span className={flagged ? WARNING_INK : 'text-muted-foreground'}>{yesNoLabel(!flagged)}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Failed calls, by error' }}>
          <TableHeader>
            <TableRow>
              <TableHead>Failed calls, by error</TableHead>
              <TableHead className={NUM}>Calls</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {failed.length === 0 && (
              <EmptyRow columns={2}>{facts === null ? NO_FACTS : 'No failed calls in this period.'}</EmptyRow>
            )}
            {failed.map(([code, calls]) => (
              <TableRow key={code}>
                <TableHead scope="row">{countLabel(code)}</TableHead>
                <TableCell className={NUM}>
                  <Num value={calls} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SectionTitle>Advisor spend by week</SectionTitle>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Advisor spend by week' }}>
        <TableHeader>
          <TableRow>
            <TableHead>
              Week
              <ReporterMark />
            </TableHead>
            <TableHead className={NUM}>Advisor ($)</TableHead>
            <TableHead className={NUM}>Fable ($)</TableHead>
            <TableHead className={NUM}>Share (%)</TableHead>
            <TableHead>Past the stop share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {advisor.reporter.weeks.length === 0 && <EmptyRow columns={5}>No advisor weeks in this period.</EmptyRow>}
          {advisor.reporter.weeks.map((week) => (
            <TableRow key={week.week}>
              <TableHead scope="row">{weekLabel(week.week)}</TableHead>
              <TableCell className={NUM}>
                <Num value={week.advisor} format={formatDollars} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={week.fable} format={formatDollars} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={week.share} />
              </TableCell>
              <TableCell>
                {week.stop === null ? (
                  <Unknown />
                ) : (
                  <span className={week.stop ? WARNING_INK : 'text-muted-foreground'}>{yesNoLabel(week.stop)}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}

/** The Models and advisor page: the period's models by agent and path and its advisor facts, and the reporter's trial
 * and advisor weeks. */
export function ModelsPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const models = useLiveQuery<ModelsResponse>(listPath('/api/models', query));
  const projects = useProjects();
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Models and advisor</PageTitle>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })} />
      {models.isPending && <State>Loading the models and advisor…</State>}
      {models.isError && <State error>Couldn't load the models and advisor.</State>}
      {models.data && <ModelsTables response={models.data} />}
    </div>
  );
}
