import {
  reporterTotals,
  STEP_KINDS,
  toStepKind,
  type FindingsQuery,
  type RuleSums,
  type RunEntry,
  type StepKind,
  type StepRow,
  type StepsResponse,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { addCount, periodRuns } from './runs.ts';
import { maskText, type Scope } from './scope.ts';

// The reporter's token labels, its failing-test results (TEST_RESULTS) and its offer outcomes (OFFER_OUTCOMES).
const TOKENS = ['input', 'output', 'cache_read', 'cache_write'] as const;
const TEST_RESULTS = ['passed', 'failed', 'no_tests', 'couldnt_run', 'exempt'];
const OFFER_OUTCOMES = ['accepted', 'skipped', 'not_offered', 'updated'];

const zeros = (keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, 0]));

/**
 * One row per step kind, as the reporter's scoreboard: each logged step adds to its kind, and a schema 1 run adds its
 * final review from `final_findings`, and its simplify when `simplify.ran` is agents or inline. Tokens and cost come
 * from the dispatches of that kind with `models`; simplify's are null, since no dispatch tells its spend.
 */
export function stepSums(runs: RunEntry[]): StepRow[] {
  const rows = new Map<StepKind, StepRow>(
    STEP_KINDS.map((step) => [
      step,
      {
        step,
        ran: 0,
        found: 0,
        counts: {},
        fixedOrApplied: 0,
        declined: 0,
        deferred: 0,
        openOrToOwner: 0,
        tokens: step === 'simplify' ? null : zeros(TOKENS),
        cost: step === 'simplify' ? null : 0,
      },
    ]),
  );
  // A step that ran with these counts; it found something when any count isn't 0.
  const add = (step: StepKind, counts: Record<string, number | null | undefined>) => {
    const row = rows.get(step)!;
    row.ran += 1;
    if (Object.values(counts).some(Boolean)) row.found += 1;
    for (const [key, n] of Object.entries(counts)) addCount(row.counts, key, n ?? 0);
  };
  for (const run of runs) {
    for (const step of run.steps ?? []) {
      if (!step.step) continue;
      add(step.step, step.counts ?? {});
      const row = rows.get(step.step)!;
      for (const { outcome } of step.findings ?? []) {
        if (outcome === 'fixed' || outcome === 'applied') row.fixedOrApplied += 1;
        else if (outcome === 'declined') row.declined += 1;
        else if (outcome === 'deferred') row.deferred += 1;
        else if (outcome === 'open' || outcome === 'to_owner') row.openOrToOwner += 1;
      }
    }
    if ((run.schema ?? 1) < 2) {
      add('final_review', run.final_findings ?? {});
      const simplify = run.simplify;
      if (simplify?.ran === 'agents' || simplify?.ran === 'inline') {
        add('simplify', { applied: simplify.applied, skipped: simplify.skipped });
      }
    }
    for (const dispatch of run.dispatches ?? []) {
      const kind = toStepKind(dispatch.kind);
      const row = kind && rows.get(kind);
      if (!row?.tokens || !dispatch.models) continue;
      for (const m of Object.values(dispatch.models)) {
        for (const label of TOKENS) row.tokens[label] += m[label] ?? 0;
        // A model the reporter has no price for adds tokens only.
        row.cost! += m.cost ?? 0;
      }
    }
  }
  return [...rows.values()];
}

/**
 * The rules, as the reporter's scoreboard: the records' failing-test results (only the reporter's five, as read_runs
 * keeps them), the runs with a round 3 step and the findings ruled, the records' stops, and the offers by skill as
 * offer_totals counts them.
 */
export function ruleSums(runs: RunEntry[]): RuleSums {
  const failingTest = zeros(TEST_RESULTS);
  const offers: RuleSums['offers'] = {};
  let stopRule = 0;
  for (const run of runs) {
    for (const { result } of run.record?.failing_test ?? []) {
      if (result && TEST_RESULTS.includes(result)) failingTest[result] += 1;
    }
    stopRule += run.record?.stops ?? 0;
    for (const { skill, outcome } of run.offers ?? []) {
      if (!skill || !outcome || !OFFER_OUTCOMES.includes(outcome)) continue;
      const row = (offers[skill] ??= { offered: 0, ...zeros(OFFER_OUTCOMES) });
      row[outcome] += 1;
      if (outcome === 'accepted' || outcome === 'skipped') row.offered += 1;
    }
  }
  const steps = runs.map((run) => run.steps ?? []);
  return {
    failingTest,
    fixRoundCap: {
      runs: steps.filter((of) => of.some((s) => s.round === 3)).length,
      ruled: steps.flat().flatMap((s) => s.findings ?? []).filter((f) => f.outcome === 'ruled').length,
    },
    stopRule,
    offers: Object.fromEntries(Object.entries(offers).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
}

/**
 * The Steps and rules page: each step kind and rule summed over the stored runs in the query's period (period), and
 * the reporter's all-time figures from `totals`, the last good import's (dispatch-guard refusals, the advisor and the
 * startup guidelines), each null when the export has none. The sums count every project; with a scope, each offer's
 * skill is masked (maskText) first, so names that mask alike merge.
 */
export function stepsView(input: {
  runs: StoredUnit<RunEntry>[];
  totals: unknown;
  query: FindingsQuery;
  now: Date;
  scope: Scope | null;
}): StepsResponse {
  const runs = periodRuns(input.runs, input.query, input.now).runs.map((run) => ({
    ...run,
    offers: run.offers?.map((o) => ({ ...o, skill: maskText(input.scope, o.skill) })),
  }));
  const board = reporterTotals(input.totals)?.scoreboard;
  const advisor = board?.advisor;
  const startup = board?.startup;
  return {
    steps: stepSums(runs),
    rules: ruleSums(runs),
    reporter: {
      source: 'reporter',
      dispatchGuard: board?.dispatch_guard ?? null,
      advisor: advisor
        ? {
            calls: advisor.calls ?? null,
            notes: advisor.notes ?? null,
            changed: advisor.changed ?? null,
            cost: advisor.cost ?? null,
            share: advisor.share ?? null,
          }
        : null,
      startup: startup ? { with: startup.with ?? null, without: startup.without ?? null } : null,
    },
  };
}
