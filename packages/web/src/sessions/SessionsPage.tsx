import { useState } from 'react';
import type { SessionsQuery, SessionsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { hiddenLabel, sessionsSummary } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';
import { SessionsTable } from './SessionsTable.tsx';

/** The Sessions list with its filters: path, project, period (the last 4 weeks by default) and "has warnings". */
export function SessionsPage() {
  const [query, setQuery] = useState<SessionsQuery>({ weeks: 4, warnings: false });
  const sessions = useLiveQuery<SessionsResponse>(listPath('/api/sessions', query));
  const projects = useProjects();
  const set = (change: Partial<SessionsQuery>) => setQuery({ ...query, ...change });
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Sessions</h1>
      <ListFilters query={query} projects={projects} onChange={set}>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={query.warnings} onChange={(e) => set({ warnings: e.target.checked })} />
          Has warnings
        </label>
        {sessions.data && <span className="text-muted-foreground">{sessionsSummary(sessions.data.sessions)}</span>}
      </ListFilters>
      <p className="text-sm text-muted-foreground">
        The path filter keeps the sessions holding a run of that path. "Other project" is a session whose working
        directory is no stored run's project. Holds links the runs whose window is in the session's transcript; a
        session's name opens its skill loads and commands in time order, with its runs' windows in place.
      </p>
      {sessions.isPending && <p className="text-sm text-muted-foreground">Loading the sessions…</p>}
      {sessions.isError && <p className="text-sm">Couldn't load the sessions.</p>}
      {sessions.data && <SessionsTable sessions={sessions.data.sessions} />}
      {sessions.data && sessions.data.hidden > 0 && (
        <p className="text-sm text-muted-foreground">{hiddenLabel(sessions.data.hidden, 'session')}</p>
      )}
    </div>
  );
}
