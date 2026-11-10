import { describe, expect, it } from 'vitest';
import {
  cellShade,
  countLabel,
  formatMinutes,
  formatPercent,
  labellerLabel,
  reporterMark,
  runName,
  weekLabel,
} from './format.ts';

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

describe('cellShade', () => {
  it('shades a value on five steps of the blue ramp by its share of the max, black text on step 4, white on the darkest', () => {
    expect(cellShade(1, 10)).toBe('bg-[#cde2fb]');
    expect(cellShade(4, 10)).toBe('bg-[#9ec5f4]');
    expect(cellShade(6, 10)).toBe('bg-[#6da7ec]');
    // White on #2a78d6 is 4.42:1, under AA's 4.5:1 for the grid's small text; black is 4.76:1.
    expect(cellShade(8, 10)).toBe('bg-[#2a78d6] text-black');
    expect(cellShade(10, 10)).toBe('bg-[#184f95] text-white');
  });

  it('gives the smallest value the lightest step, never the grey', () => {
    expect(cellShade(1, 100)).toBe('bg-[#cde2fb]');
  });

  it('greys a 0, in a grid of zeros too', () => {
    expect(cellShade(0, 10)).toBe('bg-[#f0efec] text-[#52514e]');
    expect(cellShade(0, 0)).toBe('bg-[#f0efec] text-[#52514e]');
  });
});

describe('formatPercent', () => {
  it('shows a whole percent, or a dash when it is not known', () => {
    expect(formatPercent(67)).toBe('67%');
    expect(formatPercent(null)).toBe('–');
  });
});

describe('weekLabel', () => {
  it('names a week by its start date, read as UTC', () => {
    expect(weekLabel('2026-11-08')).toBe('Nov 8');
  });
});

describe('labellerLabel', () => {
  const tokensThisWeek = { input: 41_200, output: 2_150 };

  it('says the labeller is off with no API key', () => {
    expect(labellerLabel({ on: false, labelled: 17, waiting: 0, tokensThisWeek })).toBe('Labeller off: no API key');
  });

  it('counts the labelled and waiting findings and the week’s tokens, input and output together', () => {
    expect(labellerLabel({ on: true, labelled: 8, waiting: 1, tokensThisWeek })).toBe(
      '8 labelled · 1 waiting · 43,350 tokens this week',
    );
  });
});

describe('reporterMark', () => {
  it('names the latest export\'s all-time figure, and says why in its tooltip', () => {
    expect(reporterMark.text).toBe('reporter, all time');
    expect(reporterMark.tooltip).toBe(
      "The latest export's figure over everything the reporter reads; it isn't summed by period yet.",
    );
  });
});
