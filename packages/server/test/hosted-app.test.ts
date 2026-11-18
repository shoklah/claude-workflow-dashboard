import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadReport, type StatusResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import type { Db } from '../src/db/open.ts';
import { importReport } from '../src/db/import.ts';
import { getSeenAt } from '../src/db/read.ts';
import { runKey, sessionKey } from '../src/keys.ts';
import { A, B, hostedApp, NOW, ORIGIN, PUBLIC_HOST, twoAccounts } from './hosted-helpers.ts';

// The imports' time, which the first import also sets as each file's seen time.
const IMPORTED = new Date('2026-11-11T12:00:00Z');
const PAGES = [
  '/api/home',
  '/api/runs',
  '/api/work',
  '/api/findings',
  '/api/sessions',
  '/api/context',
  '/api/spend',
  '/api/compliance',
  '/api/steps',
  '/api/skills',
  '/api/models',
  '/api/weeks',
  '/api/showing',
  '/api/status',
];

let dir: string;
let hosted: ReturnType<typeof hostedApp>;
let cookieA: string;
let tokenA: string;
let bKeys: string[];
let bBranches: string[];

/** Imports the report into the account file `db`. */
function load(db: Db, raw: any): void {
  const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
  if (!loaded.ok) throw new Error('report does not load');
  importReport(db, loaded.report, { runs: raw.runs, sessions: raw.sessions, totals: raw.totals }, IMPORTED);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd hosted '));
  const webDist = join(dir, 'web dist');
  mkdirSync(join(webDist, 'assets'), { recursive: true });
  writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>edward</title>');
  writeFileSync(join(webDist, 'assets', 'app.js'), 'console.log("app");');
  writeFileSync(join(webDist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  hosted = hostedApp(join(dir, 'data'), { webDist });
  const { accounts, files } = hosted.hosted;
  ({ tokenA, cookieA } = twoAccounts(hosted.hosted));

  load(files.db(A.id), fixture('report-work'));
  // B's own variant: every branch and transcript file suffixed, so its run and session keys are B's own.
  const rawB = fixture('report-work');
  for (const run of rawB.runs) run.record.branch = `${run.record.branch}-b`;
  for (const s of rawB.sessions) s.file = `${s.file}-b`;
  load(files.db(B.id), rawB);
  bKeys = [...rawB.runs.map(runKey), ...rawB.sessions.map(sessionKey)];
  bBranches = rawB.runs.map((run: any) => run.record.branch);
});

afterEach(() => {
  hosted.close();
  rmSync(dir, { recursive: true, force: true });
});

type Init = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };

function send(path: string, init: Init = {}): Promise<Response> {
  return Promise.resolve(hosted.app.request(path, { ...init, headers: { Host: PUBLIC_HOST, ...init.headers } }));
}

const asA = (path: string, init: Init = {}) =>
  send(path, { ...init, headers: { Cookie: cookieA, ...init.headers } });

const post = { method: 'POST', headers: { 'X-Dashboard-Refresh': '1', Origin: ORIGIN } };

const accessControl = (res: Response) =>
  [...res.headers.keys()].filter((name) => name.toLowerCase().startsWith('access-control-'));

describe('hosted request rules', () => {
  test('a wrong Host is refused', async () => {
    expect((await asA('/api/home', { headers: { Host: 'localhost:4317' } })).status).toBe(403);
  });

  test("every page route answers A's cookie with A's data only", async () => {
    for (const path of PAGES) {
      const res = await asA(path);
      expect(res.status, path).toBe(200);
      const text = await res.text();
      for (const key of bKeys) expect(text, `${path} holds ${key}`).not.toContain(key);
      for (const branch of bBranches) {
        expect(text, `${path} holds ${branch}`).not.toContain(JSON.stringify(branch).slice(1, -1));
      }
      expect(accessControl(res)).toEqual([]);
    }
  });

  test("B's run is a 404 to A", async () => {
    expect((await asA(`/api/runs/${bKeys[0]}`)).status).toBe(404);
  });

  test("seen lands in A's file only", async () => {
    expect((await asA('/api/seen', post)).status).toBe(204);
    const { files } = hosted.hosted;
    expect(getSeenAt(files.db(A.id))).toEqual(NOW);
    expect(getSeenAt(files.db(B.id))).toEqual(IMPORTED);
  });

  test('no cookie: an api path is a 401 with no body, a page a redirect to sign-in', async () => {
    const api = await send('/api/home');
    expect(api.status).toBe(401);
    expect(await api.text()).toBe('');
    const page = await send('/work');
    expect(page.status).toBe(302);
    expect(page.headers.get('Location')).toBe('/signin');
    expect(accessControl(page)).toEqual([]);
  });

  test('no cookie: the sign-in page, assets and favicon are open', async () => {
    for (const path of ['/signin', '/assets/app.js', '/favicon.svg']) {
      expect((await send(path)).status, path).toBe(200);
    }
    expect(await (await send('/signin')).text()).toContain('<title>edward</title>');
  });

  test("a POST needs the refresh header and the public origin", async () => {
    const foreign = await asA('/api/seen', { ...post, headers: { ...post.headers, Origin: 'http://evil.example' } });
    expect(foreign.status).toBe(403);
    const missing = await asA('/api/seen', { method: 'POST', headers: { 'X-Dashboard-Refresh': '1' } });
    expect(missing.status).toBe(403);
    const noHeader = await asA('/api/seen', { method: 'POST', headers: { Origin: ORIGIN } });
    expect(noHeader.status).toBe(403);
    expect(getSeenAt(hosted.hosted.files.db(A.id))).toEqual(IMPORTED);
    expect((await asA('/api/seen', post)).status).toBe(204);
  });

  test('a token resolves only on /api/collect, a cookie never there', async () => {
    const bearer = { Authorization: `Bearer ${tokenA}` };
    expect((await send('/api/home', { headers: bearer })).status).toBe(401);
    expect((await asA('/api/collect/cursor')).status).toBe(401);
    expect((await send('/api/collect/cursor', { headers: { Authorization: 'Bearer ed_nope' } })).status).toBe(401);
    // A's token passes the rules.
    expect((await send('/api/collect/cursor', { headers: bearer })).status).toBe(200);
  });

  test('there is no refresh route', async () => {
    expect((await asA('/api/refresh', post)).status).toBe(404);
  });

  test("status names A's account", async () => {
    const status = (await (await asA('/api/status')).json()) as StatusResponse;
    expect(status.account).toEqual({ login: A.login, viewing: null, viewable: [], admin: false });
  });

  test('an expired or unknown session is no caller', async () => {
    expect((await send('/api/home', { headers: { Cookie: 'edward_session=nope' } })).status).toBe(401);
  });
});
