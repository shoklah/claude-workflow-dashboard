import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import type { Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie } from 'hono/cookie';
import {
  toPath,
  toSpendUnits,
  toStepKind,
  weekStart,
  type ComplianceQuery,
  type ContextQuery,
  type FindingsQuery,
  LABELLER_MODELS,
  type RunEntry,
  type SessionEntry,
  type RunsQuery,
  type SessionsQuery,
  type SpendQuery,
  type TokenResponse,
  type WorkQuery,
} from '@cwd/shared';
import type { AppDeps, AppEnv } from './app.ts';
import { activeList, labellable } from './categories.ts';
import { COLLECT_MAX_ERROR } from './collector.ts';
import { recordImportFailure, splitCursor } from './db/import.ts';
import { currentLabels, labelInputs, pendingInputs, tokensSince } from './db/labels.ts';
import {
  clearCursor,
  getCursor,
  getRun,
  getSeenAt,
  getShowing,
  getShownProjects,
  lastGoodImport,
  lastImport,
  listUnits,
  listWarnings,
  setSeenAt,
  setShowing,
  setShownProjects,
  type StoredUnit,
} from './db/read.ts';
import {
  addViewer,
  createToken,
  deleteAccount,
  getAccount,
  getLabeller,
  listTokens,
  listViewers,
  removeViewer,
  revokeToken,
  SESSION,
  SESSION_COOKIE,
  setLabeller,
  setLastCollect,
  setViewing,
  viewableAccounts,
  type Account,
} from './hosted/accounts.ts';
import { projectKey } from './keys.ts';
import { importJson } from './reporter.ts';
import { accountView } from './views/account.ts';
import { complianceView } from './views/compliance.ts';
import { contextView } from './views/context.ts';
import { findingsView } from './views/findings.ts';
import { homeView } from './views/home.ts';
import { modelsView } from './views/models.ts';
import { runPageView } from './views/run.ts';
import { rootOf, runsList, storedBranches, storedNames, storedSessionRoots } from './views/runs.ts';
import { scopeOf, type Scope } from './views/scope.ts';
import { sessionsView } from './views/sessions.ts';
import { showingView } from './views/showing.ts';
import { skillsView } from './views/skills.ts';
import { spendView } from './views/spend.ts';
import { statusView } from './views/status.ts';
import { stepsView } from './views/steps.ts';
import { weeksView } from './views/weeks.ts';
import { changeView, goalHomes, goalView, levels, workView } from './views/work.ts';

/** The answer to any method but POST on a POST-only route. */
export function postOnly(c: Context): Response {
  return c.body(null, 405, { Allow: 'POST' });
}

// The collect endpoint's limits: the gzipped body, and the export it unzips to.
const COLLECT_MAX_BODY = 32 * 1024 * 1024;
const COLLECT_MAX_JSON = 64 * 1024 * 1024;
const unzip = promisify(gunzip);

// A GitHub login's syntax.
const GITHUB_LOGIN = /^[A-Za-z0-9-]{1,39}$/;

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

/** The API routes, one block per task. The request rules (Host, the POST header and Origin, the caller) are app.ts's
 * middleware, which sets each request's database as `c.var.db`. */
