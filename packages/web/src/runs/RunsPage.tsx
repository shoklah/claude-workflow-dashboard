import { useState, type ReactNode } from 'react';
import {
  PATHS,
  toPath,
  type RunsQuery,
  type RunsResponse,
  type SpendUnits,
  type StepKind,
  type WorkQuery,
} from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { hiddenLabel, pathLabel } from '../lib/format.ts';
import { Line, State } from '../components/Panel.tsx';
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
  query: WorkQuery & {
    warnings?: boolean;
    resolved?: boolean;
    step?: StepKind;
    over?: boolean;
    units?: SpendUnits;
    session?: string;
  },
): string {
  const params = new URLSearchParams();
  if (query.path) params.set('path', query.path);
  if (query.project) params.set('project', query.project);
  params.set('weeks', String(query.weeks));
  if (query.goal) params.set('goal', query.goal);
  if (query.warnings) params.set('warnings', '1');
  if (query.resolved) params.set('resolved', '1');
  if (query.step) params.set('step', query.step);
  if (query.over) params.set('over', '1');
  if (query.units && query.units !== 'all') params.set('units', query.units);
  if (query.session) params.set('session', query.session);
  return `${base}?${params}`;
}

/** The project options of a list page: every stored run's project, from the one query the list pages share. */
export function useProjects(): RunsResponse['projects'] | undefined {
  return useLiveQuery<RunsResponse>(listPath('/api/runs', { weeks: 52 })).data?.projects;
}

/** A list's path, project, goal and period filters, then the page's own controls; `projects` are the project
 * options, `goals` the goal options (no Goal select without them), and `paths` false leaves Path out. */
export function ListFilters({
  query,
  projects,
  goals,
  paths = true,
  onChange,
  children,
}: {
  query: WorkQuery;
  projects: RunsResponse['projects'] | undefined;
  goals?: { key: string; name: string }[];
  paths?: boolean;
  onChange: (change: Partial<WorkQuery>) => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {paths && (
        <label className="flex items-center gap-1.5">
          Path
          <select value={query.path ?? ''} onChange={(e) => onChange({ path: toPath(e.target.value) })}>
            <option value="">All</option>
            {PATHS.map((path) => (
              <option key={path} value={path}>
                {pathLabel(path)}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-1.5">
        Project
        <select
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
      {goals && (
        <label className="flex items-center gap-1.5">
          Goal
          <select value={query.goal ?? ''} onChange={(e) => onChange({ goal: e.target.value || undefined })}>
            <option value="">All</option>
            {goals.map((goal) => (
              <option key={goal.key} value={goal.key}>
                {goal.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex items-center gap-1.5">
        Period
        <select value={query.weeks} onChange={(e) => onChange({ weeks: Number(e.target.value) })}>
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

/** The Work page's Runs view: its `switcher` beside its filters (path, project, goal, period, the last 4 weeks by
 * default, and "has warnings"), then the runs. */
export function RunsPage({ switcher }: { switcher?: ReactNode }) {
  const [query, setQuery] = useState<RunsQuery>({ weeks: 4, warnings: false });
  const runs = useLiveQuery<RunsResponse>(listPath('/api/runs', query));
  const set = (change: Partial<RunsQuery>) => setQuery({ ...query, ...change });
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {switcher}
        <ListFilters query={query} projects={runs.data?.projects} goals={runs.data?.goalOptions ?? []} onChange={set}>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={query.warnings} onChange={(e) => set({ warnings: e.target.checked })} />
            Has warnings
          </label>
        </ListFilters>
      </div>
      {runs.isPending && <State>Loading the runs…</State>}
      {runs.isError && <State error>Couldn't load the runs.</State>}
      {runs.data && <RunsTable runs={runs.data.runs} />}
      {runs.data && runs.data.hidden > 0 && <Line>{hiddenLabel(runs.data.hidden, 'run')}</Line>}
    </div>
  );
}
