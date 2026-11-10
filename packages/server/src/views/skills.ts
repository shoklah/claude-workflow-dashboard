import {
  parseTime,
  ReportSchema,
  weekOf,
  type FindingsQuery,
  type RunEntry,
  type SessionEntry,
  type SkillRow,
  type SkillsResponse,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { period, skillOutcomeLabel, storedFacts, storedNames } from './runs.ts';

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
 * matching its path and project filters and of every session, each skill with the reporter's all-time missing count
 * from the latest export's `totals`. Skill names and counts name no project, so showing mode changes nothing here.
 */
export function skillsView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  totals: unknown;
  query: FindingsQuery;
  now: Date;
}): SkillsResponse {
  const { weeks, filters } = period(input.query, input.now);
  const names = storedNames(input.runs);
  const inPeriod = (unit: Loads): Loads => ({
    skills: (unit.skills ?? []).filter((s) => s.time && weeks.includes(weekOf(parseTime(s.time)))),
  });
  const units = [
    ...input.runs.filter((run) => filters(storedFacts(run, names))),
    ...input.sessions,
  ].map((unit) => inPeriod(unit.merged));
  const missing = ReportSchema.shape.totals.pick({ skills: true }).safeParse(input.totals).data?.skills;
  return { skills: skillSums(units).map((row) => ({ ...row, missing: missing?.[row.name]?.missing ?? null })) };
}
