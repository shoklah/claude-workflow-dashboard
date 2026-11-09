import { spawn } from 'node:child_process';
import { loadReport } from '@cwd/shared';
import type { Config } from './config.ts';
import type { Db } from './db/open.ts';
import { importReport, recordImportFailure } from './db/import.ts';

export type ReporterResult = { ok: true; json: unknown } | { ok: false; error: string };

/**
 * Runs the reporter and parses its whole output as JSON. Every failure is a result, never a throw: a command that
 * can't start, a non-zero exit (with stderr's last line), no output, output that isn't JSON, or a run past the timeout,
 * which is killed. The error text never quotes stdout, which holds the data.
 */
export function runReporter(cmd: string[], timeoutMs: number): Promise<ReporterResult> {
  return new Promise((resolve) => {
    const [command, ...args] = cmd;
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    const timer = setTimeout(() => {
      child.kill();
      resolve({ ok: false, error: `reporter took longer than ${timeoutMs} ms and was stopped` });
    }, timeoutMs);
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve({ ok: false, error: `reporter command failed to start (${error.code}): ${command}` });
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        const last = stderr.trim().split('\n').at(-1) ?? '';
        resolve({ ok: false, error: `reporter exited with ${code ?? signal}${last ? `: ${last}` : ''}` });
        return;
      }
      const text = stdout.trim();
      if (!text) {
        resolve({ ok: false, error: 'reporter printed no JSON' });
        return;
      }
      try {
        resolve({ ok: true, json: JSON.parse(text) });
      } catch {
        resolve({ ok: false, error: 'reporter output is not JSON' });
      }
    });
  });
}

/** Runs the reporter once and imports its report, or records the failure with its error text. */
export async function importOnce(db: Db, config: Config, now: () => Date): Promise<void> {
  const result = await runReporter(config.reporterCommand, config.reporterTimeoutMs);
  if (!result.ok) return recordImportFailure(db, result.error, now());
  const loaded = loadReport(result.json);
  if (!loaded.ok) {
    const error =
      loaded.reason === 'version' ? 'report version is not 1' : `report fields don't match: ${loaded.fields.join(', ')}`;
    return recordImportFailure(db, error, now());
  }
  const { runs, sessions, totals } = result.json as { runs: unknown[]; sessions: unknown[]; totals: unknown };
  importReport(db, loaded.report, { runs, sessions, totals }, now());
}
