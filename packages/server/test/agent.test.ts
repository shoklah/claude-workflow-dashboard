import { describe, expect, test } from 'vitest';
import { plist } from '../src/agent.ts';

// Invented paths: plist() is pure, so no test writes to ~/Library/LaunchAgents or runs launchctl.
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
