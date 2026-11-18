import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { HomeResponse, StatusResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { listUnits } from '../src/db/read.ts';
import {
  addInvite,
  addViewer,
  createSession,
  deleteAccount,
  getAccount,
  getLabeller,
  listViewers,
  sessionAccount,
  SESSION,
  setLabeller,
  setViewing,
  signInAccount,
  tokenAccount,
  viewableAccounts,
} from '../src/hosted/accounts.ts';
import { labelAccounts } from '../src/hosted/labels.ts';
import type { LabelClient } from '../src/labeller.ts';
import { importJson } from '../src/reporter.ts';
import { A, B, hostedApp, NOW, ORIGIN, PUBLIC_HOST, SECRET, twoAccounts } from './hosted-helpers.ts';

let dir: string;
let data: string;
let hosted: ReturnType<typeof hostedApp>;
let cookieA: string;
let tokenA: string;
let tokenB: string;

const fileOf = (id: number) => join(data, 'accounts', `${id}.sqlite`);
const imported = (id: number) => {
  if (!importJson(hosted.hosted.files.db(id), fixture('report-v5'), null, NOW)) throw new Error('no import');
};

function get(path: string, cookie: string) {
  return hosted.app.request(path, { headers: { Host: PUBLIC_HOST, Cookie: cookie } });
}

function post(path: string, cookie: string) {
  return hosted.app.request(path, {
    method: 'POST',
    headers: { Host: PUBLIC_HOST, Cookie: cookie, 'X-Dashboard-Refresh': '1', Origin: ORIGIN },
  });
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd delete '));
  data = join(dir, 'data');
  hosted = hostedApp(data);
  ({ cookieA, tokenA, tokenB } = twoAccounts(hosted.hosted));
  imported(A.id);
  imported(B.id);
});

