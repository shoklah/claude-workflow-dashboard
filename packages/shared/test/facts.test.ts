import { describe, expect, test } from 'vitest';
import { runFacts, splitFindings, splitSessionId } from '../src/facts.ts';
import { loadReport } from '../src/load.ts';
import type { Report, RunEntry } from '../src/report.ts';
import { fixture } from './fixture.ts';

function report(): Report {
  const result = loadReport(fixture('report-full'));
  if (!result.ok) throw new Error('the full fixture does not load');
  return result.report;
}

const KEY = 'a1b2c3d4e5f60718';

function run(path: string, schema = 2): RunEntry {
  const found = report().runs.findLast((r) => r.record?.path === path && r.schema === schema);
  if (!found) throw new Error(`no ${path} run with schema ${schema} in the fixture`);
  return found;
}

describe('runFacts', () => {
  test('project is the last path segment', () => {
    const facts = runFacts(run('full'), KEY);
    expect(facts.project).toBe('lantern-notes');
    expect(facts.project).not.toContain('/');
  });

  test('cost sums the priced models', () => {
    expect(runFacts(run('full'), KEY).cost).toBeCloseTo(9.52 + 4.275, 10);
  });

  test('cost is null with no models', () => {
    const noWindow = report().runs.find((r) => r.record?.branch === 'fix/retry-backoff')!;
    expect(runFacts(noWindow, KEY).cost).toBeNull();
  });

  test('cost is 0 when no model is priced', () => {
    expect(runFacts(run('plan'), KEY).cost).toBe(0);
  });

  test('stops comes from the record', () => {
    const full = run('full');
    expect(runFacts({ ...full, record: { ...full.record, stops: 2 } }, KEY).stops).toBe(2);
    expect(runFacts({ ...full, record: { ...full.record, stops: undefined } }, KEY).stops).toBeNull();
  });

  test('findings split by outcome', () => {
    expect(runFacts(run('full'), KEY).findings).toEqual({ total: 12, actedOn: 5, notActedOn: 5, open: 1 });
  });

  test('a schema 1 run is before steps', () => {
    expect(runFacts(run('full', 1), KEY).beforeSteps).toBe(true);
    expect(runFacts(run('full'), KEY).beforeSteps).toBe(false);
  });

  test('waves counts the run\'s waves', () => {
    expect(runFacts(run('full'), KEY).waves).toBe(2);
    expect(runFacts(run('small'), KEY).waves).toBe(0);
  });

  test('key is the stored key it is given', () => {
    expect(runFacts(run('full'), 'stored-key').key).toBe('stored-key');
  });

  test('the record and the entry give the rest', () => {
    const full = run('full');
    expect(runFacts(full, KEY)).toMatchObject({
      branch: 'feature/offline-sync',
      path: 'full',
      stage: '2',
      startedAt: '2026-11-10T09:05:00Z',
      finishedAt: '2026-11-10T16:45:00Z',
      minutes: 460,
      warnings: 1,
      tasks: 4,
    });
  });
});

describe('splitFindings', () => {
  test('a finding with no outcome counts in total only', () => {
    const steps = run('full').steps!;
    const f6 = steps.flatMap((s) => s.findings ?? []).find((f) => f.id === 'F6')!;
    expect(f6.outcome ?? null).toBeNull();
    expect(splitFindings([{ findings: [f6] }])).toEqual({ total: 1, actedOn: 0, notActedOn: 0, open: 0 });
  });
});

describe('splitSessionId', () => {
  test('splitSessionId takes the session out of a warning', () => {
    const [warning] = report().sessions[1].warns!;
    expect(splitSessionId(warning)).toEqual({
      text: 'WARN: session {session}: startup guidelines missing',
      sessionId: '0f3c9a2e-5b7d-4c1e-9a8f-2d6b4e1c7a35',
    });
  });

  test('splitSessionId leaves a run warning alone', () => {
    const [warning] = run('full').warns!;
    expect(splitSessionId(warning)).toEqual({ text: warning, sessionId: null });
  });
});
