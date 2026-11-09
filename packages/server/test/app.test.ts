import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { loadReport, type StatusResponse } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { createApp, type AppDeps } from '../src/app.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { importReport, recordImportFailure } from '../src/db/import.ts';
import { getSeenAt, setSeenAt } from '../src/db/read.ts';

const PORT = 4317;
const HOST = `localhost:${PORT}`;
const NOW = new Date('2026-11-12T12:00:00Z');

let dir: string;
let db: Db;
let webDist: string;
let imports: number;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cwd app '));
  db = openDb(join(dir, 'data dir', 'dashboard.sqlite'));
  webDist = join(dir, 'web dist');
  mkdirSync(webDist);
  writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>dashboard</title>');
  writeFileSync(join(webDist, 'app.js'), 'console.log("app");');
  imports = 0;
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

function app(overrides: Partial<AppDeps> = {}) {
  return createApp({
    db,
    port: PORT,
    requestImport: () => imports++,
    importing: () => false,
    webDist,
    now: () => NOW,
    aliases: {},
    labeller: null,
    ...overrides,
  });
}

function send(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return app().request(path, { ...init, headers: { Host: HOST, ...init.headers } });
}

const refresh = { method: 'POST', headers: { 'X-Dashboard-Refresh': '1' } };

function accessControlHeaders(res: Response): string[] {
  return [...res.headers.keys()].filter((name) => name.toLowerCase().startsWith('access-control-'));
}

describe('the Host check', () => {
  test('allows Host localhost:4317', async () => {
    expect((await send('/api/status', { headers: { Host: 'localhost:4317' } })).status).toBe(200);
  });

  test('allows Host 127.0.0.1:4317', async () => {
    expect((await send('/api/status', { headers: { Host: '127.0.0.1:4317' } })).status).toBe(200);
  });

  test('refuses Host evil.example', async () => {
    expect((await send('/api/status', { headers: { Host: 'evil.example' } })).status).toBe(403);
  });

  test('refuses Host localhost:9999', async () => {
    expect((await send('/api/status', { headers: { Host: 'localhost:9999' } })).status).toBe(403);
  });

  test('refuses a request with no Host', async () => {
    const request = new Request(`http://${HOST}/api/status`);
    expect(request.headers.get('host')).toBeNull();
    expect((await app().request(request)).status).toBe(403);
  });

  test('refuses a bad Host on a built file, the index fallback and a 404', async () => {
    for (const path of ['/app.js', '/runs/some-run', '/api/nope']) {
      expect((await send(path, { headers: { Host: 'evil.example' } })).status).toBe(403);
    }
  });

  test('refuses a bad Host on refresh, and queues no import', async () => {
    const res = await send('/api/refresh', { ...refresh, headers: { ...refresh.headers, Host: 'evil.example' } });
    expect(res.status).toBe(403);
    expect(imports).toBe(0);
  });
});

describe('CORS', () => {
  test('sends no Access-Control header', async () => {
    const preflight = {
      method: 'OPTIONS',
      headers: { Origin: 'http://evil.example', 'Access-Control-Request-Method': 'POST' },
    };
    const responses = [
      await send('/api/status', { headers: { Origin: 'http://evil.example' } }),
      await send('/api/refresh', preflight),
      await send('/api/status', { headers: { Host: 'evil.example' } }),
    ];
    expect(responses.map((res) => res.status)).toContain(403);
    for (const res of responses) expect(accessControlHeaders(res)).toEqual([]);
  });
});

describe('refresh', () => {
  test('refresh without its header is refused', async () => {
    expect((await send('/api/refresh', { method: 'POST' })).status).toBe(403);
    expect((await send('/api/refresh', { method: 'POST', headers: { 'X-Dashboard-Refresh': '0' } })).status).toBe(403);
    expect(imports).toBe(0);
  });

  test('refresh with a foreign Origin is refused', async () => {
    for (const origin of ['http://evil.example', 'http://localhost:9999', 'https://localhost:4317', 'null']) {
      const res = await send('/api/refresh', { ...refresh, headers: { ...refresh.headers, Origin: origin } });
      expect(res.status).toBe(403);
    }
    expect(imports).toBe(0);
  });

  test('refresh with its header queues an import', async () => {
    const res = await send('/api/refresh', refresh);
    expect(res.status).toBe(202);
    expect(imports).toBe(1);
  });

  test('refresh with its header and an allowed Origin queues an import', async () => {
    for (const origin of ['http://localhost:4317', 'http://127.0.0.1:4317']) {
      const res = await send('/api/refresh', { ...refresh, headers: { ...refresh.headers, Origin: origin } });
      expect(res.status).toBe(202);
    }
    expect(imports).toBe(2);
  });

  test('GET on refresh is not allowed', async () => {
    const res = await send('/api/refresh');
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
    expect(imports).toBe(0);
  });
});

