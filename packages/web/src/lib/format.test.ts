import { describe, expect, it } from 'vitest';
import type { FindingRow } from '@cwd/shared';
import {
  advisorLabel,
  appCallLabel,
  byAppSplit,
  judgedInvalidLabel,
  strengthWhere,
  cellShade,
  countLabel,
  FAMILY_LABELS,
  KIND_LABELS,
  kindLabel,
  countsLabel,
  formatCount,
  formatMinutes,
  formatPercent,
  formatTokens,
  total,
  hiddenWarningsLabel,
  warningsSummary,
  labellerLabel,
  nonZeroCountsLabel,
  ofLabel,
  usageName,
  outcomesLabel,
  reporterMark,
  runName,
  stepWarningsLabel,
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

describe('stepWarningsLabel', () => {
  it('names the count and the step', () => {
    expect(stepWarningsLabel(1, 'final_review')).toBe('1 warning on Final review');
    expect(stepWarningsLabel(2, 'task_review')).toBe('2 warnings on Task review');
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

describe('kindLabel', () => {
  it('words each of PR #8’s and CR10’s 31 kinds by hand', () => {
    expect(Object.keys(KIND_LABELS)).toHaveLength(31);
    expect(kindLabel('step_agent_missing')).toBe('step has no agent id');
    expect(kindLabel('model_less_dispatch')).toBe('model-less dispatch');
    expect(kindLabel('findings_unlabelled')).toBe('findings unlabelled');
  });

  it('shows a kind it doesn’t hold as its slug with spaces, and no kind as "other"', () => {
    expect(kindLabel('brand_new_check')).toBe('brand new check');
    expect(kindLabel(null)).toBe('other');
  });
});

describe('FAMILY_LABELS', () => {
  it('names the families, "other" included', () => {
    expect(FAMILY_LABELS).toEqual({
      review_flow: 'Review flow',
      steps_record: 'Steps and the record',
      agents_models: 'Agents and models',
      skills_offers: 'Skills and offers',
      sessions: 'Sessions',
      other: 'Other',
    });
  });
});

describe('warningsSummary', () => {
  it("sums the grid's warnings over its weeks and says how many are new", () => {
    expect(warningsSummary(41, 8, 6)).toBe('41 warnings in 8 weeks · 6 new since you last looked');
    expect(warningsSummary(1, 1, 0)).toBe('1 warning in 1 week · 0 new since you last looked');
  });
});

describe('hiddenWarningsLabel', () => {
  it('says what showing mode left out of Compliance’s list, and that the grid counts all but other kinds', () => {
    expect(hiddenWarningsLabel(3)).toBe(
      '+ 3 warnings left out while showing (other projects, sessions and other kinds); the grid counts all but other kinds',
    );
    expect(hiddenWarningsLabel(1)).toMatch(/^\+ 1 warning left out/);
  });
});

describe('appCallLabel', () => {
  const labels = { correctness: 'Correctness', tests: 'Tests' };
  const f = (row: Partial<FindingRow>) =>
    ({ category: 'tests', validity: 'valid', judge: 'workflow', relevance: 'valid', appCategory: null, appRelevance: null, ...row }) as FindingRow;

  it('says "agrees" only when the workflow made both calls and the app matches them', () => {
    expect(appCallLabel(f({}), labels)).toBe('agrees');
  });

  it("names the app's category and call where they differ", () => {
    expect(appCallLabel(f({ appCategory: 'correctness', appRelevance: 'invalid', relevance: 'invalid' }), labels)).toBe(
      'Correctness · invalid',
    );
    expect(appCallLabel(f({ appRelevance: 'invalid', relevance: 'invalid' }), labels)).toBe('invalid');
  });

  it("shows the app's call where the workflow made none", () => {
    expect(appCallLabel(f({ validity: null, relevance: 'invalid' }), labels)).toBe('invalid');
    expect(appCallLabel(f({ validity: null, relevance: 'valid', appCategory: 'correctness' }), labels)).toBe(
      'Correctness · valid',
    );
    expect(appCallLabel(f({ judge: 'app', validity: null, relevance: 'unclear' }), labels)).toBe('unclear');
  });

  it('is a dash with no app label', () => {
    expect(appCallLabel(f({ relevance: null }), labels)).toBe('–');
  });
});

describe('byAppSplit', () => {
  it("adds the app's part of a count when it has one", () => {
    expect(byAppSplit({ raised: 7, byApp: 5 })).toBe('7 · 5 by the app');
    expect(byAppSplit({ raised: 2, byApp: 0 })).toBe('2');
  });
});

describe('judgedInvalidLabel', () => {
  it('counts the findings the session judged invalid', () => {
    expect(judgedInvalidLabel(6)).toBe('6 judged invalid by the session');
  });
});

describe('strengthWhere', () => {
  it("names a strength's step, and its task when it has one", () => {
    expect(strengthWhere({ step: 'task_review', task: 3 })).toBe('Task review · task 3');
    expect(strengthWhere({ step: 'final_review', task: null })).toBe('Final review');
  });
});

describe('total', () => {
  it('sums a record’s counts, a count that isn’t known as 0', () => {
    expect(total({ small: 4, full: 2 })).toBe(6);
    expect(total({ with: 3, without: null })).toBe(3);
    expect(total({})).toBe(0);
  });
});

describe('usageName', () => {
  it('writes a command with its slash and a skill bare', () => {
    expect(usageName({ name: 'model', kind: 'command' })).toBe('/model');
    expect(usageName({ name: 'grill-me', kind: 'skill' })).toBe('grill-me');
  });
});

describe('ofLabel', () => {
  it('writes a count out of its whole, a count that isn’t known as a dash', () => {
    expect(ofLabel(8, 23)).toBe('8 of 23');
    expect(ofLabel(null, 6)).toBe('–');
  });
});
