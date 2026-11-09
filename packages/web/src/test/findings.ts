import { AREAS, CATEGORIES, type Area, type FindingCell, type FindingItem, type FindingRow, type FindingsResponse } from '@cwd/shared';
import { finding, fullRun, smallRun } from './runs.ts';

// Invented answers of GET /api/findings for the Findings page's stories: four weeks, a few findings, each counted in
// its cell.

const WEEKS = ['2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'];

/** A finding as the page lists it, in a run of `fullRun`'s project unless given. */
function item(
  f: Partial<FindingRow> & Pick<FindingRow, 'id' | 'step' | 'summary'>,
  at: { week: string; area: Area; run?: typeof fullRun },
): FindingItem {
  const run = at.run ?? fullRun;
  return { ...finding(f), runKey: run.key, project: run.project!, branch: run.branch, week: at.week, area: at.area };
}

const impl = (week: string, run?: typeof fullRun) => ({ week, area: 'implementation' as const, run });

const FINDINGS: FindingItem[] = [
  item({ id: 'F1', step: 'task_review', task: 1, severity: 'important', summary: 'Search drops the last page on exact multiples', outcome: 'fixed', category: 'correctness', relevance: 'valid', labelReason: 'Results on the last page are lost' }, impl('2026-10-18', smallRun)),
  item({ id: 'F2', step: 'final_review', severity: 'minor', summary: 'Empty query returns every row', outcome: 'open', category: 'correctness', relevance: 'unclear', labelReason: 'It may be the intended default' }, impl('2026-11-08')),
  item({ id: 'F3', step: 'task_review', task: 2, severity: 'minor', summary: 'Import groups out of order', outcome: 'declined', reason: 'The formatter owns the order', category: 'conventions', relevance: 'invalid', labelReason: 'The formatter sorts them already' }, impl('2026-10-25')),
  item({ id: 'F4', step: 'task_review', task: 3, severity: 'important', summary: 'No test covers the empty export case', outcome: 'fixed', category: 'tests', relevance: 'valid', labelReason: 'An empty export is a real case' }, impl('2026-11-01')),
  item({ id: 'F5', step: 'task_review', task: 4, severity: 'important', summary: 'The retry path has no test', outcome: 'fixed', category: 'tests', relevance: 'valid', labelReason: 'Retries fail silently without one' }, impl('2026-11-08')),
  item({ id: 'F6', step: 'final_review', severity: 'minor', summary: 'Story for the error state is missing', outcome: 'declined', reason: 'Covered by the page story', category: 'tests', relevance: 'invalid', labelReason: 'The page story covers it' }, impl('2026-11-08')),
  item({ id: 'F7', step: 'task_review', task: 1, severity: 'minor', summary: 'Log line repeats the device name', outcome: 'open' }, impl('2026-11-01')),
  item({ id: 'F8', step: 'plan_review', severity: 'important', summary: 'Cut the export-to-PDF task', outcome: 'applied', category: 'scope', relevance: 'valid', labelReason: "PDF export isn't in the goal" }, { week: '2026-11-01', area: 'plan' }),
  item({ id: 'F9', step: 'simplify', summary: 'Inline the one-use date formatter', outcome: 'applied', category: 'simplicity', relevance: 'valid', labelReason: 'One use needs no helper' }, { week: '2026-11-08', area: 'cleanup' }),
];

/** Each area's categories, then its unlabelled row when it has findings, with each week's cell counted from the
 * findings, as the API gives them. */
function rows(findings: FindingItem[]): FindingsResponse['rows'] {
  const cells = (area: Area, category: string | null): FindingCell[] =>
    WEEKS.map((week) => {
      const here = findings.filter((f) => f.area === area && f.category === category && f.week === week);
      return {
        raised: here.length,
        actedOn: here.filter((f) => f.outcome === 'fixed' || f.outcome === 'applied').length,
        invalid: here.filter((f) => f.relevance === 'invalid').length,
      };
    });
  return AREAS.flatMap((area) => [
    ...CATEGORIES[area].map((category) => ({ area, category, cells: cells(area, category) })),
    ...(findings.some((f) => f.area === area && f.category === null)
      ? [{ area, category: null, cells: cells(area, null) }]
      : []),
  ]);
}

export const findingsFull: FindingsResponse = {
  weeks: WEEKS,
  rows: rows(FINDINGS),
  findings: FINDINGS,
  hidden: 0,
  signals: { laterFixes: 3, finalAfterClean: 5, notProportionate: 4, declinedOrRuled: 18 },
  labeller: { on: true, labelled: 8, waiting: 1, tokensThisWeek: { input: 41_200, output: 2_150 } },
};

/** No findings in the period, and no API key: every cell 0, the labeller off. */
export const findingsEmpty: FindingsResponse = {
  weeks: WEEKS,
  rows: rows([]),
  findings: [],
  hidden: 0,
  signals: { laterFixes: 0, finalAfterClean: 0, notProportionate: 0, declinedOrRuled: 0 },
  labeller: { on: false, labelled: 0, waiting: 0, tokensThisWeek: { input: 0, output: 0 } },
};

/** Showing mode on: the cells count every project, but three findings of other projects are only counted. */
export const findingsHidden: FindingsResponse = { ...findingsFull, hidden: 3 };
