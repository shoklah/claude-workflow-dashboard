// The owner's time zone, set before any date is built: the week rule must not depend on it.
process.env.TZ = 'Europe/Paris';

import { describe, expect, test } from 'vitest';
import { weekStart } from '../src/week.ts';

describe('weekStart', () => {
  test('Sunday 06:59Z belongs to the previous week', () => {
    expect(weekStart(new Date('2026-11-08T06:59:00Z')).toISOString()).toBe('2026-11-01T07:00:00.000Z');
  });

  test('Sunday 07:00Z starts a week', () => {
    expect(weekStart(new Date('2026-11-08T07:00:00Z')).toISOString()).toBe('2026-11-08T07:00:00.000Z');
  });

  test('Saturday night belongs to the week', () => {
    expect(weekStart(new Date('2026-11-14T23:00:00Z')).toISOString()).toBe('2026-11-08T07:00:00.000Z');
  });
});
