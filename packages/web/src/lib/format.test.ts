import { describe, expect, it } from 'vitest';
import { countLabel, formatMinutes, runName } from './format.ts';

describe('formatMinutes', () => {
  it('shows minutes alone below an hour, and hours with two-digit minutes above', () => {
    expect(formatMinutes(25)).toBe('25 min');
    expect(formatMinutes(130)).toBe('2 h 10');
    expect(formatMinutes(125)).toBe('2 h 05');
  });

  it('rounds the reporter’s fractional minutes once, before splitting into hours', () => {
    expect(formatMinutes(119.6)).toBe('2 h 00');
    expect(formatMinutes(25.5)).toBe('26 min');
    expect(formatMinutes(130.25)).toBe('2 h 10');
    expect(formatMinutes(59.6)).toBe('1 h 00');
  });

  it('shows a dash when the time is not known', () => {
    expect(formatMinutes(null)).toBe('–');
  });
});

describe('runName', () => {
  it('joins the project and the branch, leaving out what is missing', () => {
    expect(runName({ project: 'atlas', branch: 'feat/search' })).toBe('atlas · feat/search');
    expect(runName({ project: 'atlas', branch: null })).toBe('atlas');
    expect(runName({ project: null, branch: null })).toBe('');
  });
});

describe('countLabel', () => {
  it('writes a count line key as words', () => {
    expect(countLabel('not_proportionate')).toBe('not proportionate');
  });
});
