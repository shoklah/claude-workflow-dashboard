import { appendFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Config } from '../src/config.ts';
import { startTriggers } from '../src/triggers.ts';

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const IMPORTED = new Date('2026-11-10T18:00:00Z');

const dirs: string[] = [];
const stops: (() => void)[] = [];

/** A config whose run log and projects folder sit in a fresh temp folder whose path holds a space. */
function tempConfig(): Config {
  const dir = mkdtempSync(join(tmpdir(), 'cwd triggers '));
  dirs.push(dir);
  return {
    dataDir: join(dir, 'data dir'),
    port: 4317,
    reporterCommand: ['cat'],
    runLog: join(dir, 'claude dir', 'workflow-log.jsonl'),
    projectsDir: join(dir, 'claude dir', 'projects'),
    reporterTimeoutMs: 1000,
  };
}

function start(config: Config, lastImportAt: () => Date | null = () => IMPORTED) {
  const request = vi.fn();
  const triggers = startTriggers(config, request, lastImportAt);
  stops.push(() => triggers.stop());
  return request;
}

/** Writes a transcript under the projects folder with the given modification time. */
function transcript(config: Config, name: string, mtime: Date): void {
  const dir = join(config.projectsDir, '-Users-example-Work-lantern notes');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, name);
  writeFileSync(file, '{}\n');
  utimesSync(file, mtime, mtime);
}

afterEach(() => {
  vi.useRealTimers();
  for (const stop of stops.splice(0)) stop();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('startTriggers', () => {
  test('a change to the run log requests an import', async () => {
    const config = tempConfig();
    mkdirSync(join(config.runLog, '..'));
    writeFileSync(config.runLog, '{}\n');
    const request = start(config);
    appendFileSync(config.runLog, '{}\n');
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
  });

  test('replacing the run log file requests an import', async () => {
    const config = tempConfig();
    mkdirSync(join(config.runLog, '..'));
    writeFileSync(config.runLog, '{}\n');
    const request = start(config);
    const next = join(config.runLog, '..', 'next log.tmp');
    writeFileSync(next, '{}\n{}\n');
    renameSync(next, config.runLog);
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
  });

  test("a change to another file in the run log's folder doesn't request", async () => {
    const config = tempConfig();
    mkdirSync(join(config.runLog, '..'));
    const request = start(config);
    writeFileSync(join(config.runLog, '..', 'other.json'), '{}');
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(request).not.toHaveBeenCalled();
  });

  test('the timer requests when a transcript changed after the last import', () => {
    vi.useFakeTimers();
    const config = tempConfig();
    transcript(config, 'a1b2.jsonl', new Date(IMPORTED.getTime() - 60_000));
    transcript(config, 'c3d4.jsonl', new Date(IMPORTED.getTime() + 60_000));
    const request = start(config);
    vi.advanceTimersByTime(FIFTEEN_MINUTES - 1);
    expect(request).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('the timer stays quiet when nothing changed', () => {
    vi.useFakeTimers();
    const config = tempConfig();
    transcript(config, 'a1b2.jsonl', new Date(IMPORTED.getTime() - 60_000));
    transcript(config, 'notes.txt', new Date(IMPORTED.getTime() + 60_000));
    const request = start(config);
    vi.advanceTimersByTime(3 * FIFTEEN_MINUTES);
    expect(request).not.toHaveBeenCalled();
  });

  test("missing folders don't throw", () => {
    vi.useFakeTimers();
    const config = tempConfig();
    const request = start(config);
    expect(() => vi.advanceTimersByTime(FIFTEEN_MINUTES)).not.toThrow();
    expect(request).not.toHaveBeenCalled();
  });
});