export function registerRoutes(app: Hono<AppEnv>, deps: AppDeps): void {
  // Showing mode's scope over the request's stored runs and sessions (each listed here when the caller has none), null
  // while it is off; a viewer's always, from the viewed account's kept list.
  const scopeFor = (
    c: Context<AppEnv>,
    runs?: StoredUnit<RunEntry>[],
    sessions?: StoredUnit<SessionEntry>[],
  ): Scope | null => {
    const showing = c.var.viewing ? getShownProjects(c.var.db) : getShowing(c.var.db);
    if (!showing) return null;
    const allRuns = runs ?? listUnits(c.var.db, 'run');
    const allSessions = sessions ?? listUnits(c.var.db, 'session');
    return scopeOf(
      showing,
      storedBranches(allRuns),
      deps.aliases,
      storedSessionRoots(allSessions),
      goalHomes(levels(allRuns, allSessions)),
    );
  };

  // Task 4: the import's status, the refresh and "mark all seen"; hosted, the caller's login and the accounts it views.
  app.get('/api/status', (c) => {
    const { account, viewing } = c.var;
    return c.json(
      statusView(
        lastImport(c.var.db),
        lastGoodImport(c.var.db),
        deps.importing(),
        scopeFor(c),
        account && deps.hosted
          ? {
              login: account.login,
              viewing: viewing?.login ?? null,
              viewable: viewableAccounts(deps.hosted.accounts, account, deps.hosted.admin).map((owner) => owner.login),
            }
          : null,
      ),
    );
  });
  const { requestImport } = deps;
  if (requestImport) {
    app.post('/api/refresh', (c) => {
      requestImport();
      return c.body(null, 202);
    });
    app.all('/api/refresh', postOnly);
  }
  app.post('/api/seen', (c) => {
    setSeenAt(c.var.db, deps.now());
    return c.body(null, 204);
  });
  app.all('/api/seen', postOnly);

  // Task 6: the home screen.
  app.get('/api/home', (c) => {
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(
      homeView({
        runs,
        sessions,
        warnings: listWarnings(c.var.db),
        seenAt: getSeenAt(c.var.db),
        now: deps.now(),
        scope: scopeFor(c, runs, sessions),
      }),
    );
  });

  // Task 7: the Runs list and one run.
  app.get('/api/runs', (c) => {
    const query: RunsQuery = {
      ...periodQuery(c),
      warnings: c.req.query('warnings') === '1',
      goal: c.req.query('goal') || undefined,
    };
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(runsList(runs, sessions, listWarnings(c.var.db), query, deps.now(), scopeFor(c, runs, sessions)));
  });
  app.get('/api/runs/:key', (c) => {
    const run = getRun(c.var.db, c.req.param('key'));
    if (!run) return c.notFound();
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    const list = activeList(c.var.db);
    const labels = list ? currentLabels(c.var.db, labelInputs([run]), list.number) : new Map();
    const view = runPageView({
      run,
      runs,
      sessions,
      warnings: listWarnings(c.var.db),
      names: storedNames(runs),
      scope: scopeFor(c, runs, sessions),
      labels,
      list,
    });
    // A hidden project's run is a 404, as if it weren't stored.
    return view ? c.json(view) : c.notFound();
  });

  // Slice 2a, task 3: showing mode. An empty list turns it off; a key no stored run's project has is a 400. Slice 2b,
  // task 1: its kept list, which turning it off keeps, set alone by /api/showing/projects.
  const showingBody = async (c: Context<AppEnv>): Promise<string[] | null> => {
    const body = await c.req.json().catch(() => null);
    const projects: unknown = body?.projects;
    const stored = new Set(listUnits(c.var.db, 'run').map((run) => projectKey(rootOf(run))));
    if (!Array.isArray(projects) || !projects.every((key) => typeof key === 'string' && stored.has(key))) return null;
    return [...new Set(projects as string[])];
  };
  app.get('/api/showing', (c) => {
    const runs = listUnits(c.var.db, 'run');
    return c.json(showingView(runs, scopeFor(c, runs), getShownProjects(c.var.db)));
  });
  app.post('/api/showing', async (c) => {
    const projects = await showingBody(c);
    if (!projects) return c.body(null, 400);
    setShowing(c.var.db, projects.length > 0 ? projects : null);
    return c.body(null, 204);
  });
  app.post('/api/showing/projects', async (c) => {
    const projects = await showingBody(c);
    if (!projects) return c.body(null, 400);
    setShownProjects(c.var.db, projects);
    if (projects.length === 0) setShowing(c.var.db, null);
    return c.body(null, 204);
  });
  app.all('/api/showing/projects', postOnly);

  // Slice 2a, task 7: the Findings page, with the labeller's state; slice 2b, task 8: under the active list, with no
  // label and none waiting while there is none. Hosted, the labeller is the viewed or calling account's, on while its key
  // is set.
  app.get('/api/findings', (c) => {
    const runs = listUnits(c.var.db, 'run');
    const inputs = labelInputs(runs);
    const list = activeList(c.var.db);
    const labels = list ? currentLabels(c.var.db, inputs, list.number) : new Map();
    const now = deps.now();
    const own = deps.hosted && getLabeller(deps.hosted.accounts, (c.var.viewing ?? (c.var.account as Account)).id);
    const active = own ? (own.keySet ? { model: own.model } : null) : deps.labeller;
    const model = active?.model;
    const labeller = {
      on: active !== null,
      labelled: labels.size,
      waiting: model && list ? pendingInputs(c.var.db, labellable(inputs, list), model, list.number).length : 0,
      tokensThisWeek: tokensSince(c.var.db, weekStart(now)),
    };
    return c.json(findingsView({ runs, labels, list, query: periodQuery(c), now, scope: scopeFor(c, runs), labeller }));
  });

  // Slice 2b, task 2: the Weeks page.
  app.get('/api/weeks', (c) =>
    c.json(weeksView({ runs: listUnits(c.var.db, 'run'), query: periodQuery(c), now: deps.now() })),
  );

  // Slice 2b, task 3: the Steps and rules page, its refusals, startup and advisor over runs and sessions (2c, task 4).
  app.get('/api/steps', (c) => {
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(
      stepsView({
        runs,
        sessions,
        query: periodQuery(c),
        now: deps.now(),
        scope: scopeFor(c, runs, sessions),
      }),
    );
  });

  // Slice 2b, task 4: the Skills page, its missing counts over runs and sessions (2c, task 4).
  app.get('/api/skills', (c) => {
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(
      skillsView({
        runs,
        sessions,
        query: periodQuery(c),
        now: deps.now(),
        scope: scopeFor(c, runs, sessions),
      }),
    );
  });

  // Slice 2b, task 5: the Models and advisor page, with the reporter's all-time figures from the last good import, and
  // the advisor's facts over runs and sessions (2c, task 4).
  app.get('/api/models', (c) => {
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(
      modelsView({
        runs,
        sessions,
        totals: lastGoodImport(c.var.db)?.totals,
        query: periodQuery(c),
        now: deps.now(),
        scope: scopeFor(c, runs, sessions),
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
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(
      complianceView({
        runs,
        sessions,
        warnings: listWarnings(c.var.db),
        query,
        now: deps.now(),
        seenAt: getSeenAt(c.var.db),
        scope: scopeFor(c, runs, sessions),
        totals: lastGoodImport(c.var.db)?.totals,
      }),
    );
  });

  // Slice 2c, task 6: the Sessions page, each session's facts, held runs and timeline.
  app.get('/api/sessions', (c) => {
    const query: SessionsQuery = {
      ...periodQuery(c),
      warnings: c.req.query('warnings') === '1',
      goal: c.req.query('goal') || undefined,
      session: c.req.query('session') || undefined,
    };
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(
      sessionsView({
        runs,
        sessions,
        warnings: listWarnings(c.var.db),
        query,
        now: deps.now(),
        scope: scopeFor(c, runs, sessions),
      }),
    );
  });

  // Context cap, task 5: the period's weekly context, its uncounted units and the units behind it.
  app.get('/api/context', (c) => {
    const query: ContextQuery = { ...periodQuery(c), over: c.req.query('over') === '1' };
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(contextView({ runs, sessions, query, now: deps.now(), scope: scopeFor(c, runs, sessions) }));
  });

  // Spend page, task 2: the period's spend by phase, by group and by week.
  app.get('/api/spend', (c) => {
    const query: SpendQuery = { ...periodQuery(c), units: toSpendUnits(c.req.query('units')) };
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(spendView({ runs, sessions, query, now: deps.now(), scope: scopeFor(c, runs, sessions) }));
  });

  // Work page, task 3: the Changes view, the period's changes by goal.
  app.get('/api/work', (c) => {
    const query: WorkQuery = { ...periodQuery(c), goal: c.req.query('goal') || undefined };
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    return c.json(
      workView({
        runs,
        sessions,
        query,
        now: deps.now(),
        scope: scopeFor(c, runs, sessions),
        names: storedNames(runs),
      }),
    );
  });

  // Work page, task 4: a change's and a goal's facts with their session graph; a change or goal Work doesn't list is a
  // 404, as an unknown key.
  app.get('/api/work/changes/:key', (c) => {
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    const scope = scopeFor(c, runs, sessions);
    const view = changeView({ runs, sessions, key: c.req.param('key'), scope, names: storedNames(runs) });
    return view ? c.json(view) : c.notFound();
  });
  app.get('/api/work/goals/:key', (c) => {
    const runs = listUnits(c.var.db, 'run');
    const sessions = listUnits(c.var.db, 'session');
    const scope = scopeFor(c, runs, sessions);
    const view = goalView({ runs, sessions, key: c.req.param('key'), scope, names: storedNames(runs) });
    return view ? c.json(view) : c.notFound();
  });

  // Hosted, task 5: the collector's cursor, export and failure, into the token's own account file. An export whose
  // reporter ran with another cursor than the stored one (`X-Collector-Cursor`), or, while a cursor is stored, with
  // another state id or none, is refused before anything is stored: one machine feeds an account.
  const { hosted } = deps;
  if (hosted) {
    // The middleware sets the caller on every hosted /api/collect* (a token), /api/account* and /api/view (a session)
    // request.
    const caller = (c: Context<AppEnv>) => c.var.account as Account;
    const collected = (c: Context<AppEnv>) => setLastCollect(hosted.accounts, caller(c).id, deps.now());
    app.get('/api/collect/cursor', (c) => c.json({ cursor: getCursor(c.var.db) }));
    app.post(
      '/api/collect',
      bodyLimit({ maxSize: COLLECT_MAX_BODY, onError: (c) => c.body(null, 413) }),
      async (c) => {
        const at = deps.now();
        let json: unknown;
        try {
          const body = await unzip(Buffer.from(await c.req.arrayBuffer()), { maxOutputLength: COLLECT_MAX_JSON });
          json = JSON.parse(body.toString('utf8'));
        } catch (error) {
          if (error instanceof RangeError) return c.body(null, 413);
          recordImportFailure(c.var.db, 'collect failed: body is not gzipped JSON', at);
          return c.body(null, 400);
        }
        // The cursor the collector's reporter ran with, none when the header is absent; it must still be the stored one.
        const sent = c.req.header('X-Collector-Cursor') ?? null;
        const stored = getCursor(c.var.db);
        const cursor = (json as { cursor?: unknown } | null)?.cursor;
        const id = typeof cursor === 'string' ? splitCursor(cursor)?.id : undefined;
        if (sent !== stored || (stored !== null && (id === undefined || id !== splitCursor(stored)?.id))) {
          return c.json({ error: 'another machine feeds this account' }, 409);
        }
        if (!importJson(c.var.db, json, sent, at)) return c.body(null, 400);
        collected(c);
        hosted.requestLabels();
        return c.body(null, 204);
      },
    );
    app.all('/api/collect', postOnly);
    app.post('/api/collect/failure', async (c) => {
      const body = await c.req.json().catch(() => null);
      const error: unknown = body?.error;
      if (typeof error !== 'string' || error.length > COLLECT_MAX_ERROR) return c.body(null, 400);
      recordImportFailure(c.var.db, error, deps.now());
      collected(c);
      return c.body(null, 204);
    });
    app.all('/api/collect/failure', postOnly);

    // Hosted, task 9: the caller's account, its collector tokens and the collector reset. A session caller only (a
    // token resolves only on /api/collect*); each reads the caller's own file, never `c.var.db`.
    app.get('/api/account', (c) => {
      const { id } = caller(c);
      const account = getAccount(hosted.accounts, id);
      if (!account) return c.notFound();
      return c.json(
        accountView(
          account,
          listTokens(hosted.accounts, id),
          getCursor(hosted.files.db(id)) !== null,
          listViewers(hosted.accounts, id),
          getLabeller(hosted.accounts, id),
        ),
      );
    });
    app.post('/api/account/tokens', (c) => {
      const body: TokenResponse = { token: createToken(hosted.accounts, caller(c).id, deps.now()) };
      return c.json(body, 201);
    });
    app.all('/api/account/tokens', postOnly);
    app.post('/api/account/tokens/:id/revoke', (c) => {
      const id = Number(c.req.param('id'));
      if (!Number.isSafeInteger(id) || !revokeToken(hosted.accounts, caller(c).id, id)) return c.notFound();
      return c.body(null, 204);
    });
    app.all('/api/account/tokens/:id/revoke', postOnly);
    app.post('/api/account/reset-collector', (c) => {
      clearCursor(hosted.files.db(caller(c).id));
      return c.body(null, 204);
    });
    app.all('/api/account/reset-collector', postOnly);

    // Slice 2b, task 4: the caller deletes its own account (refused while viewing, by the middleware), then is signed
    // out as /auth/signout does.
    app.post('/api/account/delete', (c) => {
      deleteAccount(hosted.accounts, hosted.files, caller(c).id);
      deleteCookie(c, SESSION, SESSION_COOKIE);
      return c.body(null, 204);
    });
    app.all('/api/account/delete', postOnly);

    // Slice 2b, task 3: the caller's labeller, its Anthropic key stored only sealed (setLabeller); an absent key keeps
    // the stored one, null removes it.
    app.post('/api/account/labeller', async (c) => {
      const body = await c.req.json().catch(() => null);
      const { key, model, dailyMax } = body ?? {};
      const keyOk = key === undefined || key === null || (typeof key === 'string' && key.length > 0);
      const maxOk = Number.isInteger(dailyMax) && dailyMax >= 1 && dailyMax <= 10000;
      if (!keyOk || !LABELLER_MODELS.includes(model) || !maxOk) return c.body(null, 400);
      setLabeller(hosted.accounts, caller(c).id, { key, model, dailyMax }, hosted.secret);
      return c.body(null, 204);
    });
    app.all('/api/account/labeller', postOnly);

    // Slice 2b, task 2: viewers. An owner grants GitHub logins a read-only view of its account; a caller picks an
    // account it may view (viewableAccounts) by login, or null for its own, for its session.
    app.post('/api/account/viewers', async (c) => {
      const body = await c.req.json().catch(() => null);
      const login: unknown = body?.login;
      if (typeof login !== 'string' || !GITHUB_LOGIN.test(login)) return c.body(null, 400);
      addViewer(hosted.accounts, caller(c).id, login);
      return c.body(null, 204);
    });
    app.all('/api/account/viewers', postOnly);
    app.post('/api/account/viewers/:login/remove', (c) => {
      removeViewer(hosted.accounts, caller(c).id, c.req.param('login'));
      return c.body(null, 204);
    });
    app.all('/api/account/viewers/:login/remove', postOnly);
    app.post('/api/view', async (c) => {
      const body = await c.req.json().catch(() => null);
      const login: unknown = body?.login;
      if (login !== null && typeof login !== 'string') return c.body(null, 400);
      const owner =
        login === null
          ? null
          : viewableAccounts(hosted.accounts, caller(c), hosted.admin).find(
              (account) => account.login.toLowerCase() === login.toLowerCase(),
            );
      if (owner === undefined || !setViewing(hosted.accounts, getCookie(c, SESSION) as string, owner?.id ?? null)) {
        return c.notFound();
      }
      return c.body(null, 204);
    });
    app.all('/api/view', postOnly);
  }
}
