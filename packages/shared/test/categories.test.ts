import { describe, expect, test } from 'vitest';
import { areaOf, CATEGORIES, CATEGORY_LIST_VERSION, RELEVANCE } from '../src/categories.ts';

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

describe('CATEGORIES', () => {
  test('cleanup uses the implementation list', () => {
    expect(CATEGORIES.cleanup).toEqual(CATEGORIES.implementation);
  });

  test("the lists are the spec's, at version 1", () => {
    expect(CATEGORY_LIST_VERSION).toBe(1);
    expect(CATEGORIES.plan).toEqual(['scope', 'task split and order', 'spec gap', 'risk missed', 'test plan']);
    expect(CATEGORIES.implementation).toEqual([
      'correctness',
      'error handling',
      'data safety',
      'security and privacy',
      'reuse and duplication',
      'conventions',
      'simplicity',
      'tests',
      'naming and clarity',
      'performance',
      'docs',
    ]);
    expect(RELEVANCE).toEqual(['valid', 'invalid', 'unclear']);
  });
});
