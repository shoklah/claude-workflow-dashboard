// The agent that keeps the dashboard running: on macOS a launchd agent (its plist in ~/Library/LaunchAgents), on Linux
// a systemd user unit (in ~/.config/systemd/user). `install` writes the file and starts it, `uninstall` stops it and
// deletes the file. Usage: `pnpm agent:install` or `pnpm agent:uninstall`.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platformDefaults } from './config.ts';

export const LABEL = 'com.shoklah.claude-workflow-dashboard';
export const UNIT = 'claude-workflow-dashboard.service';

const escape = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** The agent's plist: runs `node entry` at login and keeps it alive, logging into `logDir`. */
export function plist(opts: { label: string; node: string; entry: string; logDir: string }): string {
  const string = (text: string) => `<string>${escape(text)}</string>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  ${string(opts.label)}
  <key>ProgramArguments</key>
  <array>
    ${string(opts.node)}
    ${string(opts.entry)}
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  ${string(join(opts.logDir, 'out.log'))}
  <key>StandardErrorPath</key>
  ${string(join(opts.logDir, 'err.log'))}
</dict>
</plist>
`;
}

// systemd reads `%` as a specifier everywhere; a quoted value escapes `\` and `"`.
const percent = (text: string) => text.replace(/%/g, '%%');
const quoted = (text: string) => `"${percent(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/**
 * The user unit: runs `node entry` and restarts it always, every 10 s as launchd's throttle (systemd's 100 ms default
 * hits its start limit in half a second and leaves the unit failed), logging into `logDir`, with `dataHome` as
 * XDG_DATA_HOME.
 */
export function systemdUnit(opts: { node: string; entry: string; logDir: string; dataHome: string }): string {
  // In ExecStart, `$` starts a variable.
  const arg = (text: string) => quoted(text).replace(/\$/g, '$$$$');
  return `[Unit]
Description=edward

[Service]
ExecStart=${arg(opts.node)} ${arg(opts.entry)}
Environment=${quoted(`XDG_DATA_HOME=${opts.dataHome}`)}
Restart=always
RestartSec=10
StandardOutput=append:${percent(join(opts.logDir, 'out.log'))}
StandardError=append:${percent(join(opts.logDir, 'err.log'))}

[Install]
WantedBy=default.target
`;
}

export type AgentSpec = { file: string; contents: string; start: string[][]; stop: string[][]; removed: string[][] };

/**
 * The platform's agent: its file, contents, the commands that start and stop it, and those run once its file is
 * deleted; null where there is none.
 */
export function agentSpec(
  platform: NodeJS.Platform,
  opts: {
    home: string;
    env: Record<string, string | undefined>;
    uid: number | undefined;
    node: string;
    entry: string;
    logDir: string;
  },
): AgentSpec | null {
  const { node, entry, logDir } = opts;
  if (platform === 'darwin') {
    const file = join(opts.home, 'Library', 'LaunchAgents', `${LABEL}.plist`);
    const domain = `gui/${opts.uid}`;
    return {
      file,
      contents: plist({ label: LABEL, node, entry, logDir }),
      start: [['launchctl', 'bootstrap', domain, file]],
      stop: [['launchctl', 'bootout', `${domain}/${LABEL}`]],
      removed: [],
    };
  }
  if (platform === 'linux') {
    // The install's data home, always: the user manager's environment may differ from the install shell's.
    const dataHome = dirname(platformDefaults(platform, opts.env, opts.home).dataDir);
    return {
      file: join(opts.home, '.config', 'systemd', 'user', UNIT),
      contents: systemdUnit({ node, entry, logDir, dataHome }),
      start: [
        ['systemctl', '--user', 'daemon-reload'],
        ['systemctl', '--user', 'enable', UNIT],
        ['systemctl', '--user', 'restart', UNIT],
      ],
      stop: [['systemctl', '--user', 'disable', '--now', UNIT]],
      removed: [['systemctl', '--user', 'daemon-reload']],
    };
  }
  return null;
}

if (import.meta.main) {
  // No server bundle: node runs main.ts with its type stripping, as check:real does, with the node running install.
  const entry = fileURLToPath(new URL('./main.ts', import.meta.url));
  // The data dir is always the platform's default (config.json can't move it), so no command reads the config.
  const logDir = join(platformDefaults(process.platform, process.env, homedir()).dataDir, 'logs');
  const spec = agentSpec(process.platform, {
    home: homedir(),
    env: process.env,
    uid: process.getuid?.(),
    node: process.execPath,
    entry,
    logDir,
  });
  const command = process.argv[2];
  const run = ([cmd, ...args]: string[]) => {
    const { status, error } = spawnSync(cmd, args, { stdio: 'inherit' });
    // A command that can't start (no systemctl) says so, rather than a bare exit 1.
    if (error) console.error(`${cmd} could not run: ${error.message}`);
    return status ?? 1;
  };
  if (command !== 'install' && command !== 'uninstall') {
    console.error('usage: agent.ts install | uninstall');
    process.exitCode = 1;
  } else if (!spec) {
    console.error(`agent:${command} supports macOS and Linux (Windows: use WSL)`);
    process.exitCode = 1;
  } else if (command === 'install') {
    const { file, contents, start } = spec;
    mkdirSync(logDir, { recursive: true, mode: 0o700 });
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, contents);
    let status = 0;
    for (const step of start) {
      status = run(step);
      if (status !== 0) break;
    }
    process.exitCode = status;
  } else {
    // Not loaded is fine: launchctl or systemctl says so, and the file goes either way.
    for (const step of spec.stop) run(step);
    rmSync(spec.file, { force: true });
    for (const step of spec.removed) run(step);
  }
}
