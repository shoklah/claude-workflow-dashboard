import {
  parseTime,
  weekOf,
  type RunEntry,
  type SessionEntry,
  type SpendGroup,
  type SpendGroupRow,
  type SpendQuery,
  type SpendResponse,
  type SpendRow,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { periodUnits } from './runs.ts';
import { maskText, type Scope } from './scope.ts';

/** The app's grouping of the reporter's phases; a name it doesn't hold counts under 'unattributed'. */
export const SPEND_GROUPS: Record<SpendGroup, string[]> = {
  plan: ['design', 'plan_writing', 'plan_simplify', 'plan_review'],
  implement: ['implement'],
  review: ['task_review', 'fix_check', 'simplify', 'final_review', 'final_fix_check'],
  coordination: ['coordination'],
  unattributed: ['unattributed'],
};

const GROUPS = Object.keys(SPEND_GROUPS) as SpendGroup[];

/** A phase's group in SPEND_GROUPS, 'unattributed' for a name it doesn't hold. */
export function groupOf(phase: string): SpendGroup {
  return GROUPS.find((group) => SPEND_GROUPS[group].includes(phase)) ?? 'unattributed';
}

type PhaseCell = { byModel: Record<string, number | null>; advisor: { calls: number; cost: number } };

export type PhaseSums = {
  phases: Record<string, PhaseCell>;
  uncounted: { runs: number; sessions: number };
};

/** Adds a model's cost to a cell's: absent until seen, null only while every cost seen for it is null. */
function addCost(byModel: Record<string, number | null>, model: string, cost: number | null | undefined): void {
  if (cost == null) {
    if (!(model in byModel)) byModel[model] = null;
  } else byModel[model] = (byModel[model] ?? 0) + cost;
}

/** Adds a cell's models and advisor into `into`. */
function addCell(into: PhaseCell, cell: PhaseCell): void {
  for (const [model, cost] of Object.entries(cell.byModel)) addCost(into.byModel, model, cost);
  into.advisor.calls += cell.advisor.calls;
  into.advisor.cost += cell.advisor.cost;
}

const emptyCell = (): PhaseCell => ({ byModel: {}, advisor: { calls: 0, cost: 0 } });

/**
 * Spend by phase per week start date, over the units given: a run in its record's week, a session in its start's (a
 * unit with no such time counts nowhere). A unit with no `phases` counts in its week's `uncounted`; each model is named
 * by `name` before summing.
 */
export function phaseSums(
  runs: RunEntry[],
  sessions: SessionEntry[],
  name: (model: string) => string = (model) => model,
): Map<string, PhaseSums> {
  const sums = new Map<string, PhaseSums>();
  const units = [
    ...runs.map((run) => ({ unit: run, time: run.record?.date, kind: 'runs' as const })),
    ...sessions.map((session) => ({ unit: session, time: session.start, kind: 'sessions' as const })),
  ];
  for (const { unit, time, kind } of units) {
    if (!time) continue;
    const week = weekOf(parseTime(time));
    const sum = sums.get(week) ?? { phases: {}, uncounted: { runs: 0, sessions: 0 } };
    sums.set(week, sum);
    if (unit.phases == null) {
      sum.uncounted[kind] += 1;
      continue;
    }
    for (const phase of unit.phases) {
      const cell = (sum.phases[phase.name] ??= emptyCell());
      for (const [model, usage] of Object.entries(phase.models ?? {})) addCost(cell.byModel, name(model), usage.cost);
      cell.advisor.calls += phase.advisor?.calls ?? 0;
      cell.advisor.cost += phase.advisor?.cost ?? 0;
    }
  }
  return sums;
}

/** A cell's priced cost. */
const costOf = (cell: PhaseCell) => Object.values(cell.byModel).reduce<number>((sum, cost) => sum + (cost ?? 0), 0);

/**
 * The Spend page: the period's units (periodUnits), runs only or sessions only as `units` asks (under a path, sessions
 * are already out), summed by phaseSums with each model masked (maskText); every period week with its cost by group, a
 * week with no sums 0; the five groups with their phases, a phase name no group holds masked; every row's `byModel`
 * dense over `models`, null for a model unpriced across the period. Sums count every project.
 */
export function spendView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  query: SpendQuery;
  now: Date;
  scope: Scope | null;
}): SpendResponse {
  const { query, scope } = input;
  const units = periodUnits(input.runs, input.sessions, query, input.now);
  const runs = query.units === 'sessions' && !query.path ? [] : units.runs;
  const sessions = query.units === 'runs' ? [] : units.sessions;
  const sums = phaseSums(runs, sessions, (model) => maskText(scope, model));

  // The period's cells by raw phase name, in first-seen order, and the period's total.
  const phases = new Map<string, PhaseCell>();
  const all = emptyCell();
  for (const week of units.weeks) {
    for (const [name, cell] of Object.entries(sums.get(week)?.phases ?? {})) {
      if (!phases.has(name)) phases.set(name, emptyCell());
      addCell(phases.get(name)!, cell);
      addCell(all, cell);
    }
  }

  const models = Object.keys(all.byModel).sort((a, b) => (all.byModel[b] ?? -1) - (all.byModel[a] ?? -1));
  const total = costOf(all);
  const rowOf = (cell: PhaseCell, share: boolean): SpendRow => {
    const cost = costOf(cell);
    return {
      cost,
      share: share && total ? (100 * cost) / total : null,
      byModel: Object.fromEntries(models.map((m) => [m, all.byModel[m] === null ? null : (cell.byModel[m] ?? 0)])),
      advisor: cell.advisor,
    };
  };

  const groups = GROUPS.map((group): SpendGroupRow => {
    const known = SPEND_GROUPS[group].filter((name) => phases.has(name));
    const unknown = [...phases.keys()].filter((name) => groupOf(name) === group && !known.includes(name));
    const cell = emptyCell();
    const rows = [...known, ...unknown].map((name) => {
      addCell(cell, phases.get(name)!);
      return { ...rowOf(phases.get(name)!, true), name: unknown.includes(name) ? maskText(scope, name) : name };
    });
    return { ...rowOf(cell, true), group, phases: rows };
  });

  const weeks = units.weeks.map((week) => {
    const sum = sums.get(week);
    const byGroup = Object.fromEntries(GROUPS.map((group) => [group, 0])) as Record<SpendGroup, number>;
    for (const [name, cell] of Object.entries(sum?.phases ?? {})) byGroup[groupOf(name)] += costOf(cell);
    const weekTotal = Object.values(byGroup).reduce((a, b) => a + b, 0);
    return { week, groups: byGroup, total: weekTotal, uncounted: sum?.uncounted ?? { runs: 0, sessions: 0 } };
  });

  // The first week after the last one with an uncounted unit; null when that is the last week.
  const last = weeks.findLastIndex((w) => w.uncounted.runs + w.uncounted.sessions > 0);
  return {
    weeks,
    groups,
    total: rowOf(all, false),
    models,
    unpriced: Object.values(all.byModel).includes(null),
    fullFrom: weeks[last + 1]?.week ?? null,
  };
}
