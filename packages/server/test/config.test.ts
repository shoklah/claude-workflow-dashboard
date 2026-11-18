import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { loadConfig, platformDefaults } from '../src/config.ts';

const HOME = process.env.HOME;
const XDG_DATA_HOME = process.env.XDG_DATA_HOME;
const dirs: string[] = [];

/** A fresh temp folder whose path holds a space. */
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cwd config '));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  process.env.HOME = HOME;
  if (XDG_DATA_HOME === undefined) delete process.env.XDG_DATA_HOME;
  else process.env.XDG_DATA_HOME = XDG_DATA_HOME;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  test('defaults expand the home folder', () => {
    // HOME points at a temp folder, so the defaults are computed (and the data dir created) there, never in the real home.
    // XDG_DATA_HOME is cleared too, so on Linux the data dir lands in the temp home as well.
    const home = tempDir();
    process.env.HOME = home;
    delete process.env.XDG_DATA_HOME;
    const { dataDir, python } = platformDefaults(process.platform, process.env, home);
    expect(dataDir.startsWith(home)).toBe(true);
    expect(loadConfig()).toEqual({
      dataDir,
      port: 4317,
      reporterCommand: [python, '-I', join(home, '.claude', 'scripts', 'workflow-report.py'), '--json'],
      runLog: join(home, '.claude', 'workflow-log.jsonl'),
      projectsDir: join(home, '.claude', 'projects'),
      reporterTimeoutMs: 120000,
      aliases: {},
    });
  });

  test('config.json overrides a default', () => {
    const dataDir = join(tempDir(), 'data dir');
    mkdirSync(dataDir);
    writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ port: 5000, reporterCommand: ['cat', '/x y.json'] }));
    const config = loadConfig(dataDir);
    expect(config.port).toBe(5000);
    expect(config.reporterCommand).toEqual(['cat', '/x y.json']);
    expect(config.dataDir).toBe(dataDir);
    expect(config.reporterTimeoutMs).toBe(120000);
  });

  test("aliases that aren't an object mean none", () => {
    const dataDir = join(tempDir(), 'data dir');
    mkdirSync(dataDir);
    for (const aliases of [null, 'Notes app', 3]) {
      writeFileSync(join(dataDir, 'config.json'), JSON.stringify({ aliases }));
      expect(loadConfig(dataDir).aliases).toEqual({});
    }
  });

  test('the data dir is created with mode 0700', () => {
    const dataDir = join(tempDir(), 'data dir');
    loadConfig(dataDir);
    expect(statSync(dataDir).mode & 0o777).toBe(0o700);
  });
});

describe('platformDefaults', () => {
  test('macOS keeps Application Support and /usr/bin/python3', () => {
    expect(platformDefaults('darwin', {}, '/h')).toEqual({
      dataDir: join('/h', 'Library', 'Application Support', 'claude-workflow-dashboard'),
      python: '/usr/bin/python3',
    });
  });

  test('Linux uses XDG_DATA_HOME and python3', () => {
    expect(platformDefaults('linux', { XDG_DATA_HOME: '/xdg' }, '/h')).toEqual({
      dataDir: join('/xdg', 'claude-workflow-dashboard'),
      python: 'python3',
    });
  });

  test('Linux falls back to ~/.local/share when XDG_DATA_HOME is unset or empty', () => {
    for (const XDG_DATA_HOME of [undefined, '']) {
      expect(platformDefaults('linux', { XDG_DATA_HOME }, '/h').dataDir).toBe(
        join('/h', '.local', 'share', 'claude-workflow-dashboard'),
      );
    }
  });

  test('Linux ignores a relative XDG_DATA_HOME, as the XDG spec says', () => {
    expect(platformDefaults('linux', { XDG_DATA_HOME: 'data' }, '/h').dataDir).toBe(
      join('/h', '.local', 'share', 'claude-workflow-dashboard'),
    );
  });
  test('any other platform takes the Linux defaults', () => {
    expect(platformDefaults('freebsd', {}, '/h')).toEqual(platformDefaults('linux', {}, '/h'));
  });
});
