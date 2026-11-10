import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { fixture, fixturePath } from '../../shared/test/fixture.ts';

const SCRIPT = fileURLToPath(new URL('../src/check-real.ts', import.meta.url));

const dirs: string[] = [];

/**
 * Runs check:real against a temp data dir whose config.json sets the reporter command and any other config, with its
 * own temp folder (TMPDIR) and any other env, and returns what is left in both.
 */
function checkReal(
  reporterCommand: string[],
  config: Record<string, unknown> = {},
  env: Record<string, string> = {},
): { stdout: string; stderr: string; status: number | null; dataDir: string[]; tmp: string[] } {
  const dir = mkdtempSync(join(tmpdir(), 'cwd check real '));
  dirs.push(dir);
  const dataDir = join(dir, 'data dir');
  const tmp = join(dir, 'tmp');
  mkdirSync(dataDir);
  mkdirSync(tmp);
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ ...config, reporterCommand }));
  const result = spawnSync(process.execPath, [SCRIPT, dataDir], {
    encoding: 'utf8',
    env: { ...process.env, TMPDIR: tmp, ...env },
  });
  const { stdout, stderr, status } = result;
  return { stdout, stderr, status, dataDir: readdirSync(dataDir), tmp: readdirSync(tmp) };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('check:real', () => {
  test('prints version, fields and key counts only', () => {
    const { stdout, status } = checkReal(['cat', fixturePath('report-full')]);
    expect(stdout).toBe('version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\nweeks: 4 compared, 0 differ\nshowing: pass\n');
    expect(status).toBe(0);
  });

  test('prints field paths for a bad shape', () => {
    const { stdout, status } = checkReal(['cat', fixturePath('report-shape')]);
    expect(stdout).toBe('version: 1\nruns[].steps\nrun keys: 0 duplicates, 0 missing\n');
    expect(status).toBe(1);
  });

  test('counts duplicate and missing run keys', () => {
    const report = fixture('report-full');
    report.runs.push(structuredClone(report.runs[0]));
    delete report.runs[1].record.date;
    const dir = mkdtempSync(join(tmpdir(), 'cwd check real '));
    dirs.push(dir);
    const file = join(dir, 'report keys.json');
    writeFileSync(file, JSON.stringify(report));
    // The extra run and the one with no date also change their weeks' sums.
    expect(checkReal(['cat', file]).stdout).toBe(
      'version: 1\nfields: none\nrun keys: 1 duplicates, 1 missing\nweeks: 4 compared, 2 differ\n2026-10-04\n2026-10-18\nshowing: pass\n',
    );
  });

  test('check:real reports a differing week', () => {
    const report = fixture('report-full');
    const week = report.totals.weeks.find((w: { week: string }) => w.week === '2026-11-01');
    week.cost += 0.01;
    const dir = mkdtempSync(join(tmpdir(), 'cwd check real '));
    dirs.push(dir);
    const file = join(dir, 'report weeks.json');
    writeFileSync(file, JSON.stringify(report));
    const { stdout, status } = checkReal(['cat', file]);
    expect(stdout).toBe('version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\nweeks: 4 compared, 1 differ\n2026-11-01\nshowing: pass\n');
    expect(status).toBe(0);
  });

  test("a failing reporter's stderr is never printed", () => {
    const branch = fixture('report-full').runs[0].record.branch;
    const { stdout, stderr, status } = checkReal([process.execPath, '-e', `console.error(${JSON.stringify(branch)}); process.exit(1)`]);
    expect(`${stdout}${stderr}`).not.toContain(branch);
    expect(stderr).toBe('reporter exited with 1\n');
    expect(status).toBe(1);
  });

  test('checks showing mode on a fresh temp database, printing no path', () => {
    const { stdout, stderr, status, dataDir, tmp } = checkReal(['cat', fixturePath('report-projects')]);
    expect(stdout.split('\n')).toContain('showing: pass');
    for (const line of `${stdout}${stderr}`.split('\n')) expect(line).not.toContain('/Users/');
    expect(status).toBe(0);
    // No database in the data dir, and the temp folder is gone.
    expect(dataDir).toEqual(['config.json']);
    expect(tmp).toEqual([]);
  });

  test('counts the leaks, never printing a leaked value', () => {
    // The shown project (the first root, Archive lantern-notes) aliased as the hidden tidepool-api.
    const aliases = { '/Users/example/Archive/lantern-notes': 'tidepool-api' };
    const { stdout, stderr, status, tmp } = checkReal(['cat', fixturePath('report-projects')], { aliases });
    expect(stdout).toMatch(/^showing: [1-9]\d* leaks$/m);
    expect(`${stdout}${stderr}`).not.toContain('tidepool-api');
    expect(status).toBe(1);
    expect(tmp).toEqual([]);
  });

  test('counts a path under the home folder as a leak', () => {
    // With the fixture's /Users/example as home, no response holds a path under it.
    const home = { HOME: '/Users/example' };
    expect(checkReal(['cat', fixturePath('report-projects')], {}, home).stdout).toMatch(/^showing: pass$/m);
    // The shown project's alias, a path under home, is in every shown run's name.
    const aliases = { '/Users/example/Archive/lantern-notes': '/Users/example/notes' };
    const { stdout, status } = checkReal(['cat', fixturePath('report-projects')], { aliases }, home);
    expect(stdout).toMatch(/^showing: [1-9]\d* leaks$/m);
    expect(status).toBe(1);
  });

  test("a failing showing check's error text is never printed", () => {
    // A port holding a newline and a root makes the request's Host header throw a TypeError that quotes it.
    const port = '1\n/Users/example/Archive/lantern-notes';
    const { stdout, stderr, status, tmp } = checkReal(['cat', fixturePath('report-projects')], { port });
    expect(`${stdout}${stderr}`).not.toContain('/Users/');
    expect(stderr).toBe('showing: the check failed\n');
    expect(status).toBe(1);
    expect(tmp).toEqual([]);
  });

  test('never prints a value', () => {
    const values = new Set<string>();
    for (const run of fixture('report-full').runs) {
      if (run.record?.project) values.add(run.record.project);
      if (run.record?.branch) values.add(run.record.branch);
    }
    expect(values.size).toBeGreaterThan(0);
    for (const name of ['report-full', 'report-shape']) {
      const { stdout, stderr } = checkReal(['cat', fixturePath(name)]);
      for (const line of `${stdout}${stderr}`.split('\n')) {
        for (const value of values) expect(line).not.toContain(value);
      }
    }
  });
});
