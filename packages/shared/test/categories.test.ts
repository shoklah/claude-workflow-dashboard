import { describe, expect, test } from 'vitest';
import { areaOf, RELEVANCE } from '../src/categories.ts';

describe('areaOf', () => {
  test('simplify is cleanup and plan_review is plan', () => {
    expect(areaOf('simplify')).toBe('cleanup');
    expect(areaOf('plan_review')).toBe('plan');
  });

  test('the review steps are implementation', () => {
    for (const step of ['task_review', 'fix_check', 'final_review', 'final_fix_check'] as const) {
      expect(areaOf(step)).toBe('implementation');
    }
    expect(areaOf('plan_simplify')).toBe('plan');
  });
});

describe('RELEVANCE', () => {
  test("is the labeller's three calls", () => {
    expect(RELEVANCE).toEqual(['valid', 'invalid', 'unclear']);
  });
});
