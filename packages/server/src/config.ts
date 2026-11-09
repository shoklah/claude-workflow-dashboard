import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Config = {
  dataDir: string;
  port: number;
  reporterCommand: string[];
  runLog: string;
  projectsDir: string;
  reporterTimeoutMs: number;
};

/**
 * The config: the defaults, overridden by `<dataDir>/config.json` when it exists. The data dir (by default
 * `~/Library/Application Support/claude-workflow-dashboard`) is created with mode 0700, since the data is personal.
 */
export function loadConfig(dataDir = join(homedir(), 'Library', 'Application Support', 'claude-workflow-dashboard')): Config {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const claude = join(homedir(), '.claude');
  const defaults: Config = {
    dataDir,
    port: 4317,
    reporterCommand: ['/usr/bin/python3', '-I', join(claude, 'scripts', 'workflow-report.py'), '--json'],
    runLog: join(claude, 'workflow-log.jsonl'),
    projectsDir: join(claude, 'projects'),
    reporterTimeoutMs: 120_000,
  };
  const file = join(dataDir, 'config.json');
  const overrides = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Partial<Config>) : {};
  return { ...defaults, ...overrides, dataDir };
}
