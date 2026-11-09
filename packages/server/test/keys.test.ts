import { describe, expect, test } from 'vitest';
import { loadReport, type Report } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { runKey, sessionKey } from '../src/keys.ts';

function report(): Report {
  const result = loadReport(fixture('report-full'));
  if (!result.ok) throw new Error('the full fixture does not load');
  return result.report;
}

describe('runKey', () => {
  test('runKey is 16 hex characters', () => {
    for (const run of report().runs) expect(runKey(run)).toMatch(/^[0-9a-f]{16}$/);
  });

  test('runKey differs when the branch differs', () => {
    const run = report().runs[0];
    const other = { ...run, record: { ...run.record, branch: 'another-branch' } };
    expect(runKey(other)).not.toBe(runKey(run));
  });

  test('runKey holds no path', () => {
    for (const run of report().runs) {
      const key = runKey(run)!;
      expect(key).not.toContain('/');
      for (const part of (run.record?.project ?? '').split('/').filter(Boolean)) expect(key).not.toContain(part);
    }
  });

  test('runKey is null without a date', () => {
    const run = report().runs[0];
    expect(runKey({ ...run, record: { ...run.record, date: undefined } })).toBeNull();
  });
});

describe('sessionKey', () => {
  test('sessionKey hashes the file', () => {
    const [first, second] = report().sessions;
    expect(sessionKey(first)).toMatch(/^[0-9a-f]{16}$/);
    expect(sessionKey(first)).not.toBe(sessionKey(second));
    expect(sessionKey({ ...first, warns: [] })).toBe(sessionKey(first));
  });
});
