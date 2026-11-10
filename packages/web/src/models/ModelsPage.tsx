import { useState, type ReactNode } from 'react';
import type { FindingsQuery, ModelsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { ReporterMark } from '../components/ReporterMark.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import {
  NONE,
  advisorRolesLabel,
  countsLabel,
  formatCost,
  formatCount,
  formatShare,
  formatTokens,
  stageTableLabel,
  stopLabel,
  weekLabel,
} from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';

/** A table under the static page's column names, a row saying `empty` when it has no rows, scrolling sideways in a
 * region named `label`. */
function ModelsTable(props: { label: string; columns: ReactNode[]; empty?: string; children: ReactNode[] }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': props.label }}>
      <TableHeader>
        <TableRow>
          {props.columns.map((column, i) => (
            <TableHead key={i}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {props.children.length === 0 && (
          <TableRow>
            <TableCell colSpan={props.columns.length} className="text-muted-foreground">
              {props.empty}
            </TableCell>
          </TableRow>
        )}
        {props.children}
      </TableBody>
    </Table>
  );
}

const marked = (name: string) => (
  <>
    {name}
    <ReporterMark />
  </>
);

/** The static page's "Models and advisor" tables: agents, main sessions, the advisor's facts and its weeks. */
function ModelsTables({ response }: { response: ModelsResponse }) {
  const { agents, main, advisor } = response;
  const facts = advisor.facts;
  const notes = facts ? countsLabel({ notes: facts.notes, changed: facts.changed, missing: facts.missing }) : NONE;
  const advisorRows: [ReactNode, string][] = [
    ['calls by role', advisorRolesLabel(facts?.byRole ?? null)],
    ['failed calls', countsLabel(facts?.failed ?? null)],
    ['tokens', formatTokens(facts?.tokens ?? null)],
    ['est. cost', formatCost(facts?.cost ?? null)],
    ['notes', notes],
    [marked('trial'), advisor.reporter.trial ?? NONE],
  ];
  return (
    <>
      <h2 className="font-semibold">Agents</h2>
      <ModelsTable label="Agents" columns={['Agent', 'Requested', 'Ran on', marked('Mismatches')]} empty="No dispatches in this period.">
        {agents.map((row) => (
          <TableRow key={row.name}>
            <TableHead scope="row">{row.name}</TableHead>
            <TableCell>{countsLabel(row.requested)}</TableCell>
            <TableCell>{countsLabel(row.actual)}</TableCell>
            <TableCell>{formatCount(row.mismatches)}</TableCell>
          </TableRow>
        ))}
      </ModelsTable>
      <h2 className="font-semibold">Main sessions</h2>
      <ModelsTable label="Main sessions" columns={['Main session', marked('Stage table'), 'Ran on', marked('Differs')]}>
        {main.map((row) => (
          <TableRow key={row.path}>
            <TableHead scope="row">{row.path}</TableHead>
            <TableCell>{stageTableLabel(row.recommended)}</TableCell>
            <TableCell>{countsLabel(row.actual)}</TableCell>
            <TableCell>{formatCount(row.differs)}</TableCell>
          </TableRow>
        ))}
      </ModelsTable>
      <h2 className="font-semibold">Advisor</h2>
      <ModelsTable label="Advisor" columns={['Advisor', 'Value']}>
        {advisorRows.map(([name, value], i) => (
          <TableRow key={i}>
            <TableHead scope="row">{name}</TableHead>
            <TableCell>{value}</TableCell>
          </TableRow>
        ))}
      </ModelsTable>
      <ModelsTable
        label="Advisor weeks"
        columns={[marked('Week'), 'Advisor', 'Fable', 'Share', 'Stop']}
        empty="No advisor weeks in this period."
      >
        {advisor.reporter.weeks.map((week) => (
          <TableRow key={week.week}>
            <TableHead scope="row">{weekLabel(week.week)}</TableHead>
            <TableCell>{formatCost(week.advisor)}</TableCell>
            <TableCell>{formatCost(week.fable)}</TableCell>
            <TableCell>{formatShare(week.share)}</TableCell>
            <TableCell>{stopLabel(week.stop)}</TableCell>
          </TableRow>
        ))}
      </ModelsTable>
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
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Models and advisor</h1>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })} />
      {models.isPending && <p className="text-sm text-muted-foreground">Loading the models and advisor…</p>}
      {models.isError && <p className="text-sm">Couldn't load the models and advisor.</p>}
      {models.data && <ModelsTables response={models.data} />}
    </div>
  );
}
