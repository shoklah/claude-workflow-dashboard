import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { fixture } from '../../shared/test/fixture.ts';
import type { Config } from '../src/config.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { lastGoodImport, lastImport, listUnits } from '../src/db/read.ts';
import { importOnce, runReporter } from '../src/reporter.ts';

const FIXTURES = fileURLToPath(new URL('../../shared/fixtures/', import.meta.url));
const AT = new Date('2026-11-10T18:00:00Z');
const TIMEOUT = 10_000;

const dirs: string[] = [];
const dbs: Db[] = [];

/** A fresh temp folder whose path holds a space. */
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cwd reporter '));
  dirs.push(dir);
  return dir;
}

/** A reporter command that runs a small Node script. */
function nodeScript(code: string): string[] {
  return [process.execPath, '-e', code];
}

afterEach(() => {
  for (const db of dbs.splice(0)) db.$client.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('runReporter', () => {
  test('returns the parsed JSON', async () => {
    const result = await runReporter(['cat', join(FIXTURES, 'report-full.json')], TIMEOUT);
    expect(result).toEqual({ ok: true, json: fixture('report-full') });
  });

  test('a fixture path with a space works', async () => {
    const file = join(tempDir(), 'report full.json');
    copyFileSync(join(FIXTURES, 'report-full.json'), file);
    const result = await runReporter(['cat', file], TIMEOUT);
    expect(result).toEqual({ ok: true, json: fixture('report-full') });
  });

  test('a missing reporter command is an error naming it', async () => {
    const command = join(tempDir(), 'no such reporter');
    const result = await runReporter([command, '--json'], TIMEOUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain(command);
    expect(result.error).toContain('ENOENT');
  });

  test("a non-zero exit is an error with its stderr's last line", async () => {
    const result = await runReporter(
      nodeScript('console.error("first line"); console.error("the last line"); process.exit(3)'),
      TIMEOUT,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('3');
    expect(result.error).toContain('the last line');
    expect(result.error).not.toContain('first line');
  });

  test('exit 0 with empty output is an error "reporter printed no JSON"', async () => {
    expect(await runReporter(nodeScript('process.stdout.write("  \\n")'), TIMEOUT)).toEqual({
      ok: false,
      error: 'reporter printed no JSON',
    });
  });

  test('text before the JSON is an error', async () => {
    const result = await runReporter(nodeScript('console.log("warming up"); console.log("{\\"version\\": 1}")'), TIMEOUT);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not JSON/);
    expect(result.error).not.toContain('warming up');
  });

  test('a reporter past the timeout is killed and reported', async () => {
    const started = Date.now();
    const result = await runReporter(nodeScript('setTimeout(() => console.log("{}"), 5000)'), 200);
    expect(Date.now() - started).toBeLessThan(3000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('200 ms');
  });
});

describe('importOnce', () => {
  function setup(reporterCommand: string[]): { db: Db; config: Config } {
    const dataDir = join(tempDir(), 'data dir');
    const db = openDb(join(dataDir, 'dashboard.sqlite'));
    dbs.push(db);
    const config: Config = {
      dataDir,
      port: 4317,
      reporterCommand,
      runLog: join(dataDir, 'workflow-log.jsonl'),
      projectsDir: join(dataDir, 'projects'),
      reporterTimeoutMs: TIMEOUT,
    };
    return { db, config };
  }

  test('imports the report', async () => {
    const { db, config } = setup(['cat', join(FIXTURES, 'report-full.json')]);
    await importOnce(db, config, () => AT);
    expect(lastGoodImport(db)).toEqual({ at: AT, totals: fixture('report-full').totals });
    expect(listUnits(db, 'run')).toHaveLength(5);
  });

  test("a reporter error is recorded with its text", async () => {
    const command = join(tempDir(), 'no such reporter');
    const { db, config } = setup([command]);
    await importOnce(db, config, () => AT);
    const last = lastImport(db);
    expect(last).toMatchObject({ at: AT, ok: false });
    expect(last?.error).toContain(command);
    expect(lastGoodImport(db)).toBeNull();
  });

  test('an empty output is a failed import, never an empty one', async () => {
    const { db, config } = setup(nodeScript(''));
    await importOnce(db, config, () => AT);
    expect(lastImport(db)).toEqual({ at: AT, ok: false, error: 'reporter printed no JSON' });
    expect(listUnits(db, 'run')).toEqual([]);
  });

  test("a bad shape is recorded with its field paths", async () => {
    const { db, config } = setup(['cat', join(FIXTURES, 'report-shape.json')]);
    await importOnce(db, config, () => AT);
    const last = lastImport(db);
    expect(last).toMatchObject({ at: AT, ok: false });
    expect(last?.error).toContain('runs[].steps');
  });
});
