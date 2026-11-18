import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Db } from './db/open.ts';
import type { AccountFiles } from './hosted/account-files.ts';
import { SESSION, sessionAccount, tokenAccount, type Account, type AccountsDb } from './hosted/accounts.ts';
import { registerAuth } from './hosted/auth.ts';
import type { GitHubClient } from './hosted/github.ts';
import { registerRoutes } from './routes.ts';

/** Hosted mode's deps: its public host and origin (`https://<publicHost>`), the accounts database, each account's file
 * and the admin's GitHub login. */
export type HostedDeps = {
  publicHost: string;
  origin: string;
  accounts: AccountsDb;
  files: AccountFiles;
  admin: string;
  github: GitHubClient;
};

export type AppDeps = {
  // The one database in local mode; null in hosted mode, where each request gets its caller's.
  db: Db | null;
  port: number;
  // Queues an import; null has no /api/refresh route (hosted mode).
  requestImport: (() => void) | null;
  importing: () => boolean;
  // The built frontend's folder, served with index.html as the fallback for non-/api paths; null serves none.
  webDist: string | null;
  now: () => Date;
  // Showing mode's display names, by project root path (the config's aliases).
  aliases: Record<string, string>;
  // The labeller's model, null while it is off (no key).
  labeller: { model: string } | null;
  // Present only in hosted mode.
  hosted?: HostedDeps;
};

/** Each request's database, caller and the owner it views (hosted mode; null for its own account), set by createApp's
 * middleware. */
export type AppEnv = { Variables: { db: Db; account: Account | null; viewing: Account | null } };

// The POSTs a viewer may send: choosing what it views, and signing out.
const VIEWER_WRITES = ['/api/view', '/auth/signout'];

// Hosted paths open without a caller.
const OPEN = ['/signin', '/favicon.svg'];
const OPEN_PREFIXES = ['/auth/', '/assets/'];

/**
 * The server. One middleware holds the request rules on every route, built files and 404s included, and sets each
 * request's database (`c.var.db`) and caller (`c.var.account`).
 *
 * Local mode: the `Host` must be `localhost:<port>` or `127.0.0.1:<port>` (against DNS rebinding), and any method but
 * GET and HEAD needs `X-Dashboard-Refresh: 1` and, when an `Origin` is sent, the server's own. Another site can send a
 * plain form POST to 127.0.0.1; a custom header forces a preflight, which fails since no response carries an
 * `Access-Control-*` header. The database is the one global one, with no caller.
 *
 * Hosted mode: the `Host` must be the public host; `/api/collect*` resolves only a bearer collector token (401 without
 * one); any other method but GET and HEAD needs `X-Dashboard-Refresh: 1` and the public origin, sent; then the session
 * cookie names the caller, whose own account file is the database. With no caller, the open paths pass, `/api/*` is a
 * 401 and any other path a redirect to `/signin`. A caller viewing an owner's account (`c.var.viewing`) gets the
 * owner's file as the database, and any method but GET and HEAD, except on VIEWER_WRITES, is a 403.
 */
export function createApp(deps: AppDeps): Hono<AppEnv> {
  const { db, hosted } = deps;
  if (!hosted && !db) throw new Error('local mode needs its database');
  const hosts = [`localhost:${deps.port}`, `127.0.0.1:${deps.port}`];
  const origins = hosts.map((host) => `http://${host}`);
  const app = new Hono<AppEnv>();
  app.use(async (c, next) => {
    const writes = c.req.method !== 'GET' && c.req.method !== 'HEAD';
    if (!hosted) {
      if (!hosts.includes(c.req.header('Host') ?? '')) return c.text('Forbidden', 403);
      if (writes) {
        const origin = c.req.header('Origin');
        if (c.req.header('X-Dashboard-Refresh') !== '1' || (origin !== undefined && !origins.includes(origin))) {
          return c.text('Forbidden', 403);
        }
      }
      c.set('db', db as Db);
      c.set('account', null);
      c.set('viewing', null);
      return next();
    }
    if (c.req.header('Host') !== hosted.publicHost) return c.text('Forbidden', 403);
    const path = c.req.path;
    let account: Account | null;
    let viewing: Account | null = null;
    if (path === '/api/collect' || path.startsWith('/api/collect/')) {
      const auth = c.req.header('Authorization');
      const token = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length) : '';
      account = token ? tokenAccount(hosted.accounts, token, deps.now()) : null;
      if (!account) return c.body(null, 401);
    } else {
      if (writes && (c.req.header('X-Dashboard-Refresh') !== '1' || c.req.header('Origin') !== hosted.origin)) {
        return c.text('Forbidden', 403);
      }
      const raw = getCookie(c, SESSION);
      const session = raw ? sessionAccount(hosted.accounts, raw, hosted.admin, deps.now()) : null;
      account = session?.account ?? null;
      viewing = session?.viewing ?? null;
      if (!account && !OPEN.includes(path) && !OPEN_PREFIXES.some((prefix) => path.startsWith(prefix))) {
        return path === '/api' || path.startsWith('/api/') ? c.body(null, 401) : c.redirect('/signin', 302);
      }
      if (viewing && writes && !VIEWER_WRITES.includes(path)) return c.text('Forbidden', 403);
    }
    c.set('account', account);
    c.set('viewing', viewing);
    if (account) c.set('db', hosted.files.db((viewing ?? account).id));
    return next();
  });
  registerRoutes(app, deps);
  if (hosted) registerAuth(app, { ...deps, hosted });
  if (deps.webDist) {
    app.get('/api/*', (c) => c.notFound());
    app.get('*', serveStatic({ root: deps.webDist }), serveStatic({ root: deps.webDist, path: 'index.html' }));
  }
  return app;
}

/** The built frontend (`packages/web/dist`), or null before it is built. */
export function builtWebDist(): string | null {
  const dir = fileURLToPath(new URL('../../web/dist', import.meta.url));
  return existsSync(dir) ? dir : null;
}

/** Serves the app on 127.0.0.1; only hosted mode, inside its container, passes 0.0.0.0. */
export function serveApp(deps: AppDeps, hostname: '127.0.0.1' | '0.0.0.0' = '127.0.0.1'): void {
  serve({ fetch: createApp(deps).fetch, hostname, port: deps.port });
  console.log(`edward on http://localhost:${deps.port}`);
}
