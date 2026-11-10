import {
  PATHS,
  reporterTotals,
  toPath,
  type AdvisorFacts,
  type FindingsQuery,
  type ModelsResponse,
  type Path,
  type RunEntry,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { addCount, periodRuns } from './runs.ts';
import { maskText, type Scope } from './scope.ts';

type ModelSums = {
  agents: Record<string, { requested: Record<string, number>; actual: Record<string, number> }>;
  main: Record<Path, Record<string, number>>;
};

// A model and effort as the reporter's model_totals pairs them, '-' for a side that isn't known.
const pair = (model: string | null | undefined, effort: string | null | undefined) => `${model || '-'}/${effort || '-'}`;

/**
 * The runs' models as the reporter's model_totals counts them: per agent type (a dispatch with none is
 * general-purpose), the `model/effort` pairs its dispatches asked for and ran on; per path, by the record's, the pairs
 * its main sessions ran on.
 */
export function modelSums(runs: RunEntry[]): ModelSums {
  const sums: ModelSums = { agents: {}, main: { small: {}, full: {}, plan: {} } };
  for (const run of runs) {
    for (const d of run.dispatches ?? []) {
      const row = (sums.agents[d.agent || 'general-purpose'] ??= { requested: {}, actual: {} });
      addCount(row.requested, pair(d.requested_model, d.requested_effort));
      addCount(row.actual, pair(d.model, d.effort));
    }
    const path = toPath(run.record?.path);
    if (path && run.main) addCount(sums.main[path], pair(run.main.model, run.main.effort));
  }
  return sums;
}

/**
 * The Models and advisor page: modelSums over the stored runs in the query's period (period), with the reporter's
 * all-time figures from `totals`, the last good import's: each agent's mismatches, each path's stage table and differs,
 * and the advisor's facts, its weeks only those of the period. An agent with mismatches that no dispatch in the period
 * names gets a row with no dispatches, as Skills keeps a skill required but not loaded. With a scope, each name from the units (agents, models,
 * efforts, the advisor's roles and failed codes) is masked (maskText) first, so names that mask alike merge and the
 * sums still count every project.
 */
export function modelsView(input: {
  runs: StoredUnit<RunEntry>[];
  totals: unknown;
  query: FindingsQuery;
  now: Date;
  scope: Scope | null;
}): ModelsResponse {
  const { weeks, runs: inPeriod } = periodRuns(input.runs, input.query, input.now);
  const runs = inPeriod.map((run) => ({
      ...run,
      dispatches: run.dispatches?.map((d) => ({
        ...d,
        agent: maskText(input.scope, d.agent),
        requested_model: maskText(input.scope, d.requested_model),
        requested_effort: maskText(input.scope, d.requested_effort),
        model: maskText(input.scope, d.model),
        effort: maskText(input.scope, d.effort),
      })),
      main: run.main && { model: maskText(input.scope, run.main.model), effort: maskText(input.scope, run.main.effort) },
    }));
  const sums = modelSums(runs);
  const totals = reporterTotals(input.totals);
  const mismatches: Record<string, number> = {};
  for (const [name, row] of Object.entries(totals?.models?.agents ?? {})) {
    if (row.mismatches != null) addCount(mismatches, maskText(input.scope, name), row.mismatches);
  }
  for (const [name, count] of Object.entries(mismatches)) {
    if (count > 0) sums.agents[name] ??= { requested: {}, actual: {} };
  }
  const advisor = totals?.advisor;
  let facts: AdvisorFacts | null = null;
  if (advisor) {
    const byRole: AdvisorFacts['byRole'] = {};
    for (const [label, role] of Object.entries(advisor.by_role ?? {})) {
      const row = (byRole[maskText(input.scope, label)] ??= { calls: 0, flagged: false });
      row.calls += role.calls ?? 0;
      row.flagged ||= role.flagged ?? false;
    }
    const failed: Record<string, number> = {};
    for (const [code, n] of Object.entries(advisor.failed ?? {})) addCount(failed, maskText(input.scope, code), n);
    facts = {
      calls: advisor.calls ?? null,
      tokens: advisor.tokens ?? null,
      cost: advisor.cost ?? null,
      byRole,
      failed,
      notes: advisor.notes ?? null,
      changed: advisor.changed ?? null,
      missing: advisor.missing ?? null,
      trial: advisor.trial ?? null,
    };
  }
  return {
    agents: Object.entries(sums.agents)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, row]) => ({ name, ...row, mismatches: mismatches[name] ?? null })),
    mismatchesSource: 'reporter',
    main: PATHS.map((path) => {
      const row = totals?.models?.main?.[path];
      return { path, recommended: row?.recommended ?? null, actual: sums.main[path], differs: row?.differs ?? null };
    }),
    stageSource: 'reporter',
    advisor: {
      source: 'reporter',
      facts,
      weeks: (advisor?.weeks ?? []).flatMap(({ week, ...w }) =>
        week && weeks.includes(week)
          ? [{ week, advisor: w.advisor ?? null, fable: w.fable ?? null, share: w.share ?? null, stop: w.stop ?? null }]
          : [],
      ),
    },
  };
}
