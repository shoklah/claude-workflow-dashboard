import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { loadConfig } from '../src/config.ts';

const HOME = process.env.HOME;
const dirs: string[] = [];

/** A fresh temp folder whose path holds a space. */
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'cwd config '));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  process.env.HOME = HOME;
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('loadConfig', () => {
  test('defaults expand the home folder', () => {
    // HOME points at a temp folder, so the defaults are computed (and the data dir created) there, never in the real home.
    const home = tempDir();
    process.env.HOME = home;
    expect(loadConfig()).toEqual({
      dataDir: join(home, 'Library', 'Application Support', 'claude-workflow-dashboard'),
      port: 4317,
      reporterCommand: ['/usr/bin/python3', '-I', join(home, '.claude', 'scripts', 'workflow-report.py'), '--json'],
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
