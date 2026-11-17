import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import type { ChangeResponse, RunFacts } from '@cwd/shared';
import { ApiError, useLiveQuery } from '../api.ts';
import { EmptyRow, GroupHead, NUM, Num, SUB, TITLE, Text, Unknown, WRAP } from '../components/Num.tsx';
import { LINK, PageTitle, Pairs, Section, State } from '../components/Panel.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import {
  STAGE_LABELS,
  closedFindings,
  formatCost,
  formatDollars,
  formatWhole,
  foundFindings,
  otherProjectsLabel,
  pathLabel,
  projectLabel,
} from '../lib/format.ts';
import { SessionGraph } from './SessionGraph.tsx';
import { SessionsByWork } from './SessionsByWork.tsx';

/** The Runs table's columns, with the Project and Path columns. */
const COLUMN_COUNT = 10;

/** The change's runs and plan records, newest first as the API gives them: each title linking to its page, its project
 * (with `project`, when the change ran in several), branch, path (with `path`, when it has a plan record), finish,
 * time, tasks, findings found and closed, and cost. */
function RunsOfChange({ runs, project, path }: { runs: RunFacts[]; project: boolean; path: boolean }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Runs table' }}>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Run</TableHead>
          {project && <TableHead rowSpan={2}>Project</TableHead>}
          <TableHead rowSpan={2}>Branch</TableHead>
          {path && <TableHead rowSpan={2}>Path</TableHead>}
          <TableHead rowSpan={2}>Finished</TableHead>
          <TableHead rowSpan={2} className={cn(NUM, WRAP)}>
            Time (min)
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Tasks
          </TableHead>
          <GroupHead span={2}>Findings</GroupHead>
          <TableHead rowSpan={2} className={cn(NUM, WRAP)}>
            Est. cost ($)
          </TableHead>
        </TableRow>
        <TableRow>
          <TableHead className={cn(SUB, NUM)}>Found</TableHead>
          <TableHead className={cn(SUB, NUM)}>Closed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.length === 0 && (
          <EmptyRow columns={COLUMN_COUNT - Number(!project) - Number(!path)}>
            No runs yet. A run shows here once its record is written and imported.
          </EmptyRow>
        )}
        {runs.map((run) => (
          <TableRow key={run.key}>
            <TableCell className={cn(TITLE, 'font-medium')}>
              <RunLink runKey={run.key} branch={run.branch} title={run.headline} />
            </TableCell>
            {project && <TableCell className={cn(WRAP, 'text-muted-foreground')}>{run.project}</TableCell>}
            <TableCell className={cn(WRAP, 'text-muted-foreground')}>
              <Text value={run.branch} unknown="no branch" />
            </TableCell>
            {path && (
              <TableCell className="text-muted-foreground">
                <Text value={pathLabel(run.path)} />
              </TableCell>
            )}
            <TableCell className={cn(WRAP, 'text-muted-foreground tabular-nums')}>
              {run.finishedAt === null ? <Text value={null} /> : <Time iso={run.finishedAt} />}
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.minutes} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.tasks} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={foundFindings(run)} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={closedFindings(run)} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.cost} format={formatDollars} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** The change's facts, each a term over its value on the backdrop: Other projects and Spec only when it has them. */
function Facts({ change }: { change: ChangeResponse }) {
  const time = (iso: string | null) => (iso ? <Time iso={iso} /> : <Unknown backdrop />);
  const pairs: [string, ReactNode][] = [
    [
      'Goal',
      change.goal ? (
        <Link to="/work/goals/$key" params={{ key: change.goal.key }} className={LINK}>
          {change.goal.name}
        </Link>
      ) : (
        <Unknown backdrop label="no goal" />
      ),
    ],
    ['Project', projectLabel(change.project)],
    ...(change.otherCount > 0
      ? [['Other projects', otherProjectsLabel(change.otherProjects, change.otherCount)] as [string, ReactNode]]
      : []),
    ['Path', pathLabel(change.path)],
    ['Stage', STAGE_LABELS[change.stage]],
    ['Started', time(change.startedAt)],
    ['Last activity', time(change.lastActivity)],
    ['Sessions', formatWhole(change.sessionCount)],
    ['Runs', formatWhole(change.runCount)],
    ['Est. cost', change.cost === null ? <Unknown backdrop /> : formatCost(change.cost)],
    ...(change.spec ? [['Spec', change.spec] as [string, ReactNode]] : []),
  ];
  return <Pairs inline="over" backdrop className="gap-x-10 gap-y-3" pairs={pairs} />;
}

/**
 * A change's page: a link back to Work, its title and facts, how the work spread across its sessions, its runs and
 * its sessions. A key Work doesn't list gets its own message.
 */
export function ChangePage({ changeKey }: { changeKey: string }) {
  const change = useLiveQuery<ChangeResponse>(`/api/work/changes/${encodeURIComponent(changeKey)}`);
  if (change.isPending) return <State>Loading the change…</State>;
  if (change.error instanceof ApiError && change.error.status === 404) {
    return (
      <State error>
        {"This change isn't in the data any more. "}
        <Link to="/work" className={LINK}>
          Work
        </Link>
      </State>
    );
  }
  if (change.isError) return <State error>Couldn't load the change.</State>;
  const { data } = change;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link to="/work" className={cn('w-fit text-sm', LINK)}>
          Work
        </Link>
        <PageTitle>{data.title}</PageTitle>
        <Facts change={data} />
      </div>
      <SessionGraph graph={data.graph} label="change" />
      <Section title="Runs">
        <RunsOfChange runs={data.runs} project={data.otherCount > 0} path={data.runs.some((run) => run.path === 'plan')} />
      </Section>
      <Section title="Sessions">
        <SessionsByWork sessions={data.sessions} change={false} />
      </Section>
    </div>
  );
}
