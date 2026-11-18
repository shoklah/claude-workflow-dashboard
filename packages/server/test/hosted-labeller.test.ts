import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AccountResponse, FindingsResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { activeList } from '../src/categories.ts';
import { currentLabels, labelInputs } from '../src/db/labels.ts';
import { listUnits } from '../src/db/read.ts';
import type { Db } from '../src/db/open.ts';
import {
  addInvite,
  addViewer,
  createSession,
  labellerAccounts,
  SESSION,
  setLabeller,
  setViewing,
  signInAccount,
} from '../src/hosted/accounts.ts';
import { labelAccounts } from '../src/hosted/labels.ts';
import { openKey, sealKey } from '../src/hosted/secret.ts';
import type { LabelClient } from '../src/labeller.ts';
import { importJson } from '../src/reporter.ts';
import { A, B, hostedApp, NOW, ORIGIN, PUBLIC_HOST, SECRET, twoAccounts } from './hosted-helpers.ts';

const KEY = 'sk-ant-test';
const MODEL = 'claude-haiku-5-5';

describe('sealKey and openKey', () => {
  test('open what they seal, and two seals of one key differ', () => {
    const sealed = sealKey(SECRET, KEY, A.id);
    expect(openKey(SECRET, sealed, A.id)).toBe(KEY);
    expect(sealed).not.toContain(KEY);
    expect(sealKey(SECRET, KEY, A.id)).not.toBe(sealed);
  });

  test('a flipped byte, a short value or another secret throws the fixed message', () => {
    const bytes = Buffer.from(sealKey(SECRET, KEY, A.id), 'base64');
    for (const at of [0, 12, bytes.length - 1]) {
      const flipped = Buffer.from(bytes);
      flipped[at]! ^= 1;
      expect(() => openKey(SECRET, flipped.toString('base64'), A.id)).toThrow(new Error('stored key does not open'));
    }
    expect(() => openKey(SECRET, bytes.subarray(0, 20).toString('base64'), A.id)).toThrow(
      new Error('stored key does not open'),
    );
    expect(() => openKey(Buffer.alloc(32, 7), bytes.toString('base64'), A.id)).toThrow(new Error('stored key does not open'));
  });

  test("a key sealed for one account doesn't open for another", () => {
    const sealed = sealKey(SECRET, KEY, A.id);
    expect(() => openKey(SECRET, sealed, B.id)).toThrow(new Error('stored key does not open'));
  });
});

let dir: string;
let hosted: ReturnType<typeof hostedApp>;
let cookieA: string;
let tokenA: string;

const db = (id: number) => hosted.hosted.files.db(id);

function get(path: string, cookie = cookieA) {
  return hosted.app.request(path, { headers: { Host: PUBLIC_HOST, Cookie: cookie } });
}

function postLabeller(body: unknown) {
  return hosted.app.request('/api/account/labeller', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Host: PUBLIC_HOST, Cookie: cookieA, 'X-Dashboard-Refresh': '1', Origin: ORIGIN },
  });
}

/** report-v5, which has a category list, imported into the account's file. */
function imported(id: number): Db {
  if (!importJson(db(id), fixture('report-v5'), null, NOW)) throw new Error('the fixture does not import');
  return db(id);
}

function labelled(file: Db): number {
  const list = activeList(file)!;
  return currentLabels(file, labelInputs(listUnits(file, 'run')), list.number).size;
}

/** A stub client factory recording each (model, key) it is asked for; each client answers with the area's first id. */
function stubFactory() {
  const asked: [string, string][] = [];
  const clientFor = (model: string, key: string): LabelClient => {
    asked.push([model, key]);
    return async (batch, list) => ({
      results: batch.map((item) => ({
        id: item.id,
        category: list.areas[item.area][0]!.id,
        relevance: 'valid' as const,
        reason: 'An invented reason.',
      })),
      inputTokens: 1,
      outputTokens: 1,
    });
  };
  return { asked, clientFor };
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd labeller hosted '));
  hosted = hostedApp(join(dir, 'data'));
  ({ cookieA, tokenA } = twoAccounts(hosted.hosted));
});

