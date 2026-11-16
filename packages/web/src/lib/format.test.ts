import { describe, expect, it, test } from 'vitest';
import { parseTime, type FindingRow } from '@cwd/shared';
import {
  appCallLabel,
  strengthWhere,
  cellShade,
  closedFindings,
  foundFindings,
  countLabel,
  countName,
  FAMILY_LABELS,
  KIND_LABELS,
  kindLabel,
  RULE_LABELS,
  phaseLabel,
  SPEND_GROUP_LABELS,
  spendUncountedLabel,
  countLines,
  formatCount,
  formatMinutes,
  formatPercent,
  formatTokens,
  formatCompact,
  formatShare,
  total,
  hiddenWarningsLabel,
  warningsSummary,
  usageName,
  reporterMark,
  stepWarningsLabel,
  weekLabel,
  yesNoLabel,
  timelineTimes,
  projectLabel,
  sessionName,
  pathLabel,
  modelLabel,
  splitPair,
  formatDollars,
  formatWhole,
  formatCompactFixed,
  formatLength,
  capitalize,
  warningBody,
  STEP_LABELS,
  formatDay,
  formatDayTime,
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

describe('countLabel', () => {
  it('writes a count line key as words', () => {
    expect(countLabel('not_proportionate')).toBe('not proportionate');
  });
});

describe('countName', () => {
  it('names a count key capitalised, the keys whose words aren’t their slug’s by name', () => {
    expect(countName('not_proportionate')).toBe('Not proportionate');
    expect(countName('important')).toBe('Important');
    expect(countName('unneeded')).toBe('Not required');
    expect(countName('couldnt_run')).toBe("Couldn't run");
  });
});

describe('countLines', () => {
  it('writes each count as a line, its name capitalised, the keys whose words aren’t their slug’s by name', () => {
    expect(countLines({ ran: 7, not_proportionate: 0, couldnt_run: 1, unneeded: null })).toEqual([
      ['Ran', 7],
      ['Not proportionate', 0],
      ["Couldn't run", 1],
      ['Not required', null],
    ]);
  });

  it('is null when the counts aren’t known', () => {
    expect(countLines(null)).toBeNull();
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

describe('formatCompact', () => {
  it('writes a number compact, with its default rounding', () => {
    expect(formatCompact(281_449)).toBe('281K');
    expect(formatCompact(1_300_000)).toBe('1.3M');
    expect(formatCompact(87)).toBe('87');
  });

  it('writes a dash when the number isn’t known', () => {
    expect(formatCompact(null)).toBe('–');
  });
});

describe('formatShare', () => {
  it('writes a share as a whole percent', () => {
    expect(formatShare(52.4)).toBe('52%');
  });

  it('writes a dash when the share isn’t known', () => {
    expect(formatShare(null)).toBe('–');
  });
});

describe('cellShade', () => {
  it("shades a value on the theme's five ramp steps by its share of the max, each step with its own ink", () => {
    expect(cellShade(1, 10)).toBe('bg-shade-1 text-on-shade-1');
    expect(cellShade(4, 10)).toBe('bg-shade-2 text-on-shade-2');
    expect(cellShade(6, 10)).toBe('bg-shade-3 text-on-shade-3');
    expect(cellShade(8, 10)).toBe('bg-shade-4 text-on-shade-4');
    expect(cellShade(10, 10)).toBe('bg-shade-5 text-on-shade-5');
  });

  it('gives the smallest value the lightest step, never the zero cell', () => {
    expect(cellShade(1, 100)).toBe('bg-shade-1 text-on-shade-1');
  });

  it('gives a 0 the zero cell, in a grid of zeros too', () => {
    expect(cellShade(0, 10)).toBe('bg-shade-zero text-on-shade-zero');
    expect(cellShade(0, 0)).toBe('bg-shade-zero text-on-shade-zero');
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

describe('reporterMark', () => {
  it('names the latest export\'s all-time figure, and says why in its tooltip', () => {
    expect(reporterMark.text).toBe('reporter, all time');
    expect(reporterMark.tooltip).toBe(
      "The latest export's figure over everything the reporter reads; it isn't summed by period yet.",
    );
  });
});

describe('RULE_LABELS', () => {
  it('names each rule capitalised', () => {
    expect(RULE_LABELS.failingTest).toBe('Failing-test check');
    expect(RULE_LABELS.offer).toBe('Offer');
  });
});

describe('kindLabel', () => {
  it('words each of PR #8’s and CR10’s 31 kinds by hand, capitalised', () => {
    expect(Object.keys(KIND_LABELS)).toHaveLength(31);
    expect(kindLabel('step_agent_missing')).toBe('Step has no agent id');
    expect(kindLabel('model_less_dispatch')).toBe('Model-less dispatch');
    expect(kindLabel('findings_unlabelled')).toBe('Findings unlabelled');
  });

  it('shows a kind it doesn’t hold as its slug with spaces, and no kind as "Other", capitalised', () => {
    expect(kindLabel('brand_new_check')).toBe('Brand new check');
    expect(kindLabel(null)).toBe('Other');
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
    expect(warningsSummary(41, 8, 6)).toBe('41 warnings in 8 weeks, 6 of them new since you last looked.');
    expect(warningsSummary(1, 1, 0)).toBe('1 warning in 1 week, 0 of them new since you last looked.');
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

  it('sums a list’s counts the same way', () => {
    expect(total([3, null, 2])).toBe(5);
    expect(total([])).toBe(0);
  });
});

describe('usageName', () => {
  it('writes a command with its slash and a skill bare', () => {
    expect(usageName({ name: 'model', kind: 'command' })).toBe('/model');
    expect(usageName({ name: 'grill-me', kind: 'skill' })).toBe('grill-me');
  });
});

describe('yesNoLabel', () => {
  it('writes yes or no, a dash when it isn’t known', () => {
    expect(yesNoLabel(true)).toBe('yes');
    expect(yesNoLabel(false)).toBe('no');
    expect(yesNoLabel(null)).toBe('–');
  });
});

describe('sessionName', () => {
  it('names a session by its title, "no title" without one', () => {
    expect(sessionName('Plan the search index')).toBe('Plan the search index');
    expect(sessionName(null)).toBe('no title');
  });
});

describe('projectLabel', () => {
  it('names a project, "Other project" for a session in no stored run\'s project', () => {
    expect(projectLabel('atlas')).toBe('atlas');
    expect(projectLabel(null)).toBe('Other project');
  });
});

describe('timelineTimes', () => {
  it('writes the time of day, with the date on the first entry and on the first of each new day', () => {
    // The two-run session's timeline: three entries on Nov 8, then three on Nov 12.
    const times = timelineTimes([
      '2026-11-08T08:02:40.120Z',
      '2026-11-08T08:05:02.300Z',
      '2026-11-08T08:10:00Z',
      '2026-11-12T02:36:05.410Z',
      '2026-11-12T02:40:00Z',
      '2026-11-12T02:45:10.000Z',
    ]);
    expect(times.map((t) => /^[A-Z][a-z]{2} \d{1,2}, \d{1,2}:\d{2}/.test(t))).toEqual([true, false, false, true, false, false]);
    expect(times[0]).toMatch(/^Nov [78], /);
    expect(times[3]).toMatch(/^Nov 1[12], /);
    expect(times[1]).toMatch(/^\d{1,2}:\d{2}(\s|\u202f)?(AM|PM)?$/);
  });
});

describe('phaseLabel', () => {
  it('names a step kind by its step label, capitalised', () => {
    expect(phaseLabel('fix_check')).toBe('Fix-check');
    expect(phaseLabel('plan_simplify')).toBe('Plan simplify');
  });
  it('writes another phase with spaces, capitalised', () => {
    expect(phaseLabel('plan_writing')).toBe('Plan writing');
    expect(phaseLabel('design')).toBe('Design');
  });
  it('lower-cases an unknown name after its first letter', () => {
    expect(phaseLabel('Deploy_Check')).toBe('Deploy check');
  });
});

describe('spendUncountedLabel', () => {
  it('counts the units, runs and sessions, then the week from which every week is counted', () => {
    expect(spendUncountedLabel({ runs: 3, sessions: 1 }, '2026-10-04')).toBe(
      'Not counted: 4 units with no spend by phase (3 runs, 1 session); every week from Oct 4 is fully counted.',
    );
  });
  it('ends at the counts when the last week has an uncounted unit', () => {
    expect(spendUncountedLabel({ runs: 1, sessions: 0 }, null)).toBe(
      'Not counted: 1 unit with no spend by phase (1 run, 0 sessions).',
    );
  });
});

describe('SPEND_GROUP_LABELS', () => {
  it('names the five groups', () => {
    expect(Object.values(SPEND_GROUP_LABELS)).toEqual(['Plan', 'Implement', 'Review and cleanup', 'Coordination', 'Unattributed']);
  });
});

test('pathLabel names a path, keeps an unknown one, and passes null', () => {
  expect(pathLabel('small')).toBe('Small'); expect(pathLabel('wide')).toBe('wide'); expect(pathLabel(null)).toBeNull();
});
test('modelLabel writes an id in the reader\'s words', () => {
  expect(modelLabel('claude-opus-5-5')).toBe('Opus 5.5');
  expect(modelLabel('claude-fable-6-preview')).toBe('Fable 6 preview');
  expect(modelLabel('opus')).toBe('Opus');
  // A dated id drops its date, and the older "claude-3-5-family" shape names its family first.
  expect(modelLabel('claude-haiku-4-5-20251001')).toBe('Haiku 4.5');
  expect(modelLabel('claude-3-5-sonnet-20241022')).toBe('Sonnet 3.5');
  expect(modelLabel('<synthetic>')).toBe('<synthetic>');
  for (const none of ['-', '', null, undefined]) expect(modelLabel(none)).toBeNull();
});
test('splitPair gives a pair\'s two parts', () => {
  expect(splitPair('claude-opus-5-5/medium')).toEqual({ model: 'Opus 5.5', effort: 'medium' });
  expect(splitPair('-/xhigh')).toEqual({ model: null, effort: 'xhigh' });
  expect(splitPair('-/-')).toEqual({ model: null, effort: null });
});
test('numbers under a header that names their unit', () => {
  expect(formatDollars(12.4)).toBe('12.40'); expect(formatDollars(1234.5)).toBe('1,234.50');
  expect(formatWhole(5759.4)).toBe('5,759'); expect(formatCompactFixed(2_000_000)).toBe('2.0M'); expect(formatCompactFixed(333_000)).toBe('333.0K');
});
test('formatLength uses the largest units that fit', () => {
  expect(formatLength(0)).toBe('0 min'); expect(formatLength(45)).toBe('45 min'); expect(formatLength(466.3)).toBe('7 h 46');
  expect(formatLength(1439.6)).toBe('1 d 0 h'); expect(formatLength(4996.6)).toBe('3 d 11 h');
});
test('warningBody drops the log prefix and the run\'s own lead', () => {
  expect(warningBody('WARN: feat/sync (2026-11-08): no session transcript', 'feat/sync')).toBe('No session transcript');
  expect(warningBody('WARN: feat/other (2026-11-08): no session transcript', 'feat/sync')).toBe('feat/other (2026-11-08): no session transcript');
  expect(warningBody('final_review step 1 ran late')).toBe('final_review step 1 ran late');
  expect(warningBody('session {session}: startup guidelines missing')).toBe('Startup guidelines missing');
  expect(warningBody('the handoff in {session} came late')).toBe('The handoff in the session came late');
  expect(warningBody('already plain')).toBe('Already plain'); expect(warningBody('WARN:')).toBe('');
});
test('week and timeline times are written in en-US, on the 24-hour clock', () => {
  expect(weekLabel('2026-11-09')).toBe('Nov 9');
  // The reader's time zone decides the day and hour, so the shape is asserted, as the existing timelineTimes test does.
  const [first, second] = timelineTimes(['2026-11-08T08:02:00Z', '2026-11-08T08:07:00Z']);
  expect(first).toMatch(/^Nov [78], \d{2}:\d{2}$/);
  expect(second).toMatch(/^\d{2}:\d{2}$/);
});
test('a day and a day and time are written in en-US, in the reader\'s time zone, on the 24-hour clock', () => {
  // Midday UTC is the same day in every time zone but the date line's edges; the hour is the reader's.
  const date = parseTime('2026-11-12T12:20:00Z');
  expect(formatDay(date)).toMatch(/^Nov 1[12]$/);
  expect(formatDayTime(date)).toMatch(/^Nov 1[12], \d{2}:20$/);
  expect(formatDayTime(date).startsWith(`${formatDay(date)}, `)).toBe(true);
});
test('capitalize', () => { expect(capitalize('important')).toBe('Important'); expect(capitalize('')).toBe(''); });
test('STEP_LABELS names simplify as a step, capitalised', () => { expect(STEP_LABELS.simplify).toBe('Simplify'); });

describe('foundFindings', () => {
  it('counts every finding of the run', () => {
    expect(foundFindings({ beforeSteps: false, findings: { total: 6, actedOn: 3, notActedOn: 2, open: 1 } })).toBe(6);
  });

  it('is unknown for a record from before steps', () => {
    expect(foundFindings({ beforeSteps: true, findings: { total: 0, actedOn: 0, notActedOn: 0, open: 0 } })).toBeNull();
  });
});

describe('closedFindings', () => {
  it('counts the findings acted on and not acted on, the open ones left out', () => {
    expect(closedFindings({ beforeSteps: false, findings: { total: 6, actedOn: 3, notActedOn: 2, open: 1 } })).toBe(5);
  });

  it('is unknown for a record from before steps', () => {
    expect(closedFindings({ beforeSteps: true, findings: { total: 0, actedOn: 0, notActedOn: 0, open: 0 } })).toBeNull();
  });
});
