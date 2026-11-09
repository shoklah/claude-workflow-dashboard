import { useState } from 'react';
import type { RunsQuery, RunsResponse } from '@cwd/shared';
import { PATHS, toPath } from '../../../shared/src/report.ts';
import { useLiveQuery } from '../api.ts';
import { RunsTable } from './RunsTable.tsx';

const PERIODS = [
  { weeks: 1, label: 'This week' },
  { weeks: 4, label: 'Last 4 weeks' },
  { weeks: 12, label: 'Last 12 weeks' },
  { weeks: 52, label: 'Last 52 weeks' },
];

/** The API's path for the query: its filters as query params, `weeks` always, the others when set. */
function runsPath(query: RunsQuery): string {
  const params = new URLSearchParams();
  if (query.path) params.set('path', query.path);
  if (query.project) params.set('project', query.project);
  params.set('weeks', String(query.weeks));
  if (query.warnings) params.set('warnings', '1');
  return `/api/runs?${params}`;
}

const SELECT = 'rounded-md border bg-background px-2 py-1';

/** The Runs list with its filters: path, project, period (the last 4 weeks by default) and "has warnings". */
export function RunsPage() {
  const [query, setQuery] = useState<RunsQuery>({ weeks: 4, warnings: false });
  const runs = useLiveQuery<RunsResponse>(runsPath(query));
  const set = (change: Partial<RunsQuery>) => setQuery({ ...query, ...change });
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Runs</h1>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          Path
          <select
            className={SELECT}
            value={query.path ?? ''}
            onChange={(e) => set({ path: toPath(e.target.value) })}
          >
            <option value="">All</option>
            {PATHS.map((path) => (
              <option key={path}>{path}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Project
          <select
            className={SELECT}
            value={query.project ?? ''}
            onChange={(e) => set({ project: e.target.value || undefined })}
          >
            <option value="">All</option>
            {runs.data?.projects.map((project) => (
              <option key={project}>{project}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Period
          <select className={SELECT} value={query.weeks} onChange={(e) => set({ weeks: Number(e.target.value) })}>
            {PERIODS.map((period) => (
              <option key={period.weeks} value={period.weeks}>
                {period.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={query.warnings} onChange={(e) => set({ warnings: e.target.checked })} />
          Has warnings
        </label>
      </div>
      {runs.isPending && <p className="text-sm text-muted-foreground">Loading the runs…</p>}
      {runs.isError && <p className="text-sm">Couldn't load the runs.</p>}
      {runs.data && <RunsTable runs={runs.data.runs} />}
    </div>
  );
}
