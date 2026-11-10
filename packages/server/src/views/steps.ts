import {
  STEP_KINDS,
  toStepKind,
  type AdvisorFacts,
  type FindingsQuery,
  type RuleSums,
  type RunEntry,
  type SessionEntry,
  type StepKind,
  type StepRow,
  type StepsResponse,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { addCount, periodUnits } from './runs.ts';
import { maskText, type Scope } from './scope.ts';

// The reporter's token labels, its failing-test results (TEST_RESULTS) and its offer outcomes (OFFER_OUTCOMES).
const TOKENS = ['input', 'output', 'cache_read', 'cache_write'] as const;
const TEST_RESULTS = ['passed', 'failed', 'no_tests', 'couldnt_run', 'exempt'];
const OFFER_OUTCOMES = ['accepted', 'skipped', 'not_offered', 'updated'];

const zeros = (keys: readonly string[]) => Object.fromEntries(keys.map((key) => [key, 0]));
// A record with its keys in order, as the reporter's dict(sorted(...)).
const byKey = <T>(record: Record<string, T>) =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : 1)));

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
    offers: byKey(offers),
  };
}

/** unitSums' figures: the Steps page's rules shows the refusals and startup, and the Models page the advisor. */
export type UnitSums = Pick<StepsResponse['rules'], 'dispatchGuard' | 'startup'> & { advisor: AdvisorFacts | null };

/** Whether the stored units are CR6's: some session carries `refusals` (`sessions`), some advisor `by_role` (`advisor`). */
export type Cr6 = { sessions: boolean; advisor: boolean };

/** Cr6 over every stored unit, never a period's, so a period with no session still sums its runs' refusals. */
export function cr6Of(runs: RunEntry[], sessions: SessionEntry[]): Cr6 {
  return {
    sessions: sessions.some((s) => s.refusals != null),
    advisor: [...runs, ...sessions].some((unit) => unit.advisor?.by_role != null),
  };
}

/**
 * The units' dispatch-guard refusals, startup guidelines and advisor, as the reporter's scoreboard and advisor_facts
 * sum them over runs and sessions alike (CR6): the refusals by reason, the sessions with and without the startup
 * guidelines, and the advisor's facts and notes, its share of the advisor and Fable dollars as share_pct gives it.
 * Each is null on an export from before CR6, as `cr6` (cr6Of over every stored unit) tells: the refusals and startup
 * unless `sessions`, the advisor unless `advisor`; on CR6 data, units with nothing sum to zeros, and a unit's advisor
 * with no `by_role` (stored before CR6) is not summed. `name` maps each refusal key, role label and failed code as it is
 * summed (a view's maskText under a scope), so keys that map alike merge.
 */
export function unitSums(
  runs: RunEntry[],
  sessions: SessionEntry[],
  cr6: Cr6,
  name: (label: string) => string = (label) => label,
): UnitSums {
  const units = [...runs, ...sessions];
  const guard: Record<string, number> = {};
  for (const unit of units) for (const [key, n] of Object.entries(unit.refusals ?? {})) addCount(guard, name(key), n);
  const startup = { with: 0, without: 0 };
  for (const s of sessions) startup[s.startup ? 'with' : 'without'] += 1;
  let advisor: AdvisorFacts | null = null;
  if (cr6.advisor) {
    const sums: Omit<AdvisorFacts, 'share'> = {
      calls: 0,
      cost: 0,
      tokens: zeros(TOKENS),
      byRole: {},
      failed: {},
      notes: 0,
      changed: 0,
      missing: 0,
    };
    let fable = 0;
    for (const { advisor: a, notes } of units) {
      sums.notes += notes?.notes ?? 0;
      sums.changed += notes?.changed ?? 0;
      sums.missing += notes?.missing ?? 0;
      // A stored advisor from before CR6 has no by_role, and is not summed beside CR6's.
      if (!a?.by_role) continue;
      sums.calls += a.calls ?? 0;
      sums.cost += a.cost ?? 0;
      for (const [label, n] of Object.entries(a.tokens ?? {})) addCount(sums.tokens, label, n);
      for (const [label, role] of Object.entries(a.by_role ?? {})) {
        const row = (sums.byRole[name(label)] ??= { calls: 0, flagged: false });
        row.calls += role.calls ?? 0;
        row.flagged ||= role.flagged ?? false;
      }
      for (const [code, n] of Object.entries(a.failed ?? {})) addCount(sums.failed, name(code), n);
      for (const week of a.weeks ?? []) fable += week.fable ?? 0;
    }
    const total = sums.cost + fable;
    const share = total > 0 ? (100 * sums.cost) / total : 0;
    advisor = { ...sums, byRole: byKey(sums.byRole), failed: byKey(sums.failed), share };
  }
  return { dispatchGuard: cr6.sessions ? byKey(guard) : null, startup: cr6.sessions ? startup : null, advisor };
}

/**
 * The Steps and rules page: each step kind and rule summed over the stored runs in the query's period, and the
 * dispatch-guard refusals, startup guidelines (null under a path filter) and advisor over its runs and sessions
 * (periodUnits, unitSums, with cr6Of over every stored unit). The sums
 * count every project; with a scope, each offer's skill and refusal key is masked (maskText) first, so names that mask
 * alike merge.
 */
export function stepsView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  query: FindingsQuery;
  now: Date;
  scope: Scope | null;
}): StepsResponse {
  const units = periodUnits(input.runs, input.sessions, input.query, input.now);
  const runs = units.runs.map((run) => ({
    ...run,
    offers: run.offers?.map((o) => ({ ...o, skill: maskText(input.scope, o.skill) })),
  }));
  const cr6 = cr6Of(
    input.runs.map((unit) => unit.merged),
    input.sessions.map((unit) => unit.merged),
  );
  const { advisor, dispatchGuard, startup } = unitSums(units.runs, units.sessions, cr6, (label) =>
    maskText(input.scope, label),
  );
  return {
    steps: stepSums(runs),
    rules: {
      ...ruleSums(runs),
      dispatchGuard,
      // A session has no path, so a path filter leaves none to count.
      startup: input.query.path ? null : startup,
      advisor: advisor && {
        calls: advisor.calls,
        notes: advisor.notes,
        changed: advisor.changed,
        cost: advisor.cost,
        share: advisor.share,
      },
    },
  };
}
