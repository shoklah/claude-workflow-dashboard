// The owner's time zone, set before any date is built: the week rule must not depend on it.
process.env.TZ = 'Europe/Paris';

import { describe, expect, test } from 'vitest';
import { parseTime, weekStart } from '../src/week.ts';

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

describe('parseTime', () => {
  test('a time with no zone is UTC, as in the reporter, so Sunday 07:00 starts a week', () => {
    expect(weekStart(parseTime('2026-11-08T07:00:00')).toISOString()).toBe('2026-11-08T07:00:00.000Z');
  });

  test('a time with a zone keeps it', () => {
    expect(parseTime('2026-11-08T08:00:00+01:00').toISOString()).toBe('2026-11-08T07:00:00.000Z');
    expect(parseTime('2026-11-08T07:00:00.500Z').toISOString()).toBe('2026-11-08T07:00:00.500Z');
  });

  test('a date alone is midnight UTC', () => {
    expect(parseTime('2026-11-08').toISOString()).toBe('2026-11-08T00:00:00.000Z');
  });
});
