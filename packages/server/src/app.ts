import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Db } from './db/open.ts';
import { registerRoutes } from './routes.ts';

export type AppDeps = {
  db: Db;
  port: number;
  requestImport: () => void;
  importing: () => boolean;
  // The built frontend's folder, served with index.html as the fallback for non-/api paths; null serves none.
  webDist: string | null;
  now: () => Date;
  // Showing mode's display names, by project root path (the config's aliases).
  aliases: Record<string, string>;
  // The labeller's model, null while it is off (no key).
  labeller: { model: string } | null;
};

/**
 * The server. One middleware holds the request rules on every route, built files and 404s included: the `Host` must
 * be `localhost:<port>` or `127.0.0.1:<port>` (against DNS rebinding), and any method but GET and HEAD needs
 * `X-Dashboard-Refresh: 1` and, when an `Origin` is sent, the server's own. Another site can send a plain form POST to
 * 127.0.0.1; a custom header forces a preflight, which fails since no response carries an `Access-Control-*` header.
 */
export function createApp(deps: AppDeps): Hono {
  const hosts = [`localhost:${deps.port}`, `127.0.0.1:${deps.port}`];
  const origins = hosts.map((host) => `http://${host}`);
  const app = new Hono();
  app.use(async (c, next) => {
    if (!hosts.includes(c.req.header('Host') ?? '')) return c.text('Forbidden', 403);
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      const origin = c.req.header('Origin');
      if (c.req.header('X-Dashboard-Refresh') !== '1' || (origin !== undefined && !origins.includes(origin))) {
        return c.text('Forbidden', 403);
      }
    }
    await next();
  });
  registerRoutes(app, deps);
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

/** Serves the app on 127.0.0.1 only, never on another interface. */
export function serveApp(deps: AppDeps): void {
  serve({ fetch: createApp(deps).fetch, hostname: '127.0.0.1', port: deps.port });
  console.log(`dashboard on http://localhost:${deps.port}`);
}
