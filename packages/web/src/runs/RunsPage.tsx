import { useState, type ReactNode } from 'react';
import { PATHS, toPath, type FindingsQuery, type RunsQuery, type RunsResponse, type SpendUnits, type StepKind } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { hiddenLabel } from '../lib/format.ts';
import { RunsTable } from './RunsTable.tsx';

const PERIODS = [
  { weeks: 1, label: 'This week' },
  { weeks: 4, label: 'Last 4 weeks' },
  { weeks: 12, label: 'Last 12 weeks' },
  { weeks: 52, label: 'Last 52 weeks' },
];

/** A list's API path for the query: its filters as query params, `weeks` always, the others when set (`units` when
 * not 'all'). */
export function listPath(
  base: string,
  query: FindingsQuery & { warnings?: boolean; resolved?: boolean; step?: StepKind; over?: boolean; units?: SpendUnits },
): string {
  const params = new URLSearchParams();
  if (query.path) params.set('path', query.path);
  if (query.project) params.set('project', query.project);
  params.set('weeks', String(query.weeks));
  if (query.warnings) params.set('warnings', '1');
  if (query.resolved) params.set('resolved', '1');
  if (query.step) params.set('step', query.step);
  if (query.over) params.set('over', '1');
  if (query.units && query.units !== 'all') params.set('units', query.units);
  return `${base}?${params}`;
}

/** The project options of a list page: every stored run's project, from the one query the list pages share. */
export function useProjects(): RunsResponse['projects'] | undefined {
  return useLiveQuery<RunsResponse>(listPath('/api/runs', { weeks: 52 })).data?.projects;
}

const SELECT = 'rounded-md border bg-background px-2 py-1';

/** A list's path, project and period filters, then the page's own controls; `projects` are the project options. */
export function ListFilters({
  query,
  projects,
  onChange,
  children,
}: {
  query: FindingsQuery;
  projects: RunsResponse['projects'] | undefined;
  onChange: (change: Partial<FindingsQuery>) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <label className="flex items-center gap-1.5">
        Path
        <select
          className={SELECT}
          value={query.path ?? ''}
          onChange={(e) => onChange({ path: toPath(e.target.value) })}
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
          onChange={(e) => onChange({ project: e.target.value || undefined })}
        >
          <option value="">All</option>
          {projects?.map((project) => (
            <option key={project.key} value={project.key}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5">
        Period
        <select className={SELECT} value={query.weeks} onChange={(e) => onChange({ weeks: Number(e.target.value) })}>
          {PERIODS.map((period) => (
            <option key={period.weeks} value={period.weeks}>
              {period.label}
            </option>
          ))}
        </select>
      </label>
      {children}
    </div>
  );
}

/** The Runs list with its filters: path, project, period (the last 4 weeks by default) and "has warnings". */
export function RunsPage() {
  const [query, setQuery] = useState<RunsQuery>({ weeks: 4, warnings: false });
  const runs = useLiveQuery<RunsResponse>(listPath('/api/runs', query));
  const set = (change: Partial<RunsQuery>) => setQuery({ ...query, ...change });
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Runs</h1>
      <ListFilters query={query} projects={runs.data?.projects} onChange={set}>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={query.warnings} onChange={(e) => set({ warnings: e.target.checked })} />
          Has warnings
        </label>
      </ListFilters>
      {runs.isPending && <p className="text-sm text-muted-foreground">Loading the runs…</p>}
      {runs.isError && <p className="text-sm">Couldn't load the runs.</p>}
      {runs.data && <RunsTable runs={runs.data.runs} />}
      {runs.data && runs.data.hidden > 0 && (
        <p className="text-sm text-muted-foreground">{hiddenLabel(runs.data.hidden, 'run')}</p>
      )}
    </div>
  );
}