describe('status', () => {
  async function status(deps: Partial<AppDeps> = {}): Promise<StatusResponse> {
    const res = await app(deps).request('/api/status', { headers: { Host: HOST } });
    expect(res.status).toBe(200);
    return res.json();
  }

  test('status before any import', async () => {
    expect(await status()).toEqual({ lastImportAt: null, lastGoodImportAt: null, error: null, importing: false });
  });

  test('status reports the last good import and whether one runs', async () => {
    const raw = fixture('report-full');
    const loaded = loadReport(JSON.parse(JSON.stringify(raw)));
    if (!loaded.ok) throw new Error('fixture report-full does not load');
    importReport(db, loaded.report, raw, new Date('2026-11-12T10:00:00Z'));
    expect(await status({ importing: () => true })).toEqual({
      lastImportAt: '2026-11-12T10:00:00.000Z',
      lastGoodImportAt: '2026-11-12T10:00:00.000Z',
      error: null,
      importing: true,
    });
  });

  test('status reports the last failure', async () => {
    recordImportFailure(db, 'reporter printed no JSON', new Date('2026-11-12T11:00:00Z'));
    expect(await status()).toEqual({
      lastImportAt: '2026-11-12T11:00:00.000Z',
      lastGoodImportAt: null,
      error: 'reporter printed no JSON',
      importing: false,
    });
  });

  test('status shows each absolute path in the error as its last segment', async () => {
    const stored =
      'reporter command failed to start (ENOENT): /Users/x/Application Support/foo/workflow-report.py; ' +
      "python3: can't open file '/opt/some dir/bin/python3': [Errno 2]";
    recordImportFailure(db, stored, NOW);
    expect((await status()).error).toBe(
      "reporter command failed to start (ENOENT): workflow-report.py; python3: can't open file 'python3': [Errno 2]",
    );
  });

  test('status cuts paths one after another, and leaves a word with a slash', async () => {
    recordImportFailure(db, 'reporter exited with 2: and/or usage: /usr/bin/python3 /Users/x/a b/report.py', NOW);
    expect((await status()).error).toBe('reporter exited with 2: and/or usage: python3 report.py');
  });
});

describe('seen', () => {
  test('seen sets the seen time', async () => {
    setSeenAt(db, new Date('2026-11-10T00:00:00Z'));
    const res = await send('/api/seen', refresh);
    expect(res.status).toBe(204);
    expect(getSeenAt(db)).toEqual(NOW);
  });

  test('seen without its header is refused', async () => {
    expect((await send('/api/seen', { method: 'POST' })).status).toBe(403);
    const foreign = { ...refresh, headers: { ...refresh.headers, Origin: 'http://evil.example' } };
    expect((await send('/api/seen', foreign)).status).toBe(403);
    expect(getSeenAt(db)).toBeNull();
  });

  test('GET on seen is not allowed', async () => {
    expect((await send('/api/seen')).status).toBe(405);
  });
});

describe('the built frontend', () => {
  test('serves a built file', async () => {
    const res = await send('/app.js');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('console.log("app");');
  });

  test('serves index.html for an unknown non-api path', async () => {
    const res = await send('/runs/some-run');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>dashboard</title>');
  });

  test('an unknown api path is a 404, not index.html', async () => {
    expect((await send('/api/nope')).status).toBe(404);
  });

  test('without a built frontend, an unknown path is a 404', async () => {
    const res = await app({ webDist: null }).request('/runs/some-run', { headers: { Host: HOST } });
    expect(res.status).toBe(404);
  });
});
