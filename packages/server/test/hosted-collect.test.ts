import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { StatusResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { imports } from '../src/db/schema.ts';
import { clearCursor, getCursor, lastImport, listUnits } from '../src/db/read.ts';
import {
  addInvite,
  createSession,
  createToken,
  getAccount,
  listTokens,
  revokeToken,
  signInAccount,
} from '../src/hosted/accounts.ts';
import { runKey } from '../src/keys.ts';
import { hostedApp, NOW, PUBLIC_HOST } from './hosted-helpers.ts';

const A = { id: 101, login: 'Alice' };
const B = { id: 202, login: 'bob' };

let dir: string;
let hosted: ReturnType<typeof hostedApp>;
let tokenA: string;
let tokenB: string;
let cookieA: string;

/** report-work with `cursor` set (deleted when null), as a fresh copy. */
function exportWith(cursor: string | null): any {
  const raw = fixture('report-work');
  if (cursor === null) delete raw.cursor;
  else raw.cursor = cursor;
  return raw;
}

function collect(
  path: string,
  token: string,
  init: { method?: string; body?: BodyInit; headers?: Record<string, string> } = {},
) {
  return hosted.app.request(path, {
    method: init.method ?? 'GET',
    body: init.body,
    headers: { Host: PUBLIC_HOST, Authorization: `Bearer ${token}`, ...init.headers },
  });
}

function post(token: string, raw: unknown) {
  return collect('/api/collect', token, { method: 'POST', body: gzipSync(JSON.stringify(raw)) });
}

const db = (id: number) => hosted.hosted.files.db(id);
const importCount = (id: number) => db(id).select().from(imports).all().length;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd collect '));
  hosted = hostedApp(join(dir, 'data'));
  const { accounts } = hosted.hosted;
  for (const user of [A, B]) {
    addInvite(accounts, user.login, NOW);
    signInAccount(accounts, user, 'admin', NOW);
  }
  tokenA = createToken(accounts, A.id, NOW);
  tokenB = createToken(accounts, B.id, NOW);
  cookieA = `edward_session=${createSession(accounts, A.id, NOW)}`;
});

