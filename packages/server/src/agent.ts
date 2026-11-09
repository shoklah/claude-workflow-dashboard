// The launchd agent that keeps the dashboard running: `install` writes its plist to ~/Library/LaunchAgents and loads
// it, `uninstall` unloads it and deletes the file. Usage: `pnpm agent:install` or `pnpm agent:uninstall`.
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.ts';

const LABEL = 'com.shoklah.claude-workflow-dashboard';

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

if (import.meta.main) {
  const file = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
  const domain = `gui/${process.getuid?.()}`;
  const command = process.argv[2];
  if (command === 'install') {
    // No server bundle: node runs main.ts with its type stripping, as check:real does, with the node running install.
    const logDir = join(loadConfig().dataDir, 'logs');
    mkdirSync(logDir, { recursive: true, mode: 0o700 });
    mkdirSync(dirname(file), { recursive: true });
    const entry = fileURLToPath(new URL('./main.ts', import.meta.url));
    writeFileSync(file, plist({ label: LABEL, node: process.execPath, entry, logDir }));
    process.exitCode = spawnSync('launchctl', ['bootstrap', domain, file], { stdio: 'inherit' }).status ?? 1;
  } else if (command === 'uninstall') {
    // Not loaded is fine: launchctl says so, and the file goes either way.
    spawnSync('launchctl', ['bootout', `${domain}/${LABEL}`], { stdio: 'inherit' });
    rmSync(file, { force: true });
  } else {
    console.error('usage: agent.ts install | uninstall');
    process.exitCode = 1;
  }
}
