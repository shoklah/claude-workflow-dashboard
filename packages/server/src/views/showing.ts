import type { RunEntry, ShowingResponse } from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { projectKey } from '../keys.ts';
import { storedNames } from './runs.ts';
import type { Scope } from './scope.ts';

/** Showing mode's state: while off, every stored run's project, by name; while on, only the picked ones, named by the
 * scope. */
export function showingView(runs: StoredUnit<RunEntry>[], scope: Scope | null): ShowingResponse {
  const projects = scope
    ? [...scope.names].map(([key, name]) => ({ key, name, picked: true }))
    : [...storedNames(runs)]
        .filter(([, name]) => name)
        .map(([root, name]) => ({ key: projectKey(root), name, picked: false }));
  return { on: scope !== null, projects: projects.sort((a, b) => a.name.localeCompare(b.name)) };
}
