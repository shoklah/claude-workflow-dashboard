import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { AccountResponse, TokenResponse } from '@cwd/shared';
import { getCursor, setCursor } from '../src/db/read.ts';
import { collectorTokens } from '../src/hosted/schema.ts';
import { listTokens } from '../src/hosted/accounts.ts';
import { A, B, hostedApp, NOW, ORIGIN, PUBLIC_HOST, twoAccounts } from './hosted-helpers.ts';

let dir: string;
let hosted: ReturnType<typeof hostedApp>;
let tokenA: string;
let tokenB: string;
let cookieA: string;

const db = (id: number) => hosted.hosted.files.db(id);

function get(path: string, cookie = cookieA) {
  return hosted.app.request(path, { headers: { Host: PUBLIC_HOST, Cookie: cookie } });
}

function post(path: string, headers: Record<string, string> = { 'X-Dashboard-Refresh': '1', Origin: ORIGIN }) {
  return hosted.app.request(path, { method: 'POST', headers: { Host: PUBLIC_HOST, Cookie: cookieA, ...headers } });
}

function collectCursor(token: string) {
  return hosted.app.request('/api/collect/cursor', {
    headers: { Host: PUBLIC_HOST, Authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd account '));
  hosted = hostedApp(join(dir, 'data'));
  const { accounts } = hosted.hosted;
  ({ tokenA, tokenB, cookieA } = twoAccounts(hosted.hosted));
});

afterEach(() => {
  hosted.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /api/account', () => {
  test("lists the caller's own facts and tokens, never a hash or a raw token", async () => {
    setCursor(db(A.id), 'state-a:3');
    const res = await get('/api/account');
    expect(res.status).toBe(200);
    const body = (await res.json()) as AccountResponse;
    const [own] = listTokens(hosted.hosted.accounts, A.id);
    expect(body).toEqual({
      login: 'Alice',
      createdAt: NOW.toISOString(),
      lastCollectAt: null,
      machine: true,
      tokens: [{ id: own!.id, createdAt: NOW.toISOString(), lastUsedAt: null }],
      viewers: [],
      labeller: { keySet: false, model: 'claude-haiku-5-5', dailyMax: 500 },
    });
    const text = JSON.stringify(body);
    for (const { hash } of hosted.hosted.accounts.select().from(collectorTokens).all()) {
      expect(text).not.toContain(hash);
    }
    expect(text).not.toContain(tokenA);
    expect(text).not.toContain(tokenB);
  });

  test('machine is false with no cursor stored', async () => {
    expect(((await (await get('/api/account')).json()) as AccountResponse).machine).toBe(false);
  });

  test("a collector token doesn't resolve a caller", async () => {
    const res = await hosted.app.request('/api/account', {
      headers: { Host: PUBLIC_HOST, Authorization: `Bearer ${tokenA}` },
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/account/tokens', () => {
  test('returns a new raw token once, which then works on /api/collect/cursor', async () => {
    const res = await post('/api/account/tokens');
    expect(res.status).toBe(201);
    const { token } = (await res.json()) as TokenResponse;
    expect(token).toMatch(/^ed_/);
    expect(listTokens(hosted.hosted.accounts, A.id)).toHaveLength(2);
    expect((await collectCursor(token)).status).toBe(200);
    expect(JSON.stringify(await (await get('/api/account')).json())).not.toContain(token);
  });

  test('answers any other method with 405', async () => {
    expect((await get('/api/account/tokens')).status).toBe(405);
  });
});

describe('POST /api/account/tokens/:id/revoke', () => {
  test("revokes the caller's own token", async () => {
    const [own] = listTokens(hosted.hosted.accounts, A.id);
    expect((await post(`/api/account/tokens/${own!.id}/revoke`)).status).toBe(204);
    expect(listTokens(hosted.hosted.accounts, A.id)).toEqual([]);
    expect((await collectCursor(tokenA)).status).toBe(401);
  });

  test("another account's token is a 404 and still works", async () => {
    const [theirs] = listTokens(hosted.hosted.accounts, B.id);
    expect((await post(`/api/account/tokens/${theirs!.id}/revoke`)).status).toBe(404);
    expect((await collectCursor(tokenB)).status).toBe(200);
  });

  test('an id that is not a number is a 404', async () => {
    expect((await post('/api/account/tokens/x/revoke')).status).toBe(404);
  });
});

describe('POST /api/account/reset-collector', () => {
  test("clears the caller's cursor only", async () => {
    setCursor(db(A.id), 'state-a:3');
    setCursor(db(B.id), 'state-b:5');
    expect((await post('/api/account/reset-collector')).status).toBe(204);
    expect(getCursor(db(A.id))).toBeNull();
    expect(getCursor(db(B.id))).toBe('state-b:5');
  });
});

describe('the browser rules', () => {
  test.each(['/api/account/tokens', '/api/account/tokens/1/revoke', '/api/account/reset-collector'])(
    'POST %s without the refresh header is a 403',
    async (path) => {
      expect((await post(path, { Origin: ORIGIN })).status).toBe(403);
    },
  );
});
