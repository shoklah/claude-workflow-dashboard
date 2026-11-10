import { describe, expect, it } from 'vitest';
import {
  advisorLabel,
  cellShade,
  countLabel,
  countsLabel,
  formatCount,
  formatMinutes,
  formatPercent,
  formatTokens,
  labellerLabel,
  nonZeroCountsLabel,
  outcomesLabel,
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

describe('countsLabel', () => {
  it('writes each count after its key as words, a dash for a count that isn’t known', () => {
    expect(countsLabel({ cuts: 11, not_proportionate: 0 })).toBe('cuts 11 · not proportionate 0');
    expect(countsLabel({ with: 38, without: null })).toBe('with 38 · without –');
  });

  it('shows a dash for no counts, or counts that aren’t known', () => {
    expect(countsLabel({})).toBe('–');
    expect(countsLabel(null)).toBe('–');
  });
});

describe('nonZeroCountsLabel', () => {
  it('writes the counts that are not 0, in their order, as words', () => {
    expect(nonZeroCountsLabel({ small: 4, full: 0, plan: 1 })).toBe('small 4 · plan 1');
    expect(nonZeroCountsLabel({ fix_rounds: 2 })).toBe('fix rounds 2');
  });
  it('writes "none" when every count is 0', () => {
    expect(nonZeroCountsLabel({ critical: 0, important: 0 })).toBe('none');
    expect(nonZeroCountsLabel({})).toBe('none');
  });
});

describe('formatCount', () => {
  it('writes a count, or a dash when it isn’t known', () => {
    expect(formatCount(0)).toBe('0');
    expect(formatCount(14)).toBe('14');
    expect(formatCount(null)).toBe('–');
  });
});

describe('formatTokens', () => {
  it('writes every kind of token together, compact', () => {
    expect(formatTokens({ input: 210_000, output: 90_000, cache_read: 9_200_000, cache_write: 300_000 })).toBe('9.8M');
    expect(formatTokens({ input: 333_000 })).toBe('333K');
  });

  it('writes 0 for no tokens, and a dash when they aren’t known', () => {
    expect(formatTokens({ input: 0, output: 0 })).toBe('0');
    expect(formatTokens({})).toBe('0');
    expect(formatTokens(null)).toBe('–');
  });
});

describe('advisorLabel', () => {
  it('writes the notes, the changed ones and the share as a whole percent', () => {
    expect(advisorLabel({ notes: 12, changed: 9, share: 7.8 })).toBe('notes 12 · changed 9 · share 8%');
  });

  it('shows a dash for each figure that isn’t known', () => {
    expect(advisorLabel({ notes: null, changed: 3, share: null })).toBe('notes – · changed 3 · share –');
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

describe('outcomesLabel', () => {
  it('writes each outcome with its count, or a dash with none', () => {
    expect(outcomesLabel({ ran: 2, 'applied 2, skipped 1': 1 })).toBe('ran × 2 · applied 2, skipped 1 × 1');
    expect(outcomesLabel({})).toBe('–');
  });
});
