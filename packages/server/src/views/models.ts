import {
  PATHS,
  reporterTotals,
  toPath,
  type FindingsQuery,
  type ModelsResponse,
  type Path,
  type RunEntry,
  type SessionEntry,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { addCount, periodUnits } from './runs.ts';
import { maskText, type Scope } from './scope.ts';
import { cr6Of, unitSums } from './steps.ts';

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
 * The Models and advisor page: modelSums over the stored runs in the query's period (period), the advisor's facts
 * over its runs and sessions (periodUnits, unitSums), with the reporter's all-time figures from `totals`, the last good
 * import's: each agent's mismatches, each path's stage table and differs, and the advisor's trial and its weeks, only
 * those of the period. An agent with mismatches that no dispatch in the period names gets a row with no dispatches,
 * as Skills keeps a skill required but missing. With a scope, each name from the units (agents, models, efforts, the
 * advisor's roles and failed codes) is masked (maskText), so names that mask alike merge and the sums still count
 * every project.
 */
export function modelsView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  totals: unknown;
  query: FindingsQuery;
  now: Date;
  scope: Scope | null;
}): ModelsResponse {
  const { weeks, runs: inPeriod, sessions } = periodUnits(input.runs, input.sessions, input.query, input.now);
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
    const masked = maskText(input.scope, name);
    if (row.mismatches != null) addCount(mismatches, masked, row.mismatches);
    if (row.mismatches) sums.agents[masked] ??= { requested: {}, actual: {} };
  }
  const advisor = totals?.advisor;
  const facts = unitSums(
    runs,
    sessions,
    cr6Of(
      input.runs.map((unit) => unit.merged),
      input.sessions.map((unit) => unit.merged),
    ),
    (label) => maskText(input.scope, label),
  ).advisor;
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
      facts,
      reporter: {
        source: 'reporter',
        trial: advisor?.trial ?? null,
        weeks: (advisor?.weeks ?? []).flatMap(({ week, ...w }) =>
          week && weeks.includes(week)
            ? [{ week, advisor: w.advisor ?? null, fable: w.fable ?? null, share: w.share ?? null, stop: w.stop ?? null }]
            : [],
        ),
      },
    },
  };
}
