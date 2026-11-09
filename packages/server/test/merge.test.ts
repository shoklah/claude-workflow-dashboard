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
    const prev = { models: { opus: { input: 10, cost: 0.5 } } };
    const next = { models: { opus: { input: 12, cost: null }, fable: { input: 1, cost: 0.1 } } };
    expect(mergeKnown(prev, next)).toEqual({
      models: { opus: { input: 12, cost: 0.5 }, fable: { input: 1, cost: 0.1 } },
    });
  });

  test('an array replaces', () => {
    expect(mergeKnown({ warns: ['a', 'b'] }, { warns: ['c'] })).toEqual({ warns: ['c'] });
  });

  test('a null array keeps the known one', () => {
    expect(mergeKnown({ warns: ['a'] }, { warns: null })).toEqual({ warns: ['a'] });
  });
});
