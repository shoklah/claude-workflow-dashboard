import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import type { GoalResponse } from '@cwd/shared';
import { ApiError, useLiveQuery } from '../api.ts';
import { Unknown } from '../components/Num.tsx';
import { LINK, PageTitle, Pairs, Section, State } from '../components/Panel.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { formatCost, formatWhole, projectLabel } from '../lib/format.ts';
import { ChangesTable } from './ChangesTable.tsx';
import { SessionGraph } from './SessionGraph.tsx';
import { SessionsByWork } from './SessionsByWork.tsx';

/** The goal's facts, each a term over its value on the backdrop: its one project, else "Several projects". */
function Facts({ goal }: { goal: GoalResponse }) {
  const time = (iso: string | null) => (iso ? <Time iso={iso} /> : <Unknown backdrop />);
  const pairs: [string, ReactNode][] = [
    ['Project', goal.projects.length > 1 ? 'Several projects' : projectLabel(goal.projects[0] ?? null)],
    ['Started', time(goal.startedAt)],
    ['Last activity', time(goal.lastActivity)],
    ['Changes', formatWhole(goal.changeCount)],
    ['Runs', formatWhole(goal.runCount)],
    ['Sessions', formatWhole(goal.sessionCount)],
    ['Findings', goal.findings === null ? <Unknown backdrop /> : formatWhole(goal.findings)],
    ['Est. cost', goal.cost === null ? <Unknown backdrop /> : formatCost(goal.cost)],
  ];
  return <Pairs inline="over" backdrop className="gap-x-10 gap-y-3" pairs={pairs} />;
}

/**
 * A goal's page: a link back to Work, its name and facts, how the work spread across its sessions (a lane per change,
 * then No change, then Other goals), its changes and its sessions. A key Work doesn't list gets its own message.
 */
export function GoalPage({ goalKey }: { goalKey: string }) {
  const goal = useLiveQuery<GoalResponse>(`/api/work/goals/${encodeURIComponent(goalKey)}`);
  if (goal.isPending) return <State>Loading the goal…</State>;
  if (goal.error instanceof ApiError && goal.error.status === 404) {
    return (
      <State error>
        {"This goal isn't in the data any more. "}
        <Link to="/work" className={LINK}>
          Work
        </Link>
      </State>
    );
  }
  if (goal.isError) return <State error>Couldn't load the goal.</State>;
  const { data } = goal;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link to="/work" className={cn('w-fit text-sm', LINK)}>
          Work
        </Link>
        <PageTitle>{data.name}</PageTitle>
        <Facts goal={data} />
      </div>
      <SessionGraph graph={data.graph} label="goal" />
      <Section title="Changes">
        <ChangesTable rows={data.changes} project={data.projects.length > 1} label="Changes table" />
      </Section>
      <Section title="Sessions">
        <SessionsByWork sessions={data.sessions} change />
      </Section>
    </div>
  );
}
