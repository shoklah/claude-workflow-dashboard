import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { fixture, fixturePath } from '../../shared/test/fixture.ts';
import type { Config } from '../src/config.ts';
import { openDb, type Db } from '../src/db/open.ts';
import { lastGoodImport, lastImport, listUnits } from '../src/db/read.ts';
import { importOnce, runReporter } from '../src/reporter.ts';

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
    const result = await runReporter(['cat', fixturePath('report-full')], TIMEOUT);
    expect(result).toEqual({ ok: true, json: fixture('report-full') });
  });

  test('a fixture path with a space works', async () => {
    const file = join(tempDir(), 'report full.json');
    copyFileSync(fixturePath('report-full'), file);
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
    expect(result.summary).toBe('reporter command failed to start (ENOENT)');
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
    expect(result.summary).toBe('reporter exited with 3');
  });

  test("the reporter runs without the labeller's API key in its env", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
    try {
      const script = nodeScript('console.log(JSON.stringify("ANTHROPIC_API_KEY" in process.env))');
      expect(await runReporter(script, TIMEOUT)).toEqual({ ok: true, json: false });
    } finally {
      if (key === undefined) delete process.env.ANTHROPIC_API_KEY;
      else process.env.ANTHROPIC_API_KEY = key;
    }
  });

  test('exit 0 with empty output is an error "reporter printed no JSON"', async () => {
    expect(await runReporter(nodeScript('process.stdout.write("  \\n")'), TIMEOUT)).toEqual({
      ok: false,
      summary: 'reporter printed no JSON',
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
      aliases: {},
    };
    return { db, config };
  }

  test('imports the report', async () => {
    const { db, config } = setup(['cat', fixturePath('report-full')]);
    await importOnce(db, config, () => AT);
    expect(lastGoodImport(db)).toEqual({ at: AT, totals: fixture('report-full').totals, categories: null });
    expect(listUnits(db, 'run')).toHaveLength(5);
  });

  test('the import is timed before the reporter runs', async () => {
    // The reporter leaves a marker before printing, so a time taken after it ran would be LATER.
    const marker = join(tempDir(), 'reporter ran');
    const { db, config } = setup(['sh', '-c', 'touch "$1" && cat "$0"', fixturePath('report-full'), marker]);
    const LATER = new Date(AT.getTime() + 60_000);
    await importOnce(db, config, () => (existsSync(marker) ? LATER : AT));
    expect(lastGoodImport(db)?.at).toEqual(AT);
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
    const { db, config } = setup(['cat', fixturePath('report-shape')]);
    await importOnce(db, config, () => AT);
    const last = lastImport(db);
    expect(last).toMatchObject({ at: AT, ok: false });
    expect(last?.error).toContain('runs[].steps');
  });

  test('a store that throws during the import is a recorded failure', async () => {
    const { db, config } = setup(['cat', fixturePath('report-full')]);
    // Any write of a unit fails, as with SQLITE_BUSY when the database is open elsewhere; the failure row still writes.
    db.$client.exec(
      "CREATE TRIGGER fail_import BEFORE INSERT ON unit_versions BEGIN SELECT RAISE(ABORT, 'database is locked'); END",
    );
    await importOnce(db, config, () => AT);
    expect(lastImport(db)).toEqual({ at: AT, ok: false, error: 'import failed: database is locked' });
    expect(listUnits(db, 'run')).toEqual([]);
  });

  test('an empty reporter command is a recorded failure', async () => {
    const { db, config } = setup([]);
    await importOnce(db, config, () => AT);
    const last = lastImport(db);
    expect(last).toMatchObject({ at: AT, ok: false });
    expect(last?.error).toMatch(/^import failed: /);
  });
});
