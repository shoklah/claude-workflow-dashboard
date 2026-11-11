import { describe, expect, test } from 'vitest';
import { mergeKnown } from '../src/db/merge.ts';

describe('mergeKnown', () => {
  test('null keeps a known value', () => {
    expect(mergeKnown({ cost: 3 }, { cost: null })).toEqual({ cost: 3 });
  });

  test('missing keeps a known value', () => {
    expect(mergeKnown({ cost: 3, minutes: 12 }, { minutes: 14 })).toEqual({ cost: 3, minutes: 14 });
  });

  test('a new value wins', () => {
    expect(mergeKnown({ cost: 3 }, { cost: 4 })).toEqual({ cost: 4 });
  });

  test('nested objects merge key by key', () => {
    const prev = { record: { tasks: { done: 10, minutes: 5 } } };
    const next = { record: { tasks: { done: 12, minutes: null }, branch: 'b' } };
    expect(mergeKnown(prev, next)).toEqual({ record: { tasks: { done: 12, minutes: 5 }, branch: 'b' } });
  });

  test("a unit's count map replaces whole, so a key the new map lacks stops counting", () => {
    expect(mergeKnown({ refusals: { no_model: 1 } }, { refusals: {} })).toEqual({ refusals: {} });
    const prev = { models: { opus: { input: 10, cost: 0.5 } }, efforts: { implementer: { 'opus/medium': 2 } } };
    const next = { models: { fable: { input: 1, cost: null } }, efforts: { reviewer: { 'fable/high': 1 } } };
    expect(mergeKnown(prev, next)).toEqual(next);
    const notes = { notes: 0, changed: null, missing: 0 };
    expect(mergeKnown({ notes: { notes: 2, changed: 1, missing: 0 } }, { notes })).toEqual({ notes });
  });

  test("the advisor's count maps replace whole, and its other facts merge", () => {
    const prev = {
      advisor: {
        calls: 1,
        cost: 0.06,
        tokens: { input: 1800, output: 700 },
        by_role: { main: { calls: 1, flagged: false } },
        failed: { overloaded: 1 },
        weeks: [{ week: '2026-11-08', advisor: 0.06, fable: 0 }],
      },
    };
    const next = { advisor: { calls: 0, cost: null, tokens: { input: 0 }, by_role: {}, failed: {}, weeks: [] } };
    expect(mergeKnown(prev, next)).toEqual({
      advisor: { calls: 0, cost: 0.06, tokens: { input: 0 }, by_role: {}, failed: {}, weeks: [] },
    });
  });

  test('a null count map keeps the stored one', () => {
    const prev = { refusals: { no_model: 1 }, advisor: { by_role: { main: { calls: 1, flagged: false } } } };
    expect(mergeKnown(prev, { refusals: null, advisor: { by_role: null } })).toEqual(prev);
    expect(mergeKnown(prev, {})).toEqual(prev);
  });

  test('a count map below a unit merges as any object', () => {
    expect(mergeKnown({ record: { refusals: { a: 1 } } }, { record: { refusals: { b: 2 } } })).toEqual({
      record: { refusals: { a: 1, b: 2 } },
    });
  });

  test('an array replaces', () => {
    expect(mergeKnown({ warns: ['a', 'b'] }, { warns: ['c'] })).toEqual({ warns: ['c'] });
  });

  test('a null array keeps the known one', () => {
    expect(mergeKnown({ warns: ['a'] }, { warns: null })).toEqual({ warns: ['a'] });
  });
  const context = {
    calls: 96,
    tokens: 24960000,
    median_tokens: 262100,
    max_tokens: 341800,
    over_cap: true,
    calls_over_cap: 9,
    handoff: '2026-11-09T13:31:05.000Z',
    handoff_to: 'e66de89cb5c23e32',
  };
  const toolResults = { read: 214500, edit: 3800, run: 11200, bash_other: 8900, agent: 61400, mcp: 0, other: 2600 };
  const zero = { read: 0, edit: 0, run: 0, bash_other: 0, agent: 0, mcp: 0, other: 0 };

  test("a read transcript's null context replaces the stored one", () => {
    expect(mergeKnown({ context, tool_results: toolResults }, { context: null, tool_results: zero })).toEqual({
      context: null,
      tool_results: zero,
    });
  });

  test('the three context facts null keep the stored ones', () => {
    const prev = { context, tool_results: toolResults, sweeps: { inline: 0, delegated: 1 } };
    expect(mergeKnown(prev, { context: null, tool_results: null, sweeps: null })).toEqual(prev);
  });

  test("a new context replaces whole, so a handoff it lacks isn't kept", () => {
    const next = { ...context, calls: 40, handoff: null, handoff_to: null };
    const merged = mergeKnown({ context }, { context: next }) as { context: typeof next };
    expect(merged.context.handoff).toBeNull();
    expect(merged.context.handoff_to).toBeNull();
  });

  test('a tool results class the new map lacks stops counting', () => {
    const merged = mergeKnown({ tool_results: toolResults }, { tool_results: { read: 5 } }) as Record<string, unknown>;
    expect(merged.tool_results).toEqual({ read: 5 });
  });
});
