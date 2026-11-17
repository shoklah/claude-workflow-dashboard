import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import type { GoalSection, WorkQuery, WorkResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { GoalLink } from '../components/GoalLink.tsx';
import { Unknown } from '../components/Num.tsx';
import { Option, Options } from '../components/Option.tsx';
import { LINK, Line, PageTitle, Pairs, Section, State } from '../components/Panel.tsx';
import { RowToggle } from '../components/RowToggle.tsx';
import { Button } from '../components/ui/button.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { formatCost, formatWhole, hiddenLabel, looseSessionsLabel } from '../lib/format.ts';
import { ListFilters, RunsPage, listPath, useProjects } from '../runs/RunsPage.tsx';
import { SessionsPage } from '../sessions/SessionsPage.tsx';
import { ChangesTable } from './ChangesTable.tsx';

/** The Work page's views, as the URL's `view` names them (none for Changes). */
export type WorkView = 'runs' | 'sessions';

const VIEWS: { view: WorkView | undefined; label: string }[] = [
  { view: undefined, label: 'Changes' },
  { view: 'runs', label: 'Runs' },
  { view: 'sessions', label: 'Sessions' },
];

/** A section title row's totals' columns from `sm`, shared by every section so the totals line up down the page. */
const TOTAL_WIDTHS = ['sm:w-26', 'sm:w-20', 'sm:w-26', 'sm:w-34', 'sm:w-52'];

/** A goal's section: its title row (the chevron, the goal's name linking to its page, "No goal" as plain text, and its
 * totals in the shared columns), then, while open, its changes. */
function GoalRows({ goal }: { goal: GoalSection }) {
  const [open, setOpen] = useState(goal.open);
  const name = goal.name ?? 'No goal';
  const title = (
    <span className="flex min-w-0 sm:w-64">
      <RowToggle
        open={open}
        onToggle={() => setOpen(!open)}
        link={
          goal.key ? (
            <GoalLink goalKey={goal.key} name={name} />
          ) : (
            name
          )
        }
      />
    </span>
  );
  return (
    <Section
      title={title}
      aside={
        <Pairs
          inline="columns"
          widths={TOTAL_WIDTHS}
          pairs={[
            ['Changes', formatWhole(goal.changes)],
            ['Runs', formatWhole(goal.runs)],
            ['Sessions', formatWhole(goal.sessions)],
            ['Est. cost', goal.cost === null ? <Unknown backdrop /> : formatCost(goal.cost)],
            ['Last activity', goal.lastActivity ? <Time iso={goal.lastActivity} /> : <Unknown backdrop />],
          ]}
        />
      }
    >
      {open && <ChangesTable rows={goal.rows} project label={`${name} table`} />}
    </Section>
  );
}

/** The Changes view: its project, goal and period filters (the last 4 weeks by default), then a section per goal. */
function ChangesView({ switcher }: { switcher: ReactNode }) {
  const [query, setQuery] = useState<WorkQuery>({ weeks: 4 });
  const work = useLiveQuery<WorkResponse>(listPath('/api/work', query));
  const projects = useProjects();
  const filtered = Boolean(query.project || query.goal);
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {switcher}
        <ListFilters
          query={query}
          projects={projects}
          goals={work.data?.goalOptions ?? []}
          paths={false}
          onChange={(change) => setQuery({ ...query, ...change })}
        />
      </div>
      {work.isPending && <State>Loading the changes…</State>}
      {work.isError && <State error>Couldn't load the changes.</State>}
      {work.data && work.data.goals.length > 0 && !work.data.anyGoal && (
        <Line>Runs recorded before goals existed show under No goal.</Line>
      )}
      {work.data && work.data.goals.length === 0 && filtered && (
        <State className="flex flex-wrap items-center gap-3">
          Nothing matches these filters.
          <Button size="sm" variant="outline" onClick={() => setQuery({ weeks: query.weeks })}>
            Clear the filters
          </Button>
        </State>
      )}
      {work.data && work.data.goals.length === 0 && !filtered && (
        <State>No work in this period. A change shows here once one of its sessions or runs is imported.</State>
      )}
      {work.data?.goals.map((goal) => <GoalRows key={goal.key ?? ''} goal={goal} />)}
      {work.data && work.data.looseSessions > 0 && (
        <Line>
          {looseSessionsLabel(work.data.looseSessions)}{' '}
          <Link to="/work" search={{ view: 'sessions' }} className={LINK}>
            See them under Sessions
          </Link>
        </Line>
      )}
      {work.data && work.data.hidden > 0 && <Line>{hiddenLabel(work.data.hidden, 'change')}</Line>}
    </>
  );
}

/** The Work page: its view switch (Changes, Runs, Sessions, from the URL's `view`), then that view; `session` (the URL's
 * session key) lists that one session in the Sessions view. */
export function WorkPage({ view, session }: { view?: WorkView; session?: string }) {
  const navigate = useNavigate();
  const switcher = (
    <Options label="View" shown>
      {VIEWS.map((option) => (
        <Option
          key={option.label}
          pressed={view === option.view}
          onClick={() => navigate({ to: '/work', search: option.view ? { view: option.view } : {} })}
        >
          {option.label}
        </Option>
      ))}
    </Options>
  );
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Work</PageTitle>
      {view === undefined && <ChangesView switcher={switcher} />}
      {view === 'runs' && <RunsPage switcher={switcher} />}
      {view === 'sessions' && <SessionsPage switcher={switcher} session={session} />}
    </div>
  );
}
