import { useState } from 'react';
import type { SessionsQuery, SessionsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Details, Line, PageTitle, State } from '../components/Panel.tsx';
import { hiddenLabel } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';
import { SessionsTable } from './SessionsTable.tsx';

/** The Sessions list with its filters: path, project, period (the last 4 weeks by default) and "has warnings". */
export function SessionsPage() {
  const [query, setQuery] = useState<SessionsQuery>({ weeks: 4, warnings: false });
  const sessions = useLiveQuery<SessionsResponse>(listPath('/api/sessions', query));
  const projects = useProjects();
  const set = (change: Partial<SessionsQuery>) => setQuery({ ...query, ...change });
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Sessions</PageTitle>
      <ListFilters query={query} projects={projects} onChange={set}>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={query.warnings} onChange={(e) => set({ warnings: e.target.checked })} />
          Has warnings
        </label>
      </ListFilters>
      {sessions.isPending && <State>Loading the sessions…</State>}
      {sessions.isError && (
        <State error>Couldn't load the sessions. Check that the dashboard server is running, then refresh.</State>
      )}
      {sessions.data && <SessionsTable sessions={sessions.data.sessions} />}
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