afterEach(() => {
  hosted.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('POST /api/account/labeller', () => {
  test('stores the key sealed: never returned, never in the accounts database in clear', async () => {
    const before = ((await (await get('/api/account')).json()) as AccountResponse).labeller;
    expect(before).toEqual({ keySet: false, model: MODEL, dailyMax: 500 });

    const res = await postLabeller({ key: KEY, model: 'claude-sonnet-5-5', dailyMax: 40 });
    expect(res.status).toBe(204);
    const text = await (await get('/api/account')).text();
    expect(text).not.toContain(KEY);
    expect((JSON.parse(text) as AccountResponse).labeller).toEqual({
      keySet: true,
      model: 'claude-sonnet-5-5',
      dailyMax: 40,
    });

    const file = join(dir, 'data', 'accounts.sqlite');
    for (const path of [file, `${file}-wal`, `${file}-journal`].filter(existsSync)) {
      expect(readFileSync(path).includes(KEY)).toBe(false);
    }
    const [entry] = labellerAccounts(hosted.hosted.accounts);
    expect(entry).toMatchObject({ accountId: A.id, model: 'claude-sonnet-5-5', dailyMax: 40 });
    expect(openKey(SECRET, entry!.sealedKey, A.id)).toBe(KEY);
  });

  test('no key keeps the stored one, null removes it', async () => {
    await postLabeller({ key: KEY, model: MODEL, dailyMax: 500 });
    expect((await postLabeller({ model: MODEL, dailyMax: 20 })).status).toBe(204);
    expect(((await (await get('/api/account')).json()) as AccountResponse).labeller).toEqual({
      keySet: true,
      model: MODEL,
      dailyMax: 20,
    });
    expect((await postLabeller({ key: null, model: MODEL, dailyMax: 20 })).status).toBe(204);
    expect(((await (await get('/api/account')).json()) as AccountResponse).labeller.keySet).toBe(false);
    expect(labellerAccounts(hosted.hosted.accounts)).toEqual([]);
  });

  test('stores a key trimmed of the spaces around it', async () => {
    expect((await postLabeller({ key: `  ${KEY} `, model: MODEL, dailyMax: 500 })).status).toBe(204);
    const [entry] = labellerAccounts(hosted.hosted.accounts);
    expect(openKey(SECRET, entry!.sealedKey, A.id)).toBe(KEY);
  });

  test('refuses another model, a daily max outside 1..10000 or a key that is not a string or is blank', async () => {
    for (const body of [
      { key: KEY, model: 'claude-opus-5-5', dailyMax: 10 },
      { key: KEY, model: MODEL, dailyMax: 0 },
      { key: KEY, model: MODEL, dailyMax: 10001 },
      { key: KEY, model: MODEL, dailyMax: 1.5 },
      { key: 7, model: MODEL, dailyMax: 10 },
      { key: '', model: MODEL, dailyMax: 10 },
      { key: '   ', model: MODEL, dailyMax: 10 },
      null,
    ]) {
      expect((await postLabeller(body)).status).toBe(400);
    }
    expect(labellerAccounts(hosted.hosted.accounts)).toEqual([]);
  });
});

describe('labelAccounts', () => {
  test("labels each account with a key in its own file, with its own key and model, and not one without", async () => {
    const a = imported(A.id);
    const b = imported(B.id);
    setLabeller(hosted.hosted.accounts, A.id, { key: KEY, model: MODEL, dailyMax: 500 }, SECRET);
    const { asked, clientFor } = stubFactory();
    await labelAccounts({ ...hosted.hosted, clientFor, now: () => NOW });
    expect(labelled(a)).toBeGreaterThan(0);
    expect(labelled(b)).toBe(0);
    expect(asked).toEqual([[MODEL, KEY]]);
  });

  test('skips an account whose key does not open, logging a fixed line, and still labels the others', async () => {
    const third = { id: 303, login: 'carol' };
    addInvite(hosted.hosted.accounts, third.login, NOW);
    signInAccount(hosted.hosted.accounts, third, 'admin', NOW);
    const a = imported(A.id);
    const c = imported(third.id);
    setLabeller(hosted.hosted.accounts, A.id, { key: KEY, model: MODEL, dailyMax: 500 }, SECRET);
    setLabeller(hosted.hosted.accounts, third.id, { key: 'sk-ant-third', model: MODEL, dailyMax: 500 }, SECRET);
    // A's key sealed under another secret: it doesn't open under this one.
    hosted.hosted.accounts.$client
      .prepare('update labeller_settings set sealed_key = ? where account_id = ?')
      .run(sealKey(Buffer.alloc(32, 9), KEY, A.id), A.id);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { asked, clientFor } = stubFactory();
    await labelAccounts({ ...hosted.hosted, clientFor, now: () => NOW });
    expect(error.mock.calls).toEqual([[`label: account ${A.id} key does not open`]]);
    error.mockRestore();
    expect(labelled(a)).toBe(0);
    expect(labelled(c)).toBeGreaterThan(0);
    expect(asked).toEqual([[MODEL, 'sk-ant-third']]);
  });
});

describe('labelAccounts, an account that fails', () => {
  test('is logged by its id only, and the later accounts are still labelled', async () => {
    const third = { id: 303, login: 'carol' };
    addInvite(hosted.hosted.accounts, third.login, NOW);
    signInAccount(hosted.hosted.accounts, third, 'admin', NOW);
    const c = imported(third.id);
    setLabeller(hosted.hosted.accounts, A.id, { key: KEY, model: MODEL, dailyMax: 500 }, SECRET);
    setLabeller(hosted.hosted.accounts, third.id, { key: 'sk-ant-third', model: MODEL, dailyMax: 500 }, SECRET);
    const files = {
      db(id: number) {
        if (id === A.id) throw new Error(`invented failure quoting ${KEY}`);
        return hosted.hosted.files.db(id);
      },
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { clientFor } = stubFactory();
    await labelAccounts({ ...hosted.hosted, files, clientFor, now: () => NOW });
    expect(error.mock.calls).toEqual([[`label: account ${A.id} failed`]]);
    error.mockRestore();
    expect(labelled(c)).toBeGreaterThan(0);
  });
});

describe('the labeller in the routes', () => {
  test('a stored export on /api/collect requests the label job; a refused one does not', async () => {
    const requestLabels = vi.fn();
    hosted.hosted.requestLabels = requestLabels;
    const post = (body: BodyInit) =>
      hosted.app.request('/api/collect', {
        method: 'POST',
        body,
        headers: { Host: PUBLIC_HOST, Authorization: `Bearer ${tokenA}` },
      });
    expect((await post(gzipSync('{"not": "an export"}'))).status).toBe(400);
    expect(requestLabels).not.toHaveBeenCalled();
    expect((await post(gzipSync(JSON.stringify(fixture('report-v5'))))).status).toBe(204);
    expect(requestLabels).toHaveBeenCalledTimes(1);
  });

  test("/api/findings shows the caller's labeller: on with its key, off without", async () => {
    imported(A.id);
    const findings = async () => ((await (await get('/api/findings')).json()) as FindingsResponse).labeller;
    expect((await findings()).on).toBe(false);
    expect((await findings()).waiting).toBe(0);
    setLabeller(hosted.hosted.accounts, A.id, { key: KEY, model: MODEL, dailyMax: 500 }, SECRET);
    expect((await findings()).on).toBe(true);
    expect((await findings()).waiting).toBeGreaterThan(0);
    // B has no key: off.
    setLabeller(hosted.hosted.accounts, B.id, { model: MODEL, dailyMax: 500 }, SECRET);
    const cookieB = `${SESSION}=${createSession(hosted.hosted.accounts, B.id, NOW)}`;
    expect((await findings()).on).toBe(true);
    expect(((await (await get('/api/findings', cookieB)).json()) as FindingsResponse).labeller.on).toBe(false);
    // B viewing A sees A's labeller.
    addViewer(hosted.hosted.accounts, A.id, B.login);
    expect(setViewing(hosted.hosted.accounts, cookieB.slice(SESSION.length + 1), A.id)).toBe(true);
    expect(((await (await get('/api/findings', cookieB)).json()) as FindingsResponse).labeller.on).toBe(true);
  });
});
