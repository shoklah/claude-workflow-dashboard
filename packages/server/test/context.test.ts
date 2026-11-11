import { expect, test } from 'vitest';
import { loadReport, readShare, type Report } from '@cwd/shared';
import { fixture } from '../../shared/test/fixture.ts';
import { contextSums, contextWeek, emptyContext } from '../src/views/context.ts';

function report(): Report {
  const loaded = loadReport(fixture('report-v7'));
  if (!loaded.ok) throw new Error('report-v7 does not load');
  return loaded.report;
}

test("contextSums over report-v7's runs and sessions equals its totals.context week by week", () => {
  const { runs, sessions, totals } = report();
  const sums = contextSums(runs, sessions);
  const expected = totals.context!;
  expect([...sums.keys()].sort()).toEqual(expected.map((row) => row.week).sort());
  for (const row of expected) {
    const sum = sums.get(row.week!)!;
    expect({
      calls: sum.calls,
      tokens: sum.tokens,
      max_tokens: sum.maxTokens,
      units_over_cap: sum.unitsOverCap,
      tool_results: sum.toolResults,
      sweeps: sum.sweeps,
    }).toEqual({
      calls: row.calls,
      tokens: row.tokens,
      max_tokens: row.max_tokens,
      units_over_cap: row.units_over_cap,
      tool_results: row.tool_results,
      sweeps: row.sweeps,
    });
  }
});

test('window-less runs, a session with a null context and a session with no start count nowhere', () => {
  const { runs, sessions } = report();
  const counted = (sums: ReturnType<typeof contextSums>) => [...sums.values()].reduce((n, s) => n + s.units, 0);
  const withContext = runs.filter((r) => r.context).length + sessions.filter((s) => s.context && s.start).length;
  const sums = contextSums(runs, sessions);
  expect(counted(sums)).toBe(withContext);
  // Only the units this test names as skipped: the counted total doesn't move without them.
  const skipped = contextSums(
    runs.filter((r) => !r.context),
    sessions.filter((s) => !s.context || !s.start),
  );
  expect(skipped.size).toBe(0);
  expect(sessions.some((s) => s.title === 'Offline sync build' && s.context === null)).toBe(true);
  expect(sessions.some((s) => !s.start && s.context)).toBe(true);
});

test('a tool_results class the reporter adds later sums, and counts in readShare', () => {
  const { runs } = report();
  const run = runs.find((r) => r.context)!;
  const later = { ...run, tool_results: { read: 300, other: 100, notebook: 600 } };
  const sums = contextSums([later, { ...later }], []);
  const sum = [...sums.values()][0];
  expect(sum.toolResults).toEqual({ read: 600, other: 200, notebook: 1200 });
  expect(readShare(sum.toolResults)).toBe(30);
  expect(contextWeek('2026-11-08', sum).readShare).toBe(30);
});

test('readShare of all zeros or of null is null', () => {
  expect(readShare({ read: 0, edit: 0 })).toBeNull();
  expect(readShare(null)).toBeNull();
  expect(readShare(undefined)).toBeNull();
});

test("contextWeek of emptyContext() has meanTokens and readShare null", () => {
  expect(contextWeek('2026-11-08', emptyContext())).toEqual({
    week: '2026-11-08',
    units: 0,
    calls: 0,
    tokens: 0,
    maxTokens: null,
    unitsOverCap: 0,
    toolResults: {},
    sweeps: { inline: 0, delegated: 0 },
    meanTokens: null,
    readShare: null,
  });
});

test('contextWeek adds the mean tokens per call', () => {
  const { runs, sessions } = report();
  const sum = contextSums(runs, sessions).get('2026-11-01')!;
  expect(contextWeek('2026-11-01', sum).meanTokens).toBe(1026000 / 18);
});
