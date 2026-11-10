import {
  parseTime,
  toStepKind,
  weekOf,
  type ComplianceQuery,
  type ComplianceResponse,
  type ComplianceRow,
  type ComplianceWarning,
  type RunEntry,
  type SessionEntry,
} from '@cwd/shared';
import type { StoredUnit, StoredWarning } from '../db/read.ts';
import { currentWarnings, period, storedFacts, storedNames } from './runs.ts';
import { showFacts, showWarning, type Scope } from './scope.ts';

const OTHER = 'other';

/**
 * The warning kinds by family, in the page's order: PR #8's kinds (in its table's order within a family), and CR10's
 * findings_unlabelled and strengths_unrecorded under steps_record. The reporter carries no grouping.
 */
export const FAMILIES: { family: string; kinds: readonly string[] }[] = [
  {
    family: 'review_flow',
    kinds: [
      'simplify_not_run',
      'final_review_without_simplify',
      'simplify_record_differs',
      'risk_area_small_path',
      'wave_unchecked',
      'conventions_not_added',
      'plan_review_without_simplify',
    ],
  },
  {
    family: 'steps_record',
    kinds: [
      'no_transcript',
      'count_line_missing',
      'final_findings_differ',
      'step_count_differs',
      'step_counts_differ',
      'findings_dont_add_up',
      'verdicts_dont_add_up',
      'fix_added_differs',
      'step_agent_missing',
      'step_agent_unknown',
      'step_agent_mismatch',
      'step_agent_duplicate',
      'findings_unlabelled',
      'strengths_unrecorded',
    ],
  },
  {
    family: 'agents_models',
    kinds: ['agent_not_found', 'named_role_by_general_purpose', 'model_less_dispatch', 'agent_off_pin'],
  },
  {
    family: 'skills_offers',
    kinds: ['required_skill_missing', 'agent_skill_missing', 'offer_not_recorded', 'typed_skill_not_loaded'],
  },
  { family: 'sessions', kinds: ['startup_missing', 'unrecorded_session'] },
];

/** A warning kind's family, 'other' for a kind no family holds or a warning stored with no kind. */
export function familyOf(kind: string | null): string {
  return FAMILIES.find((f) => kind !== null && f.kinds.includes(kind))?.family ?? OTHER;
}

/**
 * The Compliance page: the warnings in the query's period, by kind and week: the current ones (currentWarnings), and
 * with `resolved` every other stored warning. A run's warning is in the period when its run is (period), in its run's week; a
 * session's, of any path or project, in the week it was first seen. `step` keeps the warnings naming that step. The
 * rows are the kinds with a warning, in FAMILIES' order, then "other" kinds, the one with no kind last. With a scope,
 * the "other" rows are left out (an unknown kind can name anything) and the family rows' cells still count every
 * warning, but the list holds only the shown projects' run warnings outside "other", masked (showFacts, showWarning),
 * and `hidden` counts every warning in the period left out of the list.
 */
export function complianceView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  warnings: StoredWarning[];
  query: ComplianceQuery;
  now: Date;
  seenAt: Date | null;
  scope: Scope | null;
}): ComplianceResponse {
  const { query, seenAt, scope } = input;
  const { weeks, matches } = period(query, input.now);
  const names = storedNames(input.runs);
  const runs = new Map(input.runs.map((unit) => [unit.key, { unit, facts: storedFacts(unit, names) }]));
  const current = new Set(currentWarnings(input.runs, input.sessions, input.warnings));

  const inPeriod = input.warnings.flatMap((w) => {
    if ((!query.resolved && !current.has(w)) || (query.step && w.stepKind !== query.step)) return [];
    const run = w.kind === 'run' ? runs.get(w.key) : undefined;
    if (w.kind === 'run' && !(run && matches(run.facts))) return [];
    // Stored runs always have a finish time: the import skips a run without one.
    const week = weekOf(run ? parseTime(run.facts.finishedAt!) : w.firstSeenAt);
    return weeks.includes(week) ? [{ w, run, week, family: familyOf(w.warningKind) }] : [];
  });

  const others = new Set(inPeriod.filter((x) => x.family === OTHER).map((x) => x.w.warningKind));
  const rowKeys = [
    ...FAMILIES.flatMap(({ family, kinds }) => kinds.map((kind) => ({ family, kind }))),
    ...[...others].filter((kind): kind is string => kind !== null).sort().map((kind) => ({ family: OTHER, kind })),
    ...(others.has(null) ? [{ family: OTHER, kind: null }] : []),
  ];
  // Each kind's count by week in one pass; a kind with no warning in the period gets no row, nor, with a scope, an
  // "other" kind, which can name anything.
  const counts = new Map<string | null, number[]>();
  for (const x of inPeriod) {
    const cells = counts.get(x.w.warningKind) ?? weeks.map(() => 0);
    cells[weeks.indexOf(x.week)] += 1;
    counts.set(x.w.warningKind, cells);
  }
  const rows: ComplianceRow[] = rowKeys.flatMap(({ family, kind }) => {
    const cells = counts.get(kind);
    return cells && !(scope && family === OTHER) ? [{ family, kind, cells }] : [];
  });

  const warnings = inPeriod.flatMap(({ w, run, week, family }): ComplianceWarning[] => {
    const facts = run && showFacts(scope, run.facts);
    if (scope && (!facts || family === OTHER)) return [];
    return [
      {
        kind: w.warningKind,
        family,
        week,
        ...showWarning(scope, w.text),
        runKey: run?.unit.key ?? null,
        project: facts?.project ?? null,
        branch: facts?.branch ?? null,
        step: toStepKind(w.stepKind) ?? null,
        isNew: seenAt === null || w.firstSeenAt > seenAt,
      },
    ];
  });

  return { weeks, rows, warnings, hidden: inPeriod.length - warnings.length };
}
