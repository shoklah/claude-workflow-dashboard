import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fixture, fixturePath } from '../../shared/test/fixture.ts';
import { collectOnce, runCollector } from '../src/collector.ts';
import type { Config } from '../src/config.ts';

const AT = new Date('2026-11-18T09:00:00Z');
const TOKEN = 'edw_test-token-0123456789';
const SERVER = 'https://edward.example.com';
const CONFLICT_LINE = 'collect: export answered 409: another machine feeds this account (Reset collector on the Account page)';

const dirs: string[] = [];
let logs: string[];

/** A fresh temp folder whose path holds a space. */
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cwd collector '));
  dirs.push(dir);
  return dir;
}

function configWith(overrides: Partial<Config> = {}): Config {
  const dir = tempDir();
  return {
    dataDir: dir,
    port: 4317,
    // The reporter stand-in ignores the extra `--changed-since` arguments.
    reporterCommand: ['sh', '-c', 'cat "$0"', fixturePath('report-work')],
    // Missing folders, so no trigger watches anything.
    runLog: join(dir, 'missing', 'workflow-log.jsonl'),
    projectsDir: join(dir, 'missing', 'projects'),
    reporterTimeoutMs: 10_000,
    aliases: {},
    mode: 'collector',
    server: SERVER,
    ...overrides,
  };
}

type Sent = { url: string; method: string; headers: Headers; body: unknown };

