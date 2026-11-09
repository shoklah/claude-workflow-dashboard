import type { Context, Hono } from 'hono';
import { toPath, type RunEntry, type RunsQuery } from '@cwd/shared';
import type { AppDeps } from './app.ts';
import { currentLabels, labelInputs } from './db/labels.ts';
import {
  getRun,
  getSeenAt,
  getShowing,
  lastGoodImport,
  lastImport,
  listUnits,
  listWarnings,
  setSeenAt,
  setShowing,
  type StoredUnit,
} from './db/read.ts';
import { projectKey } from './keys.ts';
import { homeView } from './views/home.ts';
import { rootOf, runView, runsList, storedBranches, storedNames } from './views/runs.ts';
import { scopeOf, type Scope } from './views/scope.ts';
import { showingView } from './views/showing.ts';
import { statusView } from './views/status.ts';

/** The answer to any method but POST on a POST-only route. */
function postOnly(c: Context): Response {
  return c.body(null, 405, { Allow: 'POST' });
}

/** The API routes, one block per task. The request rules (Host, the POST header and Origin) are app.ts's middleware. */
export function registerRoutes(app: Hono, deps: AppDeps): void {
  // Showing mode's scope over the stored runs, null while it is off.
  const scopeFor = (runs: StoredUnit<RunEntry>[]): Scope | null =>
    scopeOf(getShowing(deps.db), storedBranches(runs), deps.aliases);

  // Task 4: the import's status, the refresh and "mark all seen".
  app.get('/api/status', (c) =>
    c.json(
      statusView(lastImport(deps.db), lastGoodImport(deps.db), deps.importing(), scopeFor(listUnits(deps.db, 'run'))),
    ),
  );
  app.post('/api/refresh', (c) => {
    deps.requestImport();
    return c.body(null, 202);
  });
  app.all('/api/refresh', postOnly);
  app.post('/api/seen', (c) => {
    setSeenAt(deps.db, deps.now());
    return c.body(null, 204);
  });
  app.all('/api/seen', postOnly);

  // Task 6: the home screen.
  app.get('/api/home', (c) => {
    const runs = listUnits(deps.db, 'run');
    return c.json(
      homeView({
        runs,
        warnings: listWarnings(deps.db),
        seenAt: getSeenAt(deps.db),
        now: deps.now(),
        scope: scopeFor(runs),
      }),
    );
  });

  // Task 7: the Runs list and one run.
  app.get('/api/runs', (c) => {
    const weeks = Number(c.req.query('weeks'));
    const query: RunsQuery = {
      path: toPath(c.req.query('path')),
      project: c.req.query('project') || undefined,
      weeks: Number.isInteger(weeks) && weeks > 0 ? weeks : 4,
      warnings: c.req.query('warnings') === '1',
    };
    const runs = listUnits(deps.db, 'run');
    return c.json(runsList(runs, listWarnings(deps.db), query, deps.now(), scopeFor(runs)));
  });
  app.get('/api/runs/:key', (c) => {
    const run = getRun(deps.db, c.req.param('key'));
    if (!run) return c.notFound();
    const runs = listUnits(deps.db, 'run');
    const labels = currentLabels(deps.db, labelInputs([run]));
    const view = runView(run, listWarnings(deps.db), storedNames(runs), scopeFor(runs), labels);
    // A hidden project's run is a 404, as if it weren't stored.
    return view ? c.json(view) : c.notFound();
  });

  // Slice 2a, task 3: showing mode. An empty list turns it off; a key no stored run's project has is a 400.
  app.get('/api/showing', (c) => {
    const runs = listUnits(deps.db, 'run');
    return c.json(showingView(runs, scopeFor(runs)));
  });
  app.post('/api/showing', async (c) => {
    const body = await c.req.json().catch(() => null);
    const projects: unknown = body?.projects;
    const stored = new Set(listUnits(deps.db, 'run').map((run) => projectKey(rootOf(run))));
    if (!Array.isArray(projects) || !projects.every((key) => typeof key === 'string' && stored.has(key))) {
      return c.body(null, 400);
    }
    setShowing(deps.db, projects.length > 0 ? [...new Set(projects as string[])] : null);
    return c.body(null, 204);
  });
}
