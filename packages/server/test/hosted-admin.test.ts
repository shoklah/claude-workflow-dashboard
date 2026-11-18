import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { AdminResponse, StatusResponse } from '@cwd/shared';
import {
  addInvite,
  createSession,
  createToken,
  getAccount,
  SESSION,
  setLastCollect,
  signInAccount,
} from '../src/hosted/accounts.ts';
import { sessions } from '../src/hosted/schema.ts';
import { hostedApp, NOW, ORIGIN, PUBLIC_HOST } from './hosted-helpers.ts';

const ADMIN = { id: 1, login: 'admin' };
const MIKA = { id: 202, login: 'mika-ito' };

let dir: string;
let data: string;
let hosted: ReturnType<typeof hostedApp>;
let adminCookie: string;
let mikaCookie: string;
let mikaToken: string;

const fileOf = (id: number) => join(data, 'accounts', `${id}.sqlite`);

function get(path: string, cookie: string) {
  return hosted.app.request(path, { headers: { Host: PUBLIC_HOST, Cookie: cookie } });
}

function post(path: string, cookie: string, body?: unknown) {
  return hosted.app.request(path, {
    method: 'POST',
    headers: { Host: PUBLIC_HOST, Cookie: cookie, 'X-Dashboard-Refresh': '1', Origin: ORIGIN },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** A whole GitHub sign-in with `code`: the callback's response. */
async function signIn(code: string): Promise<Response> {
  const start = await hosted.app.request('/auth/github', { headers: { Host: PUBLIC_HOST } });
  const line = start.headers.getSetCookie().find((cookie) => cookie.startsWith('edward_oauth='))!;
  const state = line.split(';')[0]!.slice('edward_oauth='.length);
  return hosted.app.request(`/auth/github/callback?code=${code}&state=${state}`, {
    headers: { Host: PUBLIC_HOST, Cookie: `edward_oauth=${state}` },
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd admin '));
  data = join(dir, 'data');
  hosted = hostedApp(data);
  const { accounts, files } = hosted.hosted;
  signInAccount(accounts, ADMIN, 'admin', NOW);
  addInvite(accounts, MIKA.login, NOW);
  signInAccount(accounts, MIKA, 'admin', NOW);
  adminCookie = `${SESSION}=${createSession(accounts, ADMIN.id, NOW)}`;
  mikaCookie = `${SESSION}=${createSession(accounts, MIKA.id, NOW)}`;
  mikaToken = createToken(accounts, MIKA.id, NOW);
  files.db(ADMIN.id);
  files.db(MIKA.id);
});

afterEach(() => {
  hosted.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('/api/status', () => {
  test('says admin only for the admin', async () => {
    const status = async (cookie: string) => ((await (await get('/api/status', cookie)).json()) as StatusResponse).account;
    expect((await status(adminCookie))?.admin).toBe(true);
    expect((await status(mikaCookie))?.admin).toBe(false);
  });
});

describe('/api/admin*, anyone but the admin', () => {
  test('gets 404 on every route, changing nothing', async () => {
    expect((await get('/api/admin', mikaCookie)).status).toBe(404);
    expect((await post('/api/admin/invites', mikaCookie, { login: 'sam-okafor' })).status).toBe(404);
    expect((await post('/api/admin/invites/mika-ito/remove', mikaCookie)).status).toBe(404);
    expect((await post(`/api/admin/accounts/${ADMIN.id}/delete`, mikaCookie)).status).toBe(404);
    expect((await get('/api/admin/accounts/1/delete', mikaCookie)).status).toBe(404);
    const admin = (await (await get('/api/admin', adminCookie)).json()) as AdminResponse;
    expect(admin.invites.map((invite) => invite.login)).toEqual(['mika-ito']);
    expect(getAccount(hosted.hosted.accounts, ADMIN.id)).not.toBeNull();
  });

  test('gets 401 with no session', async () => {
    expect((await get('/api/admin', '')).status).toBe(401);
  });
});

describe('invites', () => {
  test('the admin invites a login, stored lower-case', async () => {
    expect((await post('/api/admin/invites', adminCookie, { login: 'Sam-Okafor' })).status).toBe(204);
    const admin = (await (await get('/api/admin', adminCookie)).json()) as AdminResponse;
    expect(admin.invites).toEqual([
      { login: 'mika-ito', addedAt: NOW.toISOString(), signedIn: true },
      { login: 'sam-okafor', addedAt: NOW.toISOString(), signedIn: false },
    ]);
  });

  test('a login of the wrong syntax is a 400; another method a 405', async () => {
    expect((await post('/api/admin/invites', adminCookie, { login: 'not a login' })).status).toBe(400);
    expect((await post('/api/admin/invites', adminCookie, {})).status).toBe(400);
    expect((await get('/api/admin/invites', adminCookie)).status).toBe(405);
    expect((await get('/api/admin/invites/mika-ito/remove', adminCookie)).status).toBe(405);
  });

  test("removing an invite locks that login out, keeping its file", async () => {
    expect((await post('/api/admin/invites/Mika-Ito/remove', adminCookie)).status).toBe(204);
    expect((await get('/api/home', mikaCookie)).status).toBe(401);
    const cursor = await hosted.app.request('/api/collect/cursor', {
      headers: { Host: PUBLIC_HOST, Authorization: `Bearer ${mikaToken}` },
    });
    expect(cursor.status).toBe(401);
    expect(existsSync(fileOf(MIKA.id))).toBe(true);

    const before = hosted.hosted.accounts.select().from(sessions).all().length;
    const res = await signIn('code-mika');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/signin?error=refused');
    expect(res.headers.getSetCookie().some((line) => line.startsWith(`${SESSION}=`))).toBe(false);
    expect(hosted.hosted.accounts.select().from(sessions).all()).toHaveLength(before);
  });

  test('the admin still signs in with no invite', async () => {
    const res = await signIn('code-admin');
    expect(res.headers.get('Location')).toBe('/');
    expect(res.headers.getSetCookie().some((line) => line.startsWith(`${SESSION}=`))).toBe(true);
  });
});

describe('accounts', () => {
  test('are listed with their times, and nothing of their tokens or sessions', async () => {
    setLastCollect(hosted.hosted.accounts, MIKA.id, NOW);
    const res = await get('/api/admin', adminCookie);
    const text = await res.text();
    expect((JSON.parse(text) as AdminResponse).accounts).toEqual([
      { id: ADMIN.id, login: 'admin', createdAt: NOW.toISOString(), lastCollectAt: null },
      { id: MIKA.id, login: 'mika-ito', createdAt: NOW.toISOString(), lastCollectAt: NOW.toISOString() },
    ]);
    for (const secret of [mikaToken, mikaCookie.slice(`${SESSION}=`.length)]) expect(text).not.toContain(secret);
    expect(text).not.toMatch(/token|session|hash/i);
  });

  test("the admin can't delete their own account", async () => {
    expect((await post(`/api/admin/accounts/${ADMIN.id}/delete`, adminCookie)).status).toBe(400);
    expect(getAccount(hosted.hosted.accounts, ADMIN.id)).not.toBeNull();
    expect(existsSync(fileOf(ADMIN.id))).toBe(true);
  });

  test('the admin deletes another account, its file with it', async () => {
    expect((await post(`/api/admin/accounts/${MIKA.id}/delete`, adminCookie)).status).toBe(204);
    expect(existsSync(fileOf(MIKA.id))).toBe(false);
    expect(getAccount(hosted.hosted.accounts, MIKA.id)).toBeNull();
    expect((await get('/api/home', mikaCookie)).status).toBe(401);
  });

  test('an unknown or malformed id is a 404; another method a 405', async () => {
    expect((await post('/api/admin/accounts/999/delete', adminCookie)).status).toBe(404);
    expect((await post('/api/admin/accounts/abc/delete', adminCookie)).status).toBe(404);
    expect((await get(`/api/admin/accounts/${MIKA.id}/delete`, adminCookie)).status).toBe(405);
    expect(getAccount(hosted.hosted.accounts, MIKA.id)).not.toBeNull();
  });
});
