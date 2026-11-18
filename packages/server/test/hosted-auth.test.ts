import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { addInvite, sessionAccount } from '../src/hosted/accounts.ts';
import { accounts, sessions } from '../src/hosted/schema.ts';
import { githubClient } from '../src/hosted/github.ts';
import { hostedApp, NOW, ORIGIN, PUBLIC_HOST } from './hosted-helpers.ts';

const CALLBACK = `${ORIGIN}/auth/github/callback`;

let dir: string;
let hosted: ReturnType<typeof hostedApp>;
let logs: unknown[][];

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd hosted auth '));
  hosted = hostedApp(join(dir, 'data'));
  addInvite(hosted.hosted.accounts, 'alice', NOW);
  logs = [];
  vi.spyOn(console, 'log').mockImplementation((...args) => void logs.push(args));
  vi.spyOn(console, 'error').mockImplementation((...args) => void logs.push(args));
});

afterEach(() => {
  vi.restoreAllMocks();
  hosted.close();
  rmSync(dir, { recursive: true, force: true });
});

type Init = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

function send(path: string, init: Init = {}): Promise<Response> {
  return Promise.resolve(hosted.app.request(path, { ...init, headers: { Host: PUBLIC_HOST, ...init.headers } }));
}

/** The response's Set-Cookie line for `name`. */
function setCookie(res: Response, name: string): string | undefined {
  return res.headers.getSetCookie().find((line) => line.startsWith(`${name}=`));
}

const cookieValue = (line: string | undefined) => line?.split(';')[0].split('=').slice(1).join('=') ?? '';

/** Starts a sign-in: the state cookie's value. */
async function start(): Promise<string> {
  return cookieValue(setCookie(await send('/auth/github'), 'edward_oauth'));
}

function callback(query: string, state: string | null): Promise<Response> {
  return send(`/auth/github/callback?${query}`, state === null ? {} : { headers: { Cookie: `edward_oauth=${state}` } });
}

const sessionRows = () => hosted.hosted.accounts.select().from(sessions).all();
const accountRows = () => hosted.hosted.accounts.select().from(accounts).all();

/** Nothing logged holds any of `secrets`. */
function expectNotLogged(...secrets: string[]): void {
  const text = JSON.stringify(logs);
  for (const secret of secrets) expect(text).not.toContain(secret);
}

describe('GET /auth/github', () => {
  test('sets the state cookie and redirects to GitHub with it', async () => {
    const res = await send('/auth/github');
    expect(res.status).toBe(302);
    const line = setCookie(res, 'edward_oauth');
    expect(line).toMatch(/HttpOnly/);
    expect(line).toMatch(/Secure/);
    expect(line).toMatch(/SameSite=Lax/);
    expect(line).toMatch(/Path=\/auth(;|$)/);
    expect(line).toMatch(/Max-Age=600/);
    const url = new URL(res.headers.get('Location') ?? '');
    expect(url.origin + url.pathname).toBe('https://github.com/login/oauth/authorize');
    expect(url.searchParams.get('state')).toBe(cookieValue(line));
    expect(url.searchParams.get('state')).not.toBe('');
    expect(url.searchParams.get('redirect_uri')).toBe(`https://${PUBLIC_HOST}/auth/github/callback`);
    expect(url.searchParams.get('client_id')).toBe('test-client-id');
    expect(url.searchParams.get('scope')).toBe('');
    expect(url.searchParams.has('client_secret')).toBe(false);
    expect(res.headers.get('Location')).not.toContain('test-client-secret');
  });

  test('the built files do not shadow it', async () => {
    hosted.close();
    const webDist = join(dir, 'web dist');
    mkdirSync(webDist, { recursive: true });
    writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>edward</title>');
    hosted = hostedApp(join(dir, 'data2'), { webDist });
    const res = await send('/auth/github');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toMatch(/^https:\/\/github\.com\/login\/oauth\/authorize\?/);
  });
});

