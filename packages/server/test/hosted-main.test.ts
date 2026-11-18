import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { createApp, type AppDeps } from '../src/app.ts';
import { addInvite, createSession, signInAccount } from '../src/hosted/accounts.ts';
import { githubClient } from '../src/hosted/github.ts';
import { hostedDeps, hostedSettings } from '../src/hosted/main.ts';

const SET = {
  EDWARD_PUBLIC_HOST: 'edward.example',
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  EDWARD_ADMIN: 'rowan-k',
};
const NOW = new Date('2026-11-12T12:00:00Z');

describe('hostedSettings', () => {
  test('names every missing variable, and only its name', () => {
    expect(() => hostedSettings({})).toThrow(
      new Error(
        "hosted mode needs EDWARD_PUBLIC_HOST, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, EDWARD_ADMIN in the data folder's .env",
      ),
    );
    const { GITHUB_CLIENT_ID, ...rest } = SET;
    expect(() => hostedSettings({ ...rest, GITHUB_CLIENT_ID: '' })).toThrow(
      new Error("hosted mode needs GITHUB_CLIENT_ID in the data folder's .env"),
    );
  });

  test('returns the four settings when all are set', () => {
    expect(hostedSettings(SET)).toEqual({
      publicHost: 'edward.example',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      admin: 'rowan-k',
    });
  });
});

describe('hostedDeps', () => {
  let dir: string;
  let deps: ReturnType<typeof hostedDeps>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'cwd hosted main '));
    const webDist = join(dir, 'web dist');
    mkdirSync(webDist);
    writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>edward</title>');
    deps = hostedDeps({
      dataDir: join(dir, 'data'),
      port: 0,
      publicHost: SET.EDWARD_PUBLIC_HOST,
      origin: `https://${SET.EDWARD_PUBLIC_HOST}`,
      admin: SET.EDWARD_ADMIN,
      github: githubClient({ clientId: SET.GITHUB_CLIENT_ID, clientSecret: SET.GITHUB_CLIENT_SECRET }),
      webDist,
      now: () => NOW,
    });
  });

  afterEach(() => {
    deps.hosted.files.close();
    deps.hosted.accounts.$client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const get = (path: string, headers: Record<string, string> = {}) =>
    Promise.resolve(createApp(deps).request(path, { headers: { Host: SET.EDWARD_PUBLIC_HOST, ...headers } }));

  test('builds hosted mode: no aliases, no labeller, no local database, its accounts database in the folder', () => {
    expect(deps.aliases).toEqual({});
    expect(deps.labeller).toBeNull();
    expect(deps.db).toBeNull();
    expect(deps.requestImport).toBeNull();
    expect(deps.importing()).toBe(false);
    expect(existsSync(join(dir, 'data', 'accounts.sqlite'))).toBe(true);
  });

  test("answers by hosted mode's rules", async () => {
    expect((await get('/api/home')).status).toBe(401);
    expect((await get('/signin')).status).toBe(200);
    expect((await get('/signin', { Host: 'localhost:4317' })).status).toBe(403);
    const accounts = deps.hosted.accounts;
    addInvite(accounts, 'alice', NOW);
    signInAccount(accounts, { id: 101, login: 'alice' }, SET.EDWARD_ADMIN, NOW);
    const cookie = `edward_session=${createSession(accounts, 101, NOW)}`;
    expect((await get('/api/refresh', { Cookie: cookie })).status).toBe(404);
  });
});
