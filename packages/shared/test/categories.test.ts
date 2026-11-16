import { describe, expect, test } from 'vitest';
import { areaOf, RELEVANCE } from '../src/categories.ts';

describe('areaOf', () => {
  test('simplify is cleanup, plan_review is plan and kit_review is kit', () => {
    expect(areaOf('simplify')).toBe('cleanup');
    expect(areaOf('plan_review')).toBe('plan');
    expect(areaOf('kit_review')).toBe('kit');
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