describe('GET /auth/github/callback', () => {
  test('an invited user gets a session and goes home', async () => {
    const state = await start();
    const res = await callback(`code=code-alice&state=${state}`, state);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
    const line = setCookie(res, 'edward_session');
    expect(line).toMatch(/HttpOnly/);
    expect(line).toMatch(/Secure/);
    expect(line).toMatch(/SameSite=Lax/);
    expect(line).toMatch(/Path=\/(;|$)/);
    expect(line).toMatch(/Max-Age=2592000/);
    expect(sessionAccount(hosted.hosted.accounts, cookieValue(line), NOW)).toEqual({ id: 101, login: 'Alice' });
    expect(setCookie(res, 'edward_oauth')).toMatch(/Max-Age=0/);
    expectNotLogged('code-alice', state);
  });

  test.each([
    ['a wrong state', (state: string) => callback(`code=code-alice&state=${state}x`, state)],
    ['a missing state', (state: string) => callback('code=code-alice', state)],
    ['no state cookie', (state: string) => callback(`code=code-alice&state=${state}`, null)],
    ['an error param', (state: string) => callback(`error=access_denied&state=${state}`, state)],
    ['a GitHub failure', (state: string) => callback(`code=code-unknown&state=${state}`, state)],
  ])('%s fails with no session', async (_name, run) => {
    const state = await start();
    const res = await run(state);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/signin?error=failed');
    expect(setCookie(res, 'edward_session')).toBeUndefined();
    expect(setCookie(res, 'edward_oauth')).toMatch(/Max-Age=0/);
    expect(sessionRows()).toEqual([]);
    expectNotLogged('code-alice', 'code-unknown', state);
  });

  test('an uninvited user is refused, with no account', async () => {
    const state = await start();
    const res = await callback(`code=code-mallory&state=${state}`, state);
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/signin?error=refused');
    expect(setCookie(res, 'edward_oauth')).toMatch(/Max-Age=0/);
    expect(accountRows()).toEqual([]);
    expect(sessionRows()).toEqual([]);
  });
});

describe('POST /auth/signout', () => {
  test('ends the session', async () => {
    const state = await start();
    const cookie = `edward_session=${cookieValue(setCookie(await callback(`code=code-alice&state=${state}`, state), 'edward_session'))}`;
    expect((await send('/api/home', { headers: { Cookie: cookie } })).status).toBe(200);
    const res = await send('/auth/signout', {
      method: 'POST',
      headers: { Cookie: cookie, 'X-Dashboard-Refresh': '1', Origin: ORIGIN },
    });
    expect(res.status).toBe(204);
    expect(setCookie(res, 'edward_session')).toMatch(/Max-Age=0/);
    expect(sessionRows()).toEqual([]);
    expect((await send('/api/home', { headers: { Cookie: cookie } })).status).toBe(401);
  });
});

describe('githubClient', () => {
  type Call = { url: string; init: RequestInit };

  /** A stub fetch answering the token POST and the user GET with `token` and `user`, recording each call. */
  function stubFetch(calls: Call[], token: Response, user: Response): typeof fetch {
    return (async (url: string | URL | Request, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      return String(url).startsWith('https://github.com/login/oauth/access_token') ? token : user;
    }) as typeof fetch;
  }

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const client = (stub: typeof fetch) => githubClient({ clientId: 'cid', clientSecret: 'shh-secret', fetch: stub });

  test('trades the code for a token, then reads the user; the secret only in the token POST body', async () => {
    const calls: Call[] = [];
    const fetch = stubFetch(calls, json({ access_token: 'tok-123' }), json({ id: 7, login: 'Alice', name: 'A' }));
    expect(await client(fetch).user('the-code', CALLBACK)).toEqual({ id: 7, login: 'Alice' });
    expect(calls.map((call) => call.url)).toEqual([
      'https://github.com/login/oauth/access_token',
      'https://api.github.com/user',
    ]);
    const [tokenCall, userCall] = calls;
    expect(tokenCall.init.method).toBe('POST');
    expect(new Headers(tokenCall.init.headers).get('Accept')).toBe('application/json');
    expect(String(tokenCall.init.body)).toContain('shh-secret');
    expect(String(tokenCall.init.body)).toContain('the-code');
    expect(JSON.stringify([...new Headers(tokenCall.init.headers)])).not.toContain('shh-secret');
    expect(new Headers(userCall.init.headers).get('Authorization')).toBe('Bearer tok-123');
    expect(JSON.stringify(userCall)).not.toContain('shh-secret');
    expect(calls.map((call) => call.url).join()).not.toContain('shh-secret');
    expect(client(fetch).authorizeUrl('st', CALLBACK)).not.toContain('shh-secret');
  });

  test.each([
    ['a 500 from the token POST', () => [new Response('boom tok-123', { status: 500 }), json({ id: 7, login: 'a' })]],
    ['a token reply without a token', () => [json({ error: 'bad_verification_code' }), json({ id: 7, login: 'a' })]],
    ['a 500 from the user GET', () => [json({ access_token: 'tok-123' }), new Response('tok-123', { status: 500 })]],
    ['a user without id', () => [json({ access_token: 'tok-123' }), json({ login: 'a' })]],
  ])('%s throws the fixed error', async (_name, replies) => {
    const [token, user] = replies();
    const error = await client(stubFetch([], token, user))
      .user('the-code', CALLBACK)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('GitHub sign-in failed');
    expect((error as Error).cause).toBeUndefined();
  });
});
