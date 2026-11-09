import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { fixture, fixturePath } from '../../shared/test/fixture.ts';

const SCRIPT = fileURLToPath(new URL('../src/check-real.ts', import.meta.url));

const dirs: string[] = [];

/** Runs check:real against a temp data dir whose config.json sets the reporter command. */
function checkReal(reporterCommand: string[]): { stdout: string; stderr: string; status: number | null } {
  const dir = mkdtempSync(join(tmpdir(), 'cwd check real '));
  dirs.push(dir);
  const dataDir = join(dir, 'data dir');
  mkdirSync(dataDir);
  writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ reporterCommand }));
  const result = spawnSync(process.execPath, [SCRIPT, dataDir], { encoding: 'utf8' });
  return { stdout: result.stdout, stderr: result.stderr, status: result.status };
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('check:real', () => {
  test('prints version, fields and key counts only', () => {
    const { stdout, status } = checkReal(['cat', fixturePath('report-full')]);
    expect(stdout).toBe('version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\n');
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
    expect(checkReal(['cat', file]).stdout).toBe('version: 1\nfields: none\nrun keys: 1 duplicates, 1 missing\n');
  });

  test("a failing reporter's stderr is never printed", () => {
    const branch = fixture('report-full').runs[0].record.branch;
    const { stdout, stderr, status } = checkReal([process.execPath, '-e', `console.error(${JSON.stringify(branch)}); process.exit(1)`]);
    expect(`${stdout}${stderr}`).not.toContain(branch);
    expect(stderr).toBe('reporter exited with 1\n');
    expect(status).toBe(1);
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
