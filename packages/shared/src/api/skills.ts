/** A skill over the units, as the reporter's skill_totals: the units (runs and sessions alike) that loaded it, its
 * latest load's time, its loads by skillOutcomeLabel's label, and `missing`, the times it was required and missing (a
 * run's missing skill, or a unit's typed trigger never met). */
export type SkillRow = {
  name: string;
  runs: number;
  last: string | null;
  outcomes: Record<string, number>;
  missing: number;
};

/** `GET /api/skills`: the period's skills by name, then those required but missing with no load in it. */
export type SkillsResponse = { skills: SkillRow[] };
