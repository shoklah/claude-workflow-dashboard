// The collector: on the machine where Claude Code runs, asks the hosted server for the account's cursor, runs the
// reporter and sends its export, gzipped, with the account's bearer token. It holds no database, and it logs only a
// step and a status: never a body, the server's URL or the token.
import { gzipSync } from 'node:zlib';
import type { Config } from './config.ts';
import { createQueue } from './queue.ts';
import { runReporter } from './reporter.ts';
import { startTriggers } from './triggers.ts';

// The longest error text a collector may record: the collector cuts to it and `/api/collect/failure` refuses past it.
export const COLLECT_MAX_ERROR = 2000;
const CONFLICT_LINE =
  'collect: export answered 409: another machine feeds this account (Reset collector on the Account page)';

/** Logs a step's thrown error by its name only, since its message can quote the URL. */
function logFailed(step: string, error: unknown): null {
  console.error(`collect: ${step} failed (${error instanceof Error ? error.name : typeof error})`);
  return null;
}

/** One request to the server, or null after logging its step and status (or its error's name). */
async function send(
  fetch: typeof globalThis.fetch,
  step: string,
  url: URL,
  init: RequestInit,
): Promise<Response | null> {
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    return logFailed(step, error);
  }
  if (response.ok) return response;
  console.error(response.status === 409 && step === 'export' ? CONFLICT_LINE : `collect: ${step} answered ${response.status}`);
  return null;
}

/**
 * Collects once: the account's cursor, the reporter run with `--changed-since` it (`0` when none), then the export or
 * the reporter's failure sent to the server. Resolves the time it started when the export was stored (a 204), else
 * null, so the next trigger retries.
 */
export async function collectOnce(opts: {
  config: Config;
  token: string;
  fetch?: typeof globalThis.fetch;
  now: () => Date;
}): Promise<Date | null> {
  const { config, token, fetch = globalThis.fetch } = opts;
  const at = opts.now();
  const server = config.server ?? '';
  const auth = { Authorization: `Bearer ${token}` };
  const cursorResponse = await send(fetch, 'cursor', new URL('/api/collect/cursor', server), { headers: auth });
  if (!cursorResponse) return null;
  let cursor: string | null;
  try {
    ({ cursor } = (await cursorResponse.json()) as { cursor: string | null });
  } catch (error) {
    return logFailed('cursor', error);
  }
  const command = [...config.reporterCommand, '--changed-since', cursor ?? '0'];
  const result = await runReporter(command, config.reporterTimeoutMs);
  if (!result.ok) {
    await send(fetch, 'failure', new URL('/api/collect/failure', server), {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: result.error.slice(0, COLLECT_MAX_ERROR) }),
    });
    return null;
  }
  const response = await send(fetch, 'export', new URL('/api/collect', server), {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' },
    body: gzipSync(JSON.stringify(result.json)),
  });
  return response?.status === 204 ? at : null;
}

/** Whether the token may go to `server`: https://, or http:// only to this machine. */
function safeServer(server: string): boolean {
  try {
    const url = new URL(server);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname));
  } catch {
    return false;
  }
}

/**
 * Starts the collector: collects at start and on each trigger, one at a time through the queue. Without a server, a
 * token or a safe server URL it logs a fixed line, sets the exit code to 1 and starts nothing.
 */
export function runCollector(config: Config, env: Record<string, string | undefined>): void {
  const token = env.EDWARD_TOKEN;
  const problem = !config.server
    ? 'collector: server is not set in the config'
    : !token
      ? "collector: EDWARD_TOKEN is not set in the data folder's .env"
      : !safeServer(config.server)
        ? 'collector: server must be an https:// URL (http:// only to localhost)'
        : null;
  if (problem || !token) {
    console.error(problem);
    process.exitCode = 1;
    return;
  }
  const now = () => new Date();
  let lastSent: Date | null = null;
  const queue = createQueue(async () => {
    lastSent = (await collectOnce({ config, token, now })) ?? lastSent;
  }, 'collect');
  // The last stored export, not the last attempt, so a failed one doesn't hold back the transcript timer.
  startTriggers(config, queue.request, () => lastSent);
  queue.request();
}