afterEach(() => {
  hosted.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('POST /api/collect', () => {
  test("a gzipped export is stored in the token's own account file only", async () => {
    const res = await post(tokenA, exportWith('state-a:3'));
    expect(res.status).toBe(204);
    expect(listUnits(db(A.id), 'run').length).toBeGreaterThan(0);
    expect(listUnits(db(A.id), 'session').length).toBeGreaterThan(0);
    expect(listUnits(db(B.id), 'run')).toEqual([]);
    expect(listUnits(db(B.id), 'session')).toEqual([]);
    expect(getAccount(hosted.hosted.accounts, A.id)?.lastCollectAt).toEqual(NOW);
    expect(getAccount(hosted.hosted.accounts, B.id)?.lastCollectAt).toBeNull();

    const cursor = await collect('/api/collect/cursor', tokenA);
    expect(cursor.status).toBe(200);
    expect(await cursor.json()).toEqual({ cursor: 'state-a:3' });
    expect(await (await collect('/api/collect/cursor', tokenB)).json()).toEqual({ cursor: null });
  });

  test('an incremental export marks only its removed keys missing', async () => {
    const full = exportWith('state-a:3');
    expect((await post(tokenA, full)).status).toBe(204);
    const keys = full.runs.map(runKey);
    const incremental = exportWith('state-a:4');
    incremental.runs = [full.runs[0]];
    incremental.sessions = [];
    incremental.removed = { runs: [keys[1]], sessions: [] };
    expect((await post(tokenA, incremental)).status).toBe(204);
    const missing = listUnits(db(A.id), 'run').filter((u) => u.missingSince !== null).map((u) => u.key);
    expect(missing).toEqual([keys[1]]);
    expect(listUnits(db(A.id), 'session').every((u) => u.missingSince === null)).toBe(true);
  });

  test("another machine's export is refused with 409 before anything is stored", async () => {
    expect((await post(tokenA, exportWith('state-a:3'))).status).toBe(204);
    const before = listUnits(db(A.id), 'run');
    const importsBefore = importCount(A.id);
    const other = exportWith('other-state:5');
    other.runs = [other.runs[0]];
    other.sessions = [];

    const res = await post(tokenA, other);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'another machine feeds this account' });
    const none = await post(tokenA, exportWith(null));
    expect(none.status).toBe(409);
    expect(listUnits(db(A.id), 'run')).toEqual(before);
    expect(importCount(A.id)).toBe(importsBefore);
    expect(getCursor(db(A.id))).toBe('state-a:3');

    clearCursor(db(A.id));
    expect((await post(tokenA, other)).status).toBe(204);
    expect(getCursor(db(A.id))).toBe('other-state:5');
  });

  test('a body that is not gzip is a 400 with a stored failure', async () => {
    const body = JSON.stringify(exportWith('state-a:3'));
    const res = await collect('/api/collect', tokenA, { method: 'POST', body });
    expect(res.status).toBe(400);
    expect(lastImport(db(A.id))).toMatchObject({ ok: false, error: 'collect failed: body is not gzipped JSON' });
    expect(listUnits(db(A.id), 'run')).toEqual([]);
  });

  test('gzipped text that is not JSON is a 400 with a stored failure', async () => {
    const res = await collect('/api/collect', tokenA, { method: 'POST', body: gzipSync('not json') });
    expect(res.status).toBe(400);
    expect(lastImport(db(A.id))).toMatchObject({ ok: false, error: 'collect failed: body is not gzipped JSON' });
  });

  test("an export the loader refuses is a 400 with the loader's failure", async () => {
    const raw = exportWith('state-a:3');
    raw.version = 2;
    const res = await post(tokenA, raw);
    expect(res.status).toBe(400);
    expect(lastImport(db(A.id))).toMatchObject({ ok: false, error: 'report version is not 1' });
  });

  test('a body past 32 MB is a 413', async () => {
    const res = await collect('/api/collect', tokenA, { method: 'POST', body: new Uint8Array(33 * 1024 * 1024) });
    expect(res.status).toBe(413);
    expect(lastImport(db(A.id))).toBeNull();
  });

  test('a body that unzips past 64 MB is a 413', async () => {
    const res = await collect('/api/collect', tokenA, {
      method: 'POST',
      body: gzipSync(Buffer.alloc(65 * 1024 * 1024, ' ')),
    });
    expect(res.status).toBe(413);
    expect(lastImport(db(A.id))).toBeNull();
  });

  test('a revoked token is a 401', async () => {
    const [{ id }] = listTokens(hosted.hosted.accounts, A.id);
    revokeToken(hosted.hosted.accounts, A.id, id);
    expect((await post(tokenA, exportWith('state-a:3'))).status).toBe(401);
    expect((await collect('/api/collect/cursor', tokenA)).status).toBe(401);
  });

  test('a GET is a 405', async () => {
    expect((await collect('/api/collect', tokenA)).status).toBe(405);
  });
});

describe('POST /api/collect/failure', () => {
  test("records the collector's error, shown in the account's status", async () => {
    const res = await collect('/api/collect/failure', tokenA, {
      method: 'POST',
      body: JSON.stringify({ error: 'reporter exited with 1: boom' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(204);
    expect(getAccount(hosted.hosted.accounts, A.id)?.lastCollectAt).toEqual(NOW);
    const status = await hosted.app.request('/api/status', { headers: { Host: PUBLIC_HOST, Cookie: cookieA } });
    expect(((await status.json()) as StatusResponse).error).toBe('reporter exited with 1: boom');
    expect(lastImport(db(B.id))).toBeNull();
  });

  test('an error past 2000 characters or not a string is a 400', async () => {
    for (const body of [{ error: 'x'.repeat(2001) }, { error: 3 }, {}]) {
      const res = await collect('/api/collect/failure', tokenA, { method: 'POST', body: JSON.stringify(body) });
      expect(res.status).toBe(400);
    }
    expect((await collect('/api/collect/failure', tokenA, { method: 'POST', body: 'nope' })).status).toBe(400);
    expect(lastImport(db(A.id))).toBeNull();
  });
});