afterEach(() => {
  hosted.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('POST /api/account/delete', () => {
  test("deletes the caller's file, journals and rows, clears its cookie, and leaves the other account whole", async () => {
    const { accounts } = hosted.hosted;
    setLabeller(accounts, A.id, { key: 'sk-ant-test', model: 'claude-haiku-5-5', dailyMax: 500 }, SECRET);
    setLabeller(accounts, B.id, { key: 'sk-ant-b', model: 'claude-haiku-5-5', dailyMax: 500 }, SECRET);
    addViewer(accounts, A.id, B.login);
    addViewer(accounts, B.id, 'carol');
    const rawB = createSession(accounts, B.id, NOW);
    expect(setViewing(accounts, rawB, A.id)).toBe(true);
    for (const end of ['-journal', '-wal', '-shm']) writeFileSync(fileOf(A.id) + end, 'left over');
    const bRuns = listUnits(hosted.hosted.files.db(B.id), 'run').length;

    const res = await post('/api/account/delete', cookieA);
    expect(res.status).toBe(204);
    expect(res.headers.get('Set-Cookie')).toMatch(new RegExp(`^${SESSION}=;.*Max-Age=0`));

    for (const end of ['', '-journal', '-wal', '-shm']) expect(existsSync(fileOf(A.id) + end), end).toBe(false);
    expect(getAccount(accounts, A.id)).toBeNull();
    expect(getLabeller(accounts, A.id).keySet).toBe(false);
    expect(tokenAccount(accounts, tokenA, NOW)).toBeNull();
    expect((await get('/api/home', cookieA)).status).toBe(401);
    expect(listViewers(accounts, A.id)).toEqual([]);
    expect(viewableAccounts(accounts, B, 'admin')).toEqual([]);
    // B's session that viewed A falls back to B's own account.
    expect(sessionAccount(accounts, rawB, 'admin', NOW)).toEqual({ account: B, viewing: null });
    const status = (await (await get('/api/status', `${SESSION}=${rawB}`)).json()) as StatusResponse;
    expect(status.account).toMatchObject({ login: B.login, viewing: null });

    // B is untouched.
    expect(existsSync(fileOf(B.id))).toBe(true);
    expect(listUnits(hosted.hosted.files.db(B.id), 'run')).toHaveLength(bRuns);
    expect(getAccount(accounts, B.id)).toMatchObject(B);
    expect(getLabeller(accounts, B.id).keySet).toBe(true);
    expect(tokenAccount(accounts, tokenB, NOW)).toMatchObject(B);
    expect(listViewers(accounts, B.id)).toEqual(['carol']);
  });

  test('a still-invited login signing in again starts with an empty account', async () => {
    expect(listUnits(hosted.hosted.files.db(A.id), 'run').length).toBeGreaterThan(0);
    expect((await post('/api/account/delete', cookieA)).status).toBe(204);

    const { accounts } = hosted.hosted;
    expect(signInAccount(accounts, A, 'admin', NOW)).toEqual(A);
    const fresh = { id: 303, login: 'carol' };
    addInvite(accounts, fresh.login, NOW);
    signInAccount(accounts, fresh, 'admin', NOW);
    const home = async (id: number) =>
      (await (await get('/api/home', `${SESSION}=${createSession(accounts, id, NOW)}`)).json()) as HomeResponse;
    expect(await home(A.id)).toEqual(await home(fresh.id));
    expect(listUnits(hosted.hosted.files.db(A.id), 'run')).toEqual([]);
  });

  test('is a 403 while viewing, deleting neither account', async () => {
    const { accounts } = hosted.hosted;
    addViewer(accounts, A.id, B.login);
    const rawB = createSession(accounts, B.id, NOW);
    expect(setViewing(accounts, rawB, A.id)).toBe(true);
    expect((await post('/api/account/delete', `${SESSION}=${rawB}`)).status).toBe(403);
    for (const user of [A, B]) {
      expect(getAccount(accounts, user.id)).toMatchObject(user);
      expect(existsSync(fileOf(user.id))).toBe(true);
    }
  });

  test('answers any other method with 405', async () => {
    expect((await get('/api/account/delete', cookieA)).status).toBe(405);
  });
});

describe('deleteAccount', () => {
  test('takes the grants the account received too: signing in again, it views nothing until granted again', () => {
    const { accounts, files } = hosted.hosted;
    const owner = { id: 303, login: 'carol' };
    addInvite(accounts, owner.login, NOW);
    signInAccount(accounts, owner, 'admin', NOW);
    addViewer(accounts, owner.id, A.login);
    expect(viewableAccounts(accounts, A, 'admin')).toEqual([owner]);

    deleteAccount(accounts, files, A.id);
    expect(listViewers(accounts, owner.id)).toEqual([]);
    expect(signInAccount(accounts, A, 'admin', NOW)).toEqual(A);
    expect(viewableAccounts(accounts, A, 'admin')).toEqual([]);
    addViewer(accounts, owner.id, A.login);
    expect(viewableAccounts(accounts, A, 'admin')).toEqual([owner]);
  });

  test("keeps the account's row when its file's removal throws", () => {
    const { accounts, files } = hosted.hosted;
    const failing = {
      ...files,
      remove() {
        throw new Error('EBUSY');
      },
    };
    expect(() => deleteAccount(accounts, failing, A.id)).toThrow('EBUSY');
    expect(getAccount(accounts, A.id)).toMatchObject(A);
    expect(tokenAccount(accounts, tokenA, NOW)).toMatchObject(A);
  });
});

describe('labelAccounts, an account deleted after its snapshot', () => {
  test('is skipped, and its file does not reappear', async () => {
    const { accounts, files } = hosted.hosted;
    setLabeller(accounts, A.id, { key: 'sk-ant-test', model: 'claude-haiku-5-5', dailyMax: 500 }, SECRET);
    setLabeller(accounts, B.id, { key: 'sk-ant-b', model: 'claude-haiku-5-5', dailyMax: 500 }, SECRET);
    const asked: string[] = [];
    const clientFor = (_model: string, key: string): LabelClient => {
      asked.push(key);
      // A's turn, after the snapshot was read: B goes.
      deleteAccount(accounts, files, B.id);
      return async () => ({ results: [], inputTokens: 0, outputTokens: 0 });
    };
    await labelAccounts({ ...hosted.hosted, clientFor, now: () => NOW });
    expect(asked).toEqual(['sk-ant-test']);
    expect(existsSync(fileOf(B.id))).toBe(false);
  });
});
