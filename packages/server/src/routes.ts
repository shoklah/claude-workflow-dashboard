import type { Context, Hono } from 'hono';
import type { RunsQuery, StatusResponse } from '@cwd/shared';
import type { AppDeps } from './app.ts';
import { lastGoodImport, lastImport, listUnits, listWarnings, setSeenAt } from './db/read.ts';
import { runView, runsList } from './views/runs.ts';

// The folders of an absolute path: from a `/` that starts a word up to its last `/`. A folder name may hold a space,
// but not a space before a `/`, which starts the next path; quotes, `:` and `;` end the path. Text after a path
// that holds a space and then a `/` reads as more folders and is cut too: more is cut, never less.
const PATH_FOLDERS = /(?<![\w.-])\/(?:(?:[^/'"\n:; ]| (?!\/))*\/)+/g;

/** The text with every absolute path cut to its last segment, so the banner names the command and no path leaves. */
function trimPaths(text: string): string {
  return text.replace(PATH_FOLDERS, '');
}

/** The answer to any method but POST on a POST-only route. */
function postOnly(c: Context): Response {
  return c.body(null, 405, { Allow: 'POST' });
}

/** The API routes, one block per task. The request rules (Host, the POST header and Origin) are app.ts's middleware. */
export function registerRoutes(app: Hono, deps: AppDeps): void {
  // Task 4: the import's status, the refresh and "mark all seen".
  app.get('/api/status', (c) => {
    const last = lastImport(deps.db);
    const status: StatusResponse = {
      lastImportAt: last?.at.toISOString() ?? null,
      lastGoodImportAt: lastGoodImport(deps.db)?.at.toISOString() ?? null,
      error: last?.error ? trimPaths(last.error) : null,
      importing: deps.importing(),
    };
    return c.json(status);
  });
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

  // Task 7: the Runs list and one run.
  app.get('/api/runs', (c) => {
    const weeks = Number(c.req.query('weeks') ?? 4);
    const query: RunsQuery = {
      path: (['small', 'full', 'plan'] as const).find((p) => p === c.req.query('path')),
      project: c.req.query('project') || undefined,
      weeks: Number.isInteger(weeks) && weeks > 0 ? weeks : 4,
      warnings: c.req.query('warnings') === '1',
    };
    return c.json(runsList(listUnits(deps.db, 'run'), listWarnings(deps.db), query, deps.now()));
  });
  app.get('/api/runs/:key', (c) => {
    const run = listUnits(deps.db, 'run').find((unit) => unit.key === c.req.param('key'));
    if (!run) return c.notFound();
    return c.json(runView(run, listWarnings(deps.db)));
  });
}
