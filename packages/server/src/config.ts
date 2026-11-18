import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export type Config = {
  dataDir: string;
  port: number;
  reporterCommand: string[];
  runLog: string;
  projectsDir: string;
  reporterTimeoutMs: number;
  // Showing mode's display names, by project root path.
  aliases: Record<string, string>;
  // `local` serves the dashboard; `collector` sends the reporter's export to `server`; `hosted` serves accounts.
  mode: 'local' | 'collector' | 'hosted';
  server: string | null;
};

// The data folder's name keeps the project's first name, on every platform.
const DATA_FOLDER = 'claude-workflow-dashboard';

/**
 * The platform's default data dir and reporter python: on macOS `~/Library/Application Support/<folder>` and
 * `/usr/bin/python3`, elsewhere `$XDG_DATA_HOME/<folder>` (`~/.local/share/<folder>` when unset, empty or relative) and `python3`.
 */
export function platformDefaults(
  platform: NodeJS.Platform,
  env: Record<string, string | undefined>,
  home: string,
): { dataDir: string; python: string } {
  if (platform === 'darwin') {
    return { dataDir: join(home, 'Library', 'Application Support', DATA_FOLDER), python: '/usr/bin/python3' };
  }
  // The XDG spec ignores a relative (or empty) XDG_DATA_HOME.
  const dataHome = env.XDG_DATA_HOME && isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : join(home, '.local', 'share');
  return { dataDir: join(dataHome, DATA_FOLDER), python: 'python3' };
}

/**
 * The config: the defaults, overridden by `<dataDir>/<file>` (`config.json` by default) when it exists, with aliases that aren't an object
 * read as none. The data dir (by default `platformDefaults`') is created with mode 0700, since the data is personal.
 */
export function loadConfig(dataDir?: string, file = 'config.json'): Config {
  const home = homedir();
  const fallback = platformDefaults(process.platform, process.env, home);
  dataDir ??= fallback.dataDir;
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const claude = join(home, '.claude');
  const defaults: Config = {
    dataDir,
    port: 4317,
    reporterCommand: [fallback.python, '-I', join(claude, 'scripts', 'workflow-report.py'), '--json'],
    runLog: join(claude, 'workflow-log.jsonl'),
    projectsDir: join(claude, 'projects'),
    reporterTimeoutMs: 120_000,
    aliases: {},
    mode: 'local',
    server: null,
  };
  const path = join(dataDir, file);
  const overrides = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Partial<Config>) : {};
  const config = { ...defaults, ...overrides, dataDir };
  // Aliases that aren't an object would make every showing-mode view throw.
  if (typeof config.aliases !== 'object' || config.aliases === null) config.aliases = {};
  return config;
}