/** A stub `fetch` that records each request and answers by path: the cursor `cursor`, the others `status`. */
function stubFetch(answers: { cursor?: string | null; export?: number; failure?: number } = {}) {
  const sent: Sent[] = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    sent.push({ url, method: init?.method ?? 'GET', headers: new Headers(init?.headers), body: init?.body });
    const path = new URL(url).pathname;
    if (path === '/api/collect/cursor') return Response.json({ cursor: answers.cursor ?? null });
    if (path === '/api/collect') return new Response(null, { status: answers.export ?? 204 });
    if (path === '/api/collect/failure') return new Response(null, { status: answers.failure ?? 204 });
    return new Response('not found', { status: 404 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, sent };
}

beforeEach(() => {
  logs = [];
  const record = (...args: unknown[]) => void logs.push(args.map(String).join(' '));
  vi.spyOn(console, 'log').mockImplementation(record);
  vi.spyOn(console, 'error').mockImplementation(record);
  vi.spyOn(console, 'warn').mockImplementation(record);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('collectOnce', () => {
  test('the export is sent gzipped, with the bearer token on every request, and resolves the start time', async () => {
    const { fetch, sent } = stubFetch();
    const at = await collectOnce({ config: configWith(), token: TOKEN, fetch, now: () => AT });
    expect(at).toEqual(AT);
    expect(sent.map((r) => `${r.method} ${r.url}`)).toEqual([
      `GET ${SERVER}/api/collect/cursor`,
      `POST ${SERVER}/api/collect`,
    ]);
    for (const request of sent) expect(request.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    const post = sent[1];
    expect(post.headers.get('content-encoding')).toBe('gzip');
    expect(post.headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(gunzipSync(post.body as Uint8Array).toString('utf8'))).toEqual(fixture('report-work'));
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  test("the reporter gets the cursor the server answers, else 0", async () => {
    const dir = tempDir();
    const args = join(dir, 'args.txt');
    // A stand-in that writes its arguments to a file, then prints the export.
    const script = `printf '%s\\n' "$@" > "${args}"; cat "${fixturePath('report-work')}"`;
    const config = configWith({ reporterCommand: ['sh', '-c', script, 'reporter', '--json'] });

    await collectOnce({ config, token: TOKEN, fetch: stubFetch({ cursor: 'state-a:3' }).fetch, now: () => AT });
    expect(readFileSync(args, 'utf8').trim().split('\n')).toEqual(['--json', '--changed-since', 'state-a:3']);

    await collectOnce({ config, token: TOKEN, fetch: stubFetch({ cursor: null }).fetch, now: () => AT });
    expect(readFileSync(args, 'utf8').trim().split('\n')).toEqual(['--json', '--changed-since', '0']);
  });

  test("a failed reporter is sent to the failure endpoint, and resolves null", async () => {
    const { fetch, sent } = stubFetch();
    const config = configWith({ reporterCommand: ['sh', '-c', 'echo "the last line" >&2; exit 1'] });
    expect(await collectOnce({ config, token: TOKEN, fetch, now: () => AT })).toBeNull();
    expect(sent.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      'GET /api/collect/cursor',
      'POST /api/collect/failure',
    ]);
    const failure = sent[1];
    expect(failure.headers.get('authorization')).toBe(`Bearer ${TOKEN}`);
    expect(failure.headers.get('content-type')).toBe('application/json');
    const { error } = JSON.parse(String(failure.body)) as { error: string };
    expect(error.startsWith('reporter exited with 1')).toBe(true);
  });

  test('a long reporter error is cut to the 2000 characters the server takes', async () => {
    const { fetch, sent } = stubFetch();
    const config = configWith({ reporterCommand: ['sh', '-c', `printf '%0${3000}d' 0 >&2; exit 1`] });
    await collectOnce({ config, token: TOKEN, fetch, now: () => AT });
    const { error } = JSON.parse(String(sent[1].body)) as { error: string };
    expect(error.length).toBe(2000);
  });

  test('a 409 on the export logs the fixed line, and resolves null', async () => {
    const { fetch } = stubFetch({ export: 409 });
    expect(await collectOnce({ config: configWith(), token: TOKEN, fetch, now: () => AT })).toBeNull();
    expect(logs).toEqual([CONFLICT_LINE]);
  });

  test('a non-2xx answer logs its step and status only', async () => {
    const { fetch } = stubFetch({ export: 413 });
    expect(await collectOnce({ config: configWith(), token: TOKEN, fetch, now: () => AT })).toBeNull();
    expect(logs).toEqual(['collect: export answered 413']);
  });

  test('a fetch that rejects logs the step and the error name', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError(`fetch failed for ${SERVER} with ${TOKEN}`);
    }) as unknown as typeof globalThis.fetch;
    expect(await collectOnce({ config: configWith(), token: TOKEN, fetch, now: () => AT })).toBeNull();
    expect(logs).toEqual(['collect: cursor failed (TypeError)']);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });
});

describe('runCollector', () => {
  const EXIT_CODE = process.exitCode;

  afterEach(() => {
    process.exitCode = EXIT_CODE;
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  test('with no EDWARD_TOKEN it logs what is missing and sets the exit code', () => {
    const { fetch } = stubFetch();
    vi.stubGlobal('fetch', fetch);
    runCollector(configWith(), {});
    expect(logs).toEqual(["collector: EDWARD_TOKEN is not set in the data folder's .env"]);
    expect(process.exitCode).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('with no server it logs what is missing and sets the exit code', () => {
    const { fetch } = stubFetch();
    vi.stubGlobal('fetch', fetch);
    runCollector(configWith({ server: null }), { EDWARD_TOKEN: TOKEN });
    expect(logs).toEqual(['collector: server is not set in the config']);
    expect(process.exitCode).toBe(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  test('a plain http:// server off this machine is refused', () => {
    const { fetch } = stubFetch();
    vi.stubGlobal('fetch', fetch);
    for (const server of ['http://edward.example.com', 'http://localhost.example.com', 'not a url']) {
      logs.length = 0;
      process.exitCode = undefined;
      runCollector(configWith({ server }), { EDWARD_TOKEN: TOKEN });
      expect(logs).toEqual(['collector: server must be an https:// URL (http:// only to localhost)']);
      expect(process.exitCode).toBe(1);
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  test('an https:// server, or http:// to this machine, starts with one request', async () => {
    // Fake intervals, so the transcript timer never runs; the run log's folder is missing, so nothing is watched.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    for (const server of ['https://edward.example.com', 'http://localhost:4317', 'http://127.0.0.1:8080']) {
      const fetch = vi.fn(async () => {
        throw new TypeError('offline');
      });
      vi.stubGlobal('fetch', fetch);
      logs.length = 0;
      runCollector(configWith({ server }), { EDWARD_TOKEN: TOKEN });
      await vi.waitFor(() => expect(logs).toEqual(['collect: cursor failed (TypeError)']));
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(String((fetch.mock.calls[0] as unknown[])[0])).toBe(`${server}/api/collect/cursor`);
      expect(process.exitCode).toBe(EXIT_CODE);
    }
  });
});
