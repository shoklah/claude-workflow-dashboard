import {
  areaOf,
  AREAS,
  CATEGORIES,
  parseTime,
  splitFindings,
  weekOf,
  type FindingCell,
  type FindingItem,
  type FindingRow,
  type FindingsQuery,
  type FindingsResponse,
  type RunEntry,
  type Step,
} from '@cwd/shared';
import type { StoredLabel } from '../db/labels.ts';
import type { StoredUnit } from '../db/read.ts';
import { period, runView, storedFacts, storedNames } from './runs.ts';
import type { Scope } from './scope.ts';

const sum = <T>(items: T[], of: (item: T) => number) => items.reduce((n, item) => n + of(item), 0);

function cell(findings: FindingRow[]): FindingCell {
  return {
    raised: findings.length,
    actedOn: splitFindings([{ findings }]).actedOn,
    invalid: findings.filter((f) => f.relevance === 'invalid').length,
  };
}

/** The signals over the runs: their later fixes, final review findings after task reviews that all found nothing,
 * fix checks' findings not proportionate, and findings declined or ruled. */
function signals(runs: RunEntry[]): FindingsResponse['signals'] {
  const steps = runs.flatMap((run) => run.steps ?? []);
  const found = (of: Step[]) => sum(of, (s) => s.findings?.length ?? 0);
  return {
    laterFixes: sum(runs, (run) => run.later_fixes?.length ?? 0),
    finalAfterClean: sum(runs, (run) => {
      const reviews = (run.steps ?? []).filter((s) => s.step === 'task_review');
      const clean = reviews.length > 0 && found(reviews) === 0;
      return clean ? found((run.steps ?? []).filter((s) => s.step === 'final_review')) : 0;
    }),
    notProportionate: sum(
      steps.filter((s) => s.step === 'fix_check' || s.step === 'final_fix_check'),
      (s) => s.counts?.not_proportionate ?? 0,
    ),
    declinedOrRuled: steps
      .flatMap((s) => s.findings ?? [])
      .filter((f) => f.outcome === 'declined' || f.outcome === 'ruled').length,
  };
}

/**
 * The Findings page: over the stored runs in the query's period (period), each area's categories by week (a finding's
 * week is its run's), then the area's unlabelled row when any of its findings has no label from `labels`
 * (currentLabels), the findings as runView gives them, and the signals. With a
 * scope, the cells and signals still count every project, but the findings are only the shown projects', masked as
 * runView masks them, and `hidden` counts those left out.
 */
export function findingsView(input: {
  runs: StoredUnit<RunEntry>[];
  labels: Map<string, StoredLabel>;
  query: FindingsQuery;
  now: Date;
  scope: Scope | null;
  labeller: FindingsResponse['labeller'];
}): FindingsResponse {
  const { labels, query, scope } = input;
  const { weeks, matches } = period(query, input.now);
  const names = storedNames(input.runs);
  // Stored runs always have a date: the import skips a run without one.
  const runs = input.runs.flatMap((unit) => {
    const facts = storedFacts(unit, names);
    return matches(facts) ? [{ unit, week: weekOf(parseTime(facts.finishedAt!)) }] : [];
  });

  // Each row's findings, by week, under `${area} ${category}`; a null category is the unlabelled row.
  const rowKeys = AREAS.flatMap((area) => [...CATEGORIES[area], null].map((category) => ({ area, category })));
  const byRow = new Map(
    rowKeys.map(({ area, category }) => [`${area} ${category}`, weeks.map((): FindingRow[] => [])]),
  );
  const findings: FindingItem[] = [];
  let hidden = 0;
  for (const { unit, week } of runs) {
    // runView gives null only for a hidden project's run, so never with no scope.
    const all = runView(unit, [], names, null, labels)!;
    for (const f of all.findings) byRow.get(`${areaOf(f.step)} ${f.category}`)?.[weeks.indexOf(week)].push(f);
    const shown = scope ? runView(unit, [], names, scope, labels) : all;
    if (!shown) {
      hidden += all.findings.length;
      continue;
    }
    const { project, branch } = shown.facts;
    findings.push(
      ...shown.findings.map((f) => ({ ...f, runKey: unit.key, project, branch, week, area: areaOf(f.step) })),
    );
  }

  return {
    weeks,
    rows: rowKeys
      .map(({ area, category }) => ({ area, category, cells: byRow.get(`${area} ${category}`)!.map(cell) }))
      .filter((row) => row.category !== null || row.cells.some((c) => c.raised > 0)),
    findings,
    hidden,
    signals: signals(runs.map(({ unit }) => unit.merged)),
    labeller: input.labeller,
  };
}
