import type { Context, Hono } from 'hono';
import {
  toPath,
  toStepKind,
  weekStart,
  type ComplianceQuery,
  type FindingsQuery,
  type RunEntry,
  type RunsQuery,
} from '@cwd/shared';
import type { AppDeps } from './app.ts';
import { activeList, labellable } from './categories.ts';
import { currentLabels, labelInputs, pendingInputs, tokensSince } from './db/labels.ts';
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
import { complianceView } from './views/compliance.ts';
import { findingsView } from './views/findings.ts';
import { homeView } from './views/home.ts';
import { modelsView } from './views/models.ts';
import { rootOf, runView, runsList, storedBranches, storedNames } from './views/runs.ts';
import { scopeOf, type Scope } from './views/scope.ts';
import { showingView } from './views/showing.ts';
import { skillsView } from './views/skills.ts';
import { statusView } from './views/status.ts';
import { stepsView } from './views/steps.ts';
import { weeksView } from './views/weeks.ts';

/** The answer to any method but POST on a POST-only route. */
function postOnly(c: Context): Response {
  return c.body(null, 405, { Allow: 'POST' });
}

// The most weeks a list covers: the Runs page's longest period, so a huge `weeks` can't build a huge response.
const MAX_WEEKS = 52;

/** A list's `path`, `project` (a project's key) and `weeks` (a whole number from 1 to MAX_WEEKS, default 4) query
 * params. */
function periodQuery(c: Context): FindingsQuery {
  const weeks = Number(c.req.query('weeks'));
  return {
    path: toPath(c.req.query('path')),
    project: c.req.query('project') || undefined,
    weeks: Number.isInteger(weeks) && weeks > 0 ? Math.min(weeks, MAX_WEEKS) : 4,
  };
}

/** The API routes, one block per task. The request rules (Host, the POST header and Origin) are app.ts's middleware. */
export function registerRoutes(app: Hono, deps: AppDeps): void {
  // Showing mode's scope over the stored runs (listed here when the caller has none), null while it is off.
  const scopeFor = (runs?: StoredUnit<RunEntry>[]): Scope | null => {
    const showing = getShowing(deps.db);
    return showing && scopeOf(showing, storedBranches(runs ?? listUnits(deps.db, 'run')), deps.aliases);
  };

  // Task 4: the import's status, the refresh and "mark all seen".
  app.get('/api/status', (c) =>
    c.json(
      statusView(lastImport(deps.db), lastGoodImport(deps.db), deps.importing(), scopeFor()),
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
        sessions: listUnits(deps.db, 'session'),
        warnings: listWarnings(deps.db),
        seenAt: getSeenAt(deps.db),
        now: deps.now(),
        scope: scopeFor(runs),
      }),
    );
  });

  // Task 7: the Runs list and one run.
  app.get('/api/runs', (c) => {
    const query: RunsQuery = { ...periodQuery(c), warnings: c.req.query('warnings') === '1' };
    const runs = listUnits(deps.db, 'run');
    return c.json(runsList(runs, listWarnings(deps.db), query, deps.now(), scopeFor(runs)));
  });
  app.get('/api/runs/:key', (c) => {
    const run = getRun(deps.db, c.req.param('key'));
    if (!run) return c.notFound();
    const runs = listUnits(deps.db, 'run');
    const list = activeList(deps.db);
    const labels = list ? currentLabels(deps.db, labelInputs([run]), list.number) : new Map();
    const view = runView(run, listWarnings(deps.db), storedNames(runs), scopeFor(runs), labels, list);
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

  // Slice 2a, task 7: the Findings page, with the labeller's state; slice 2b, task 8: under the active list, with no
  // label and none waiting while there is none.
  app.get('/api/findings', (c) => {
    const runs = listUnits(deps.db, 'run');
    const inputs = labelInputs(runs);
    const list = activeList(deps.db);
    const labels = list ? currentLabels(deps.db, inputs, list.number) : new Map();
    const now = deps.now();
    const model = deps.labeller?.model;
    const labeller = {
      on: deps.labeller !== null,
      labelled: labels.size,
      waiting: model && list ? pendingInputs(deps.db, labellable(inputs, list), model, list.number).length : 0,
      tokensThisWeek: tokensSince(deps.db, weekStart(now)),
    };
    return c.json(findingsView({ runs, labels, list, query: periodQuery(c), now, scope: scopeFor(runs), labeller }));
  });

  // Slice 2b, task 2: the Weeks page.
  app.get('/api/weeks', (c) =>
    c.json(weeksView({ runs: listUnits(deps.db, 'run'), query: periodQuery(c), now: deps.now() })),
  );

  // Slice 2b, task 3: the Steps and rules page, with the reporter's all-time figures from the last good import.
  app.get('/api/steps', (c) => {
    const runs = listUnits(deps.db, 'run');
    return c.json(
      stepsView({
        runs,
        totals: lastGoodImport(deps.db)?.totals,
        query: periodQuery(c),
        now: deps.now(),
        scope: scopeFor(runs),
      }),
    );
  });

  // Slice 2b, task 4: the Skills page, with the reporter's all-time missing counts from the last good import's totals.
  app.get('/api/skills', (c) => {
    const runs = listUnits(deps.db, 'run');
    return c.json(
      skillsView({
        runs,
        sessions: listUnits(deps.db, 'session'),
        totals: lastGoodImport(deps.db)?.totals,
        query: periodQuery(c),
        now: deps.now(),
        scope: scopeFor(runs),
      }),
    );
  });

  // Slice 2b, task 5: the Models and advisor page, with the reporter's all-time figures from the last good import.
  app.get('/api/models', (c) => {
    const runs = listUnits(deps.db, 'run');
    return c.json(
      modelsView({
        runs,
        totals: lastGoodImport(deps.db)?.totals,
        query: periodQuery(c),
        now: deps.now(),
        scope: scopeFor(runs),
      }),
    );
  });

  // Slice 2b, task 6: the Compliance page, its warnings by kind and week.
  app.get('/api/compliance', (c) => {
    const query: ComplianceQuery = {
      ...periodQuery(c),
      resolved: c.req.query('resolved') === '1',
      step: toStepKind(c.req.query('step')),
    };
    const runs = listUnits(deps.db, 'run');
    return c.json(
      complianceView({
        runs,
        sessions: listUnits(deps.db, 'session'),
        warnings: listWarnings(deps.db),
        query,
        now: deps.now(),
        seenAt: getSeenAt(deps.db),
        scope: scopeFor(runs),
      }),
    );
  });
}
