import {
  parseTime,
  reporterTotals,
  weekOf,
  type FindingsQuery,
  type RunEntry,
  type SessionEntry,
  type SkillRow,
  type SkillsResponse,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { period, skillOutcomeLabel, storedFacts, storedNames } from './runs.ts';
import { maskText, type Scope } from './scope.ts';

type Loads = { skills?: RunEntry['skills'] };

/**
 * Each skill the units loaded, by name, as the reporter's skill_totals: the units (runs and sessions alike) that
 * loaded it, its latest load, and its loads by skillOutcomeLabel.
 */
export function skillSums(units: Loads[]): SkillRow[] {
  const rows = new Map<string, SkillRow>();
  const row = (name: string) => {
    if (!rows.has(name)) rows.set(name, { name, runs: 0, last: null, outcomes: {} });
    return rows.get(name)!;
  };
  for (const unit of units) {
    const skills = unit.skills ?? [];
    for (const name of new Set(skills.map((s) => s.name ?? ''))) row(name).runs += 1;
    for (const s of skills) {
      const entry = row(s.name ?? '');
      if (s.time && (entry.last === null || parseTime(s.time) > parseTime(entry.last))) entry.last = s.time;
      const label = skillOutcomeLabel(s.outcome);
      entry.outcomes[label] = (entry.outcomes[label] ?? 0) + 1;
    }
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The Skills page: skillSums over the loads in the query's period (period's weeks, by each load's time), of the runs
 * matching its path and project filters and of every session, then a row with no loads for each skill the latest
 * export's `totals` count as required but missing that no unit loaded in the period, as skill_totals makes one; each
 * row with the reporter's all-time missing count. With a scope, each skill name is masked (maskText) first, so names
 * that mask alike merge and the sums still count every project.
 */
export function skillsView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  totals: unknown;
  query: FindingsQuery;
  now: Date;
  scope: Scope | null;
}): SkillsResponse {
  const { weeks, filters } = period(input.query, input.now);
  const names = storedNames(input.runs);
  const mask = (name: string) => (input.scope ? maskText(input.scope, name) : name);
  const inPeriod = (unit: Loads): Loads => ({
    skills: (unit.skills ?? [])
      .filter((s) => s.time && weeks.includes(weekOf(parseTime(s.time))))
      .map((s) => ({ ...s, name: mask(s.name ?? '') })),
  });
  const units = [
    ...input.runs.filter((run) => filters(storedFacts(run, names))),
    ...input.sessions,
  ].map((unit) => inPeriod(unit.merged));
  const totals = reporterTotals(input.totals)?.skills;
  const missing = new Map<string, number>();
  for (const [name, row] of Object.entries(totals ?? {})) {
    if (row.missing != null) missing.set(mask(name), (missing.get(mask(name)) ?? 0) + row.missing);
  }
  const rows = skillSums(units);
  const loaded = new Set(rows.map((row) => row.name));
  for (const [name, count] of missing) {
    if (count > 0 && !loaded.has(name)) rows.push({ name, runs: 0, last: null, outcomes: {} });
  }
  return {
    skills: rows
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => ({ ...row, missing: missing.get(row.name) ?? null })),
    missingSource: 'reporter',
  };
}
