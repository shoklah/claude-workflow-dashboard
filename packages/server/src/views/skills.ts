import {
  parseTime,
  weekOf,
  type FindingsQuery,
  type RunEntry,
  type SessionEntry,
  type SkillRow,
  type SkillsResponse,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { addCount, period, periodUnits, skillOutcomeLabel, storedFacts, storedNames } from './runs.ts';
import { maskText, type Scope } from './scope.ts';

type SkillUnit = { skills?: RunEntry['skills']; missing_skills?: RunEntry['missing_skills']; typed?: RunEntry['typed'] };

/** The skill a slash command names: `x:y` (a plugin skill's command) names `y`, any other its own name. */
export function commandSkill(name: string | null | undefined): string {
  return (name ?? '').split(':').at(-1) ?? '';
}

/**
 * Each skill by name, as the reporter's skill_totals: the units (runs and sessions alike) that loaded it, its latest
 * load and its loads by skillOutcomeLabel, from `units`; and the times it was required and missing, a run's missing
 * skill or a typed trigger never met, from `missingFrom` (`units` unless given), a skill only missing getting a row
 * with no loads.
 */
export function skillSums(units: SkillUnit[], missingFrom: SkillUnit[] = units): SkillRow[] {
  const rows = new Map<string, SkillRow>();
  const row = (name: string) => {
    if (!rows.has(name)) rows.set(name, { name, runs: 0, last: null, outcomes: {}, missing: 0 });
    return rows.get(name)!;
  };
  for (const unit of units) {
    const skills = unit.skills ?? [];
    for (const name of new Set(skills.map((s) => s.name ?? ''))) row(name).runs += 1;
    for (const s of skills) {
      const entry = row(s.name ?? '');
      if (s.time && (entry.last === null || parseTime(s.time) > parseTime(entry.last))) entry.last = s.time;
      const label = skillOutcomeLabel(s.outcome);
      addCount(entry.outcomes, label);
    }
  }
  for (const unit of missingFrom) {
    for (const name of unit.missing_skills ?? []) row(name).missing += 1;
    for (const t of unit.typed ?? []) if (t.met === false) row(t.skill ?? '').missing += 1;
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The Skills page: skillSums over the loads in the query's period (period's weeks, by each load's time), of the runs
 * matching its path and project filters and of every session, with each skill's missing count over the period's runs
 * and sessions (periodUnits). With a scope, each skill name is masked (maskText) first, so names that mask alike merge
 * and the sums still count every project.
 */
export function skillsView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  query: FindingsQuery;
  now: Date;
  scope: Scope | null;
}): SkillsResponse {
  const { weeks, filters } = period(input.query, input.now);
  const names = storedNames(input.runs);
  const mask = (name: string | null | undefined) => maskText(input.scope, name ?? '');
  const inPeriod = (unit: SkillUnit): SkillUnit => ({
    skills: (unit.skills ?? [])
      .filter((s) => s.time && weeks.includes(weekOf(parseTime(s.time))))
      .map((s) => ({ ...s, name: mask(s.name) })),
  });
  const loads = [
    ...input.runs.filter((run) => filters(storedFacts(run, names))),
    ...input.sessions,
  ].map((unit) => inPeriod(unit.merged));
  const units = periodUnits(input.runs, input.sessions, input.query, input.now);
  const inUnits: SkillUnit[] = [...units.runs, ...units.sessions];
  const missing = inUnits.map((unit) => ({
    missing_skills: unit.missing_skills?.map(mask),
    typed: unit.typed?.map((t) => ({ ...t, skill: mask(t.skill) })),
  }));
  return { skills: skillSums(loads, missing) };
}
