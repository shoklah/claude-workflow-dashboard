import { spawn } from 'node:child_process';
import { loadReport } from '@cwd/shared';
import type { Config } from './config.ts';
import type { Db } from './db/open.ts';
import { importReport, recordImportFailure } from './db/import.ts';

// On failure, `summary` is a fixed message for the kind of failure (no command, no stderr); `error` adds the command or
// stderr's last line, which may hold a path or session ID.
export type ReporterResult = { ok: true; json: unknown } | { ok: false; summary: string; error: string };

function failure(summary: string, detail = ''): ReporterResult {
  return { ok: false, summary, error: detail ? `${summary}: ${detail}` : summary };
}

/**
 * Runs the reporter, with the env but `ANTHROPIC_API_KEY`, and parses its whole output as JSON. Every failure is a
 * result, never a throw: a command that can't start, a non-zero exit (with stderr's last line), no output, output that
 * isn't JSON, or a run past the timeout, which is killed. The error text never quotes stdout, which holds the data.
 */
export function runReporter(cmd: string[], timeoutMs: number): Promise<ReporterResult> {
  return new Promise((resolve) => {
    const [command, ...args] = cmd;
    // The labeller's key, which main.ts loads into process.env, stays out of the reporter's env.
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding('utf8').on('data', (chunk: string) => (stderr += chunk));
    const timer = setTimeout(() => {
      child.kill();
      resolve(failure(`reporter took longer than ${timeoutMs} ms and was stopped`));
    }, timeoutMs);
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      resolve(failure(`reporter command failed to start (${error.code})`, command));
    });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (code !== 0) {
        const last = stderr.trim().split('\n').at(-1) ?? '';
        resolve(failure(`reporter exited with ${code ?? signal}`, last));
        return;
      }
      const text = stdout.trim();
      if (!text) {
        resolve(failure('reporter printed no JSON'));
        return;
      }
      try {
        resolve({ ok: true, json: JSON.parse(text) });
      } catch {
        resolve(failure('reporter output is not JSON'));
      }
    });
  });
}

/**
 * Runs the reporter once and imports its report, or records the failure with its error text, a throw included (an
 * empty command, a locked database). The import is timed before the reporter runs, so a transcript that changes
 * during the run is still newer than the import.
 */
export async function importOnce(db: Db, config: Config, now: () => Date): Promise<void> {
  const at = now();
  try {
    const result = await runReporter(config.reporterCommand, config.reporterTimeoutMs);
    if (!result.ok) return recordImportFailure(db, result.error, at);
    const loaded = loadReport(result.json);
    if (!loaded.ok) {
      const error =
        loaded.reason === 'version' ? 'report version is not 1' : `report fields don't match: ${loaded.fields.join(', ')}`;
      return recordImportFailure(db, error, at);
    }
    const { runs, sessions, totals } = result.json as { runs: unknown[]; sessions: unknown[]; totals: unknown };
    importReport(db, loaded.report, { runs, sessions, totals }, at);
  } catch (error) {
    recordImportFailure(db, `import failed: ${error instanceof Error ? error.message : String(error)}`, at);
  }
}
