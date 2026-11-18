import { timingSafeEqual } from 'node:crypto';
import type { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { AppDeps, AppEnv, HostedDeps } from '../app.ts';
import { postOnly } from '../routes.ts';
import { createSession, deleteSession, newSecret, SESSION, SESSION_MS, signInAccount } from './accounts.ts';

const OAUTH = 'edward_oauth';
const OAUTH_COOKIE = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/auth' } as const;
const SESSION_COOKIE = { httpOnly: true, secure: true, sameSite: 'Lax', path: '/' } as const;

/** Whether two strings are equal, in constant time for equal lengths. */
function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * GitHub sign-in, invite-only (hosted mode). The routes never read `c.var.db`: the middleware passes `/auth/*` with no
 * caller. Every failure redirects to `/signin?error=failed` or `refused`, with no text from GitHub, and nothing here
 * logs the code, the state or a session ID.
 */
export function registerAuth(app: Hono<AppEnv>, deps: AppDeps & { hosted: HostedDeps }): void {
  const { hosted } = deps;
  const callback = `${hosted.origin}/auth/github/callback`;

  app.get('/auth/github', (c) => {
    const state = newSecret();
    setCookie(c, OAUTH, state, { ...OAUTH_COOKIE, maxAge: 10 * 60 });
    return c.redirect(hosted.github.authorizeUrl(state, callback), 302);
  });

  app.get('/auth/github/callback', async (c) => {
    const expected = getCookie(c, OAUTH);
    deleteCookie(c, OAUTH, OAUTH_COOKIE);
    const { code, state, error } = c.req.query();
    if (error !== undefined || !code || !state || !expected || !sameSecret(state, expected)) {
      return c.redirect('/signin?error=failed', 302);
    }
    let user;
    try {
      user = await hosted.github.user(code, callback);
    } catch {
      return c.redirect('/signin?error=failed', 302);
    }
    const account = signInAccount(hosted.accounts, user, hosted.admin, deps.now());
    if (!account) return c.redirect('/signin?error=refused', 302);
    const session = createSession(hosted.accounts, account.id, deps.now());
    setCookie(c, SESSION, session, { ...SESSION_COOKIE, maxAge: SESSION_MS / 1000 });
    return c.redirect('/', 302);
  });

  app.post('/auth/signout', (c) => {
    const raw = getCookie(c, SESSION);
    if (raw) deleteSession(hosted.accounts, raw);
    deleteCookie(c, SESSION, SESSION_COOKIE);
    return c.body(null, 204);
  });
  app.all('/auth/signout', postOnly);

  // So the built files' index.html fallback never answers an /auth path.
  app.all('/auth/*', (c) => c.notFound());
}
