import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test } from 'vitest';
import { fixture, fixturePath } from '../../shared/test/fixture.ts';

const SCRIPT = fileURLToPath(new URL('../src/check-real.ts', import.meta.url));

const dirs: string[] = [];

const LANTERN = '/Users/example/Work/lantern-notes';

// An export from the old reporter, as report-full, has no totals but its weeks.
const OLD_TOTALS = ['run time', 'steps', 'rules', 'skills', 'models', 'units']
  .map((name) => `${name}: not in the export\n`)
  .join('');

/** Writes a changed copy of a fixture to a temp file and returns its path. */
function changed(name: string, change: (raw: any) => void): string {
  const raw = fixture(name);
  change(raw);
  const dir = mkdtempSync(join(tmpdir(), 'cwd check real '));
  dirs.push(dir);
  const file = join(dir, `${name}.json`);
  writeFileSync(file, JSON.stringify(raw));
  return file;
}

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
    expect(stdout).toBe(`version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\nreporter keys: not in the export\nweeks: 4 compared, 0 differ\n${OLD_TOTALS}showing: pass\n`);
    expect(status).toBe(0);
  });

  test("compares the new pages' sums with the reporter's totals and checks their routes", () => {
    const { stdout, stderr, status } = checkReal(['cat', fixturePath('report-v5')]);
    expect(stdout).toBe(
      'version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\nreporter keys: not in the export\nweeks: 4 compared, 0 differ\n' +
        'run time: compared, 0 differ\nsteps: 7 compared, 0 differ\nrules: 0 differ\nskills: 6 compared, 0 differ\n' +
        'models: 0 differ\nunits: 0 differ\nshowing: pass\n',
    );
    for (const line of `${stdout}${stderr}`.split('\n')) expect(line).not.toContain('/Users/');
    expect(status).toBe(0);
  });

  test('names the differing weeks, groups, step kinds and rules, and counts the skills and models only', () => {
    const file = changed('report-v5', (raw) => {
      const { totals } = raw;
      totals.weeks.find((w: { week: string }) => w.week === '2026-10-18').tasks += 1;
      totals.run_time.with_waves.timed += 1;
      totals.scoreboard.task_review.outcomes.fixed += 1;
      totals.scoreboard.final_review.cost += 0.01;
      totals.scoreboard.stop_rule.stops += 1;
      totals.offers.graphify.accepted += 1;
      totals.skills['test-driven-development'].runs += 1;
      totals.models.agents['plan-reviewer'].actual['claude-fable-5-1/high'] += 1;
      totals.models.main.small.actual = {};
      // A skill required but never loaded, as skill_totals counts it, which no unit of report-v5 misses: compared too.
      totals.skills['grill-me'] = { runs: 0, last: null, outcomes: {}, missing: 1 };
    });
    const { stdout, stderr } = checkReal(['cat', file]);
    expect(stdout).toBe(
      'version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\nreporter keys: not in the export\nweeks: 4 compared, 1 differ\n2026-10-18\n' +
        'run time: compared, 1 differ\nwith_waves\nsteps: 7 compared, 2 differ\ntask_review\nfinal_review\n' +
        'rules: 2 differ\nstop_rule\noffers\nskills: 7 compared, 2 differ\nmodels: 2 differ\nunits: 0 differ\nshowing: pass\n',
    );
    // A skill or agent name can come from a project, so neither is printed.
    for (const name of ['test-driven-development', 'plan-reviewer', 'graphify', 'grill-me']) {
      expect(`${stdout}${stderr}`).not.toContain(name);
    }
  });

  test("compares the units' sums and skills' missing with the reporter's totals and checks the sessions route", () => {
    const { stdout, stderr, status } = checkReal(['cat', fixturePath('report-v6')]);
    expect(stdout).toBe(
      'version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\nreporter keys: 12 compared, 0 differ\nweeks: 4 compared, 0 differ\n' +
        'run time: compared, 0 differ\nsteps: 7 compared, 0 differ\nrules: 0 differ\nskills: 8 compared, 0 differ\n' +
        'models: 0 differ\nunits: 0 differ\nshowing: pass\n',
    );
    for (const line of `${stdout}${stderr}`.split('\n')) expect(line).not.toContain('/Users/');
    expect(status).toBe(0);
  });

  test("names the differing unit sums, counts a skill's differing missing, and allows a share 0.01 points off", () => {
    const file = changed('report-v6', (raw) => {
      const { totals } = raw;
      totals.scoreboard.dispatch_guard.no_model += 1;
      totals.scoreboard.startup.without += 1;
      totals.advisor.by_role['task-reviewer'].flagged = false;
      totals.skills['grill-me'].missing += 1;
      // Under 0.01 points off: the reporter's share is a float sum.
      totals.scoreboard.advisor.share += 0.004;
    });
    const { stdout, stderr } = checkReal(['cat', file]);
    expect(stdout).toBe(
      'version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\nreporter keys: 12 compared, 0 differ\nweeks: 4 compared, 0 differ\n' +
        'run time: compared, 0 differ\nsteps: 7 compared, 0 differ\nrules: 0 differ\nskills: 8 compared, 1 differ\n' +
        'models: 0 differ\nunits: 3 differ\ndispatch_guard\nstartup\nadvisor\nshowing: pass\n',
    );
    for (const name of ['grill-me', 'task-reviewer', 'no_model']) expect(`${stdout}${stderr}`).not.toContain(name);
  });

  test("the advisor's share differs from 0.01 points off", () => {
    const file = changed('report-v6', (raw) => {
      raw.totals.scoreboard.advisor.share += 0.01;
    });
    expect(checkReal(['cat', file]).stdout).toContain('units: 1 differ\nadvisor\n');
  });

  test('counts reporter keys that differ', () => {
    const file = changed('report-v6', (raw) => {
      raw.runs[0].key = '0000000000000000';
      raw.sessions[0].key = '0000000000000000';
    });
    const { stdout, stderr } = checkReal(['cat', file]);
    expect(stdout).toContain('\nreporter keys: 12 compared, 2 differ\n');
    expect(`${stdout}${stderr}`).not.toContain('0000000000000000');
  });

  test('leaves a keyed run with no app key out of the reporter keys, counted as a missing run key', () => {
    const file = changed('report-v6', (raw) => {
      delete raw.runs.find((run: { key?: string }) => run.key).record.date;
    });
    const { stdout } = checkReal(['cat', file]);
    expect(stdout).toContain('\nrun keys: 0 duplicates, 1 missing\nreporter keys: 11 compared, 0 differ\n');
  });

  test('counts the leaks in the sessions route', () => {
    // The shown project (the first root, Work lantern-notes) aliased as the hidden tidepool-api leaks in every response
    // naming it, the sessions route's too while it lists the project's sessions, and in no response with them left out
    // of every period (no start), since only the sessions route names a session's project.
    const aliases = { [LANTERN]: 'tidepool-api' };
    const leakCount = (file: string) => {
      const { stdout, stderr } = checkReal(['cat', file], { aliases });
      expect(`${stdout}${stderr}`).not.toContain('tidepool-api');
      return Number(/^showing: (\d+) leaks \(0 inside words\)$/m.exec(stdout)![1]);
    };
    const unlisted = changed('report-v6', (raw) => {
      for (const s of raw.sessions) if (s.project?.startsWith(LANTERN)) s.start = null;
    });
    expect(leakCount(fixturePath('report-v6'))).toBe(leakCount(unlisted) + 1);
  });

  test('counts the leaks found only inside words apart, still failing, never printing a value', () => {
    // A hidden session folder named app is inside response keys and words (appDiffers, "applied") as a whole word nowhere.
    const file = changed('report-v6', (raw) => {
      raw.sessions.find((s: { project?: string }) => s.project === '/Users/example/Scratch/lantern').project =
        '/Users/example/Work/app';
    });
    const { stdout, stderr, status } = checkReal(['cat', file]);
    const [, leakCount, inside] = /^showing: (\d+) leaks \((\d+) inside words\)$/m.exec(stdout) ?? [];
    expect(Number(inside)).toBeGreaterThan(0);
    expect(Number(inside)).toBe(Number(leakCount));
    for (const value of ['/Users/', 'app']) expect(`${stdout}${stderr}`).not.toContain(value);
    expect(status).toBe(1);
  });

  test('prints field paths for a bad shape', () => {
    const { stdout, status } = checkReal(['cat', fixturePath('report-shape')]);
    expect(stdout).toBe('version: 1\nruns[].steps\nrun keys: 0 duplicates, 0 missing\nreporter keys: not in the export\n');
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
      `version: 1\nfields: none\nrun keys: 1 duplicates, 1 missing\nreporter keys: not in the export\nweeks: 4 compared, 2 differ\n2026-10-04\n2026-10-18\n${OLD_TOTALS}showing: pass\n`,
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
    expect(stdout).toBe(`version: 1\nfields: none\nrun keys: 0 duplicates, 0 missing\nreporter keys: not in the export\nweeks: 4 compared, 1 differ\n2026-11-01\n${OLD_TOTALS}showing: pass\n`);
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
    expect(stdout).toMatch(/^showing: [1-9]\d* leaks \(0 inside words\)$/m);
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
    expect(stdout).toMatch(/^showing: [1-9]\d* leaks \(0 inside words\)$/m);
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
    const names = ['report-full', 'report-shape', 'report-v5'];
    const values = new Set<string>();
    for (const run of names.flatMap((name) => fixture(name).runs ?? [])) {
      if (run.record?.project) values.add(run.record.project);
      if (run.record?.branch) values.add(run.record.branch);
    }
    expect(values.size).toBeGreaterThan(0);
    for (const name of names) {
      const { stdout, stderr } = checkReal(['cat', fixturePath(name)]);
      for (const line of `${stdout}${stderr}`.split('\n')) {
        for (const value of values) expect(line).not.toContain(value);
      }
    }
  });
});
