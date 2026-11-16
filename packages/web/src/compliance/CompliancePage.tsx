import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import { cn } from 'cn';
import type { ComplianceResponse, FindingsQuery, StepKind } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { HeatmapTable, type HeatmapGroup, type HeatmapSelection } from '../components/HeatmapTable.tsx';
import { Text, Unknown } from '../components/Num.tsx';
import { Line, PageTitle, Pairs, Panel, SectionTitle, State } from '../components/Panel.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { ReporterMark } from '../components/ReporterMark.tsx';
import { WarningText } from '../components/WarningText.tsx';
import { Option, Options } from '../components/Option.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import {
  FAMILY_LABELS,
  STEP_LABELS,
  WARNING_INK,
  hiddenInformationLabel,
  hiddenWarningsLabel,
  informationMark,
  kindLabel,
  plural,
  projectLabel,
  total,
  warningsSummary,
  weekLabel,
} from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';

/** The rows by family, each family's run of rows under its name, in the response's order. */
function groupsOf(rows: ComplianceResponse['rows']): HeatmapGroup[] {
  const groups: (HeatmapGroup & { family: string })[] = [];
  for (const row of rows) {
    if (groups.at(-1)?.family !== row.family) {
      groups.push({ family: row.family, heading: FAMILY_LABELS[row.family] ?? row.family, rows: [] });
    }
    const name = kindLabel(row.kind);
    groups.at(-1)!.rows.push({ id: row.kind ?? '', name, values: row.cells });
  }
  return groups;
}

/** A reporter's information line as a term and its value, split at the first ": "; a line with none is "Line N". */
function informationPair(line: string, i: number): [string, string] {
  const at = line.indexOf(': ');
  return at < 0 ? [`Line ${i + 1}`, line] : [line.slice(0, at), line.slice(at + 2)];
}

/**
 * The Compliance page: the period's warnings by kind and week, the kinds grouped by family, each kind's total, current
 * ones or including resolved, under a line summing them; the selected cell's warnings below the grid. `step`, from the
 * URL, keeps the warnings naming that step. The reporter's information lines last, when the export has them.
 */
export function CompliancePage({ step }: { step?: StepKind }) {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const [resolved, setResolved] = useState(false);
  const [selected, setSelected] = useState<HeatmapSelection | null>(null);
  const compliance = useLiveQuery<ComplianceResponse>(listPath('/api/compliance', { ...query, resolved, step }));
  const projects = useProjects();
  const data = compliance.data;
  // A selected cell counts only while its row is in the grid, which showing mode can leave out.
  const cell = data && selected && data.rows.some((row) => (row.kind ?? '') === selected.id) ? selected : null;
  const listed = data && cell ? data.warnings.filter((w) => (w.kind ?? '') === cell.id && w.week === cell.week) : [];
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Compliance</PageTitle>
      <ListFilters
        query={query}
        projects={projects}
        onChange={(change) => {
          setQuery({ ...query, ...change });
          setSelected(null);
        }}
      >
        <Options label="Warnings" shown>
          {[false, true].map((option) => (
            <Option
              key={String(option)}
              pressed={resolved === option}
              onClick={() => {
                setResolved(option);
                setSelected(null);
              }}
            >
              {option ? 'Including resolved' : 'Current'}
            </Option>
          ))}
        </Options>
        {step && (
          <span className="inline-flex items-center gap-1 rounded-control border border-input px-3 py-1">
            Step: {STEP_LABELS[step]}
            <Link to="/compliance" aria-label="Clear the step filter" className="rounded-full hover:bg-accent">
              <X className="size-3.5" aria-hidden />
            </Link>
          </span>
        )}
      </ListFilters>
      {compliance.isPending && <State>Loading the warnings…</State>}
      {compliance.isError && (
        <State error>Couldn't load the warnings. Check that the dashboard server is running, then refresh.</State>
      )}
      {data &&
        (data.rows.length === 0 ? (
          <Line>
            {data.hidden > 0
              ? 'No warnings to show in this period: showing mode leaves out other projects.'
              : 'No warnings in this period. A warning shows here when the reporter flags a run or session.'}
          </Line>
        ) : (
          <>
            <Line>{warningsSummary(total(data.rows.flatMap((row) => row.cells)), data.weeks.length, data.newWarnings)}</Line>
            <HeatmapTable
              label="Warnings by kind and week"
              corner="Kind"
              weeks={data.weeks}
              groups={groupsOf(data.rows)}
              max={Math.max(0, ...data.rows.flatMap((row) => row.cells))}
              total
              selected={cell}
              onSelect={setSelected}
            />
          </>
        ))}
      {cell && (
        <>
          <SectionTitle>
            {`${plural(listed.length, 'warning')} of "${kindLabel(cell.id || null)}", week of ${weekLabel(cell.week)}`}
          </SectionTitle>
          <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Warnings' }}>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Warning</TableHead>
                <TableHead>Since you last looked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listed.map((w) => (
                <TableRow key={`${w.runKey} ${w.sessionId} ${w.text}`}>
                  <TableCell className="align-top font-medium">
                    {w.runKey === null ? (
                      <Unknown label="no run" />
                    ) : (
                      <RunLink runKey={w.runKey} branch={w.branch} />
                    )}
                  </TableCell>
                  <TableCell className="align-top text-muted-foreground">
                    {w.runKey === null ? projectLabel(w.project) : <Text value={w.project} />}
                  </TableCell>
                  <TableCell className="min-w-64 whitespace-normal">
                    <span className="flex flex-col gap-1">
                      <WarningText text={w.text} sessionId={w.sessionId} branch={w.branch} />
                    </span>
                  </TableCell>
                  <TableCell className={cn('align-top', w.isNew ? WARNING_INK : 'text-muted-foreground')}>
                    {w.isNew ? 'New' : 'Seen'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
      {data && data.rows.length > 0 && !cell && <Line>Select a cell to list its warnings.</Line>}
      {data && data.hidden > 0 && <Line>{hiddenWarningsLabel(data.hidden)}</Line>}
      {data?.information && (
        <Panel title="Information from the reporter" aside={<ReporterMark mark={informationMark} />}>
          {data.information.hidden > 0 ? (
            <p className="text-sm text-muted-foreground">{hiddenInformationLabel(data.information.hidden)}</p>
          ) : (
            <Pairs text className="max-w-3xl" pairs={data.information.lines.map(informationPair)} />
          )}
          <p className="text-xs text-muted-foreground">Not warnings, and not filtered by period.</p>
        </Panel>
      )}
    </div>
  );
}
