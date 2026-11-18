import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { agentSpec, LABEL, plist, systemdUnit, UNIT } from '../src/agent.ts';

// Invented paths: plist(), systemdUnit() and agentSpec() are pure, so no test writes outside a temp folder or runs
// launchctl or systemctl.
const opts = {
  label: 'com.example.dashboard',
  node: '/opt/node/bin/node',
  entry: '/repo/packages/server/src/main.ts',
  logDir: '/data/logs',
};

/** The element right after `<key>name</key>`, whitespace removed. */
function valueOf(xml: string, name: string): string | undefined {
  const match = xml.replace(/>\s+</g, '><').match(new RegExp(`<key>${name}</key>(<(\\w+)\\s*/>|<(\\w+)>.*?</\\3>)`));
  return match?.[1];
}

describe('plist', () => {
  test('the plist runs node on the src entry', () => {
    const xml = plist(opts);
    expect(valueOf(xml, 'Label')).toBe('<string>com.example.dashboard</string>');
    expect(valueOf(xml, 'ProgramArguments')).toBe(
      '<array><string>/opt/node/bin/node</string><string>/repo/packages/server/src/main.ts</string></array>',
    );
  });

  test('the plist sets RunAtLoad and KeepAlive', () => {
    const xml = plist(opts);
    expect(valueOf(xml, 'RunAtLoad')).toBe('<true/>');
    expect(valueOf(xml, 'KeepAlive')).toBe('<true/>');
  });

  test('the plist logs into the data dir', () => {
    const xml = plist(opts);
    expect(valueOf(xml, 'StandardOutPath')).toBe('<string>/data/logs/out.log</string>');
    expect(valueOf(xml, 'StandardErrorPath')).toBe('<string>/data/logs/err.log</string>');
  });

  test('the plist escapes a path with spaces and ampersands', () => {
    const dir = '/Users/x/Library/Application Support & co <1>';
    const xml = plist({ ...opts, entry: `${dir}/main.ts`, logDir: `${dir}/logs` });
    expect(valueOf(xml, 'ProgramArguments')).toContain(
      '<string>/Users/x/Library/Application Support &amp; co &lt;1&gt;/main.ts</string>',
    );
    // Valid XML: every & starts an entity, and no < or > is left in a value.
    expect(xml).not.toMatch(/&(?!(amp|lt|gt|quot|apos);)/);
    expect(xml).not.toContain('co <1>');
  });
});

describe('systemdUnit', () => {
  test('runs node on the entry, restarts always, and logs into the data dir', () => {
    const unit = systemdUnit({ node: '/opt/node/bin/node', entry: '/repo/src/main.ts', logDir: '/data/logs' });
    expect(unit).toContain('ExecStart="/opt/node/bin/node" "/repo/src/main.ts"\n');
    expect(unit).toContain('Restart=always\nRestartSec=10\n');
    expect(unit).toContain('StandardOutput=append:/data/logs/out.log\n');
    expect(unit).toContain('StandardError=append:/data/logs/err.log\n');
    expect(unit).toContain('[Install]\nWantedBy=default.target\n');
  });
  test('quotes and escapes a path with spaces, %, $, " and \\', () => {
    const unit = systemdUnit({ node: '/n/node', entry: '/My Projects/100% $HOME "x"\\y/main.ts', logDir: '/d 100%/logs' });
    expect(unit).toContain('ExecStart="/n/node" "/My Projects/100%% $$HOME \\"x\\"\\\\y/main.ts"\n');
    expect(unit).toContain('StandardOutput=append:/d 100%%/logs/out.log\n');
  });
  test("carries the install shell's XDG_DATA_HOME, and none without it", () => {
    const base = { node: '/n/node', entry: '/r/main.ts', logDir: '/d/logs' };
    expect(systemdUnit({ ...base, dataHome: '/x data' })).toContain('Environment="XDG_DATA_HOME=/x data"\n');
    expect(systemdUnit(base)).not.toContain('Environment=');
  });
});

describe('agentSpec', () => {
  const opts = { home: '/h', env: {}, uid: 501, node: '/n/node', entry: '/r/main.ts', logDir: '/d/logs' };
  test('macOS writes the plist to LaunchAgents and bootstraps it in the gui domain', () => {
    const spec = agentSpec('darwin', opts)!;
    expect(spec.file).toBe(join('/h', 'Library', 'LaunchAgents', `${LABEL}.plist`));
    expect(spec.contents).toBe(plist({ label: LABEL, node: '/n/node', entry: '/r/main.ts', logDir: '/d/logs' }));
    expect(spec.start).toEqual([['launchctl', 'bootstrap', 'gui/501', spec.file]]);
    expect(spec.stop).toEqual([['launchctl', 'bootout', `gui/501/${LABEL}`]]);
    expect(spec.removed).toEqual([]);
  });
  test('Linux writes a user unit under ~/.config, then reloads, enables and restarts it', () => {
    const spec = agentSpec('linux', { ...opts, env: { XDG_DATA_HOME: '/x' } })!;
    expect(spec.file).toBe(join('/h', '.config', 'systemd', 'user', UNIT));
    expect(spec.contents).toBe(systemdUnit({ node: '/n/node', entry: '/r/main.ts', logDir: '/d/logs', dataHome: '/x' }));
    // The unit always pins the data home the install used, so a different one in the user manager can't move it.
    for (const XDG_DATA_HOME of [undefined, '', 'relative']) {
      expect(agentSpec('linux', { ...opts, env: { XDG_DATA_HOME } })!.contents).toContain(
        `Environment="XDG_DATA_HOME=${join('/h', '.local', 'share')}"\n`,
      );
    }
    expect(spec.start).toEqual([
      ['systemctl', '--user', 'daemon-reload'],
      ['systemctl', '--user', 'enable', UNIT],
      ['systemctl', '--user', 'restart', UNIT],
    ]);
    expect(spec.stop).toEqual([['systemctl', '--user', 'disable', '--now', UNIT]]);
    expect(spec.removed).toEqual([['systemctl', '--user', 'daemon-reload']]);
  });
  test('any other platform has no agent', () => {
    expect(agentSpec('win32', opts)).toBeNull();
    expect(agentSpec('freebsd', opts)).toBeNull();
  });
});
