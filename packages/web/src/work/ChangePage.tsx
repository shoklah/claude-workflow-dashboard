import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import type { ChangeResponse } from '@cwd/shared';
import { ApiError, useLiveQuery } from '../api.ts';
import { GoalLink } from '../components/GoalLink.tsx';
import { Unknown } from '../components/Num.tsx';
import { LINK, PageTitle, Pairs, Section, State } from '../components/Panel.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { STAGE_LABELS, formatCost, formatWhole, otherProjectsLabel, pathLabel, projectLabel } from '../lib/format.ts';
import { RunsTable } from '../runs/RunsTable.tsx';
import { SessionGraph } from './SessionGraph.tsx';
import { SessionsByWork } from './SessionsByWork.tsx';

/** The change's facts, each a term over its value on the backdrop: Other projects and Spec only when it has them. */
function Facts({ change }: { change: ChangeResponse }) {
  const time = (iso: string | null) => (iso ? <Time iso={iso} /> : <Unknown backdrop />);
  const pairs: [string, ReactNode][] = [
    [
      'Goal',
      change.goal ? (
        <GoalLink goalKey={change.goal.key} name={change.goal.name} />
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
        <RunsTable runs={data.runs} of={{ project: data.otherCount > 0, path: data.runs.some((run) => run.path === 'plan') }} />
      </Section>
      <Section title="Sessions">
        <SessionsByWork sessions={data.sessions} change={false} />
      </Section>
    </div>
  );
}
