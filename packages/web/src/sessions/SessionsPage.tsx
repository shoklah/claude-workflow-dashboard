import { useState, type ReactNode } from 'react';
import type { SessionsQuery, SessionsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { FilterChip } from '../components/FilterChip.tsx';
import { Details, Line, State } from '../components/Panel.tsx';
import { hiddenLabel, sessionName } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';
import { SessionsTable } from './SessionsTable.tsx';

/** The Work page's Sessions view: its `switcher` beside its filters (path, project, goal, period, the last 4 weeks by
 * default, and "has warnings"), then the sessions; with `session` (a session's key, from a link), that session alone,
 * open, under a chip that clears it. */
export function SessionsPage({ switcher, session }: { switcher?: ReactNode; session?: string }) {
  const [query, setQuery] = useState<SessionsQuery>({ weeks: 4, warnings: false });
  const sessions = useLiveQuery<SessionsResponse>(listPath('/api/sessions', { ...query, session }));
  const projects = useProjects();
  const set = (change: Partial<SessionsQuery>) => setQuery({ ...query, ...change });
  const one = session && sessions.data ? (sessions.data.sessions[0] ?? null) : undefined;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {switcher}
        <ListFilters query={query} projects={projects} goals={sessions.data?.goalOptions ?? []} onChange={set}>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={query.warnings} onChange={(e) => set({ warnings: e.target.checked })} />
            Has warnings
          </label>
          {one !== undefined && (
            <FilterChip to="/work" search={{ view: 'sessions' }} label="Clear the session filter">
              Session: {one ? sessionName(one.title) : 'not found'}
            </FilterChip>
          )}
        </ListFilters>
      </div>
      {sessions.isPending && <State>Loading the sessions…</State>}
      {sessions.isError && (
        <State error>Couldn't load the sessions. Check that the dashboard server is running, then refresh.</State>
      )}
      {one === null && <State>This session isn't listed: it isn't in the data any more, or showing mode hides it.</State>}
      {sessions.data && one !== null && <SessionsTable sessions={sessions.data.sessions} open={Boolean(session)} />}
      {sessions.data && sessions.data.hidden > 0 && <Line>{hiddenLabel(sessions.data.hidden, 'session')}</Line>}
      <Details summary="How sessions are listed">
        <p className="max-w-prose">
          The path filter keeps the sessions holding a run of that path. "Other project" is a session whose working
          directory is no stored run's project. A session holds the runs whose window is in its transcript; its name
          opens its skill loads, commands and runs in time order.
        </p>
      </Details>
    </div>
  );
}
