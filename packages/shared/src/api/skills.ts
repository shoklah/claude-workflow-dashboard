/** A skill's loads, as the reporter's skill_totals counts them: the units (runs and sessions alike) that loaded it,
 * its latest load's time, and its loads by skillOutcomeLabel's label. */
export type SkillRow = { name: string; runs: number; last: string | null; outcomes: Record<string, number> };

/** `GET /api/skills`: the period's skills by name, each with `missing`, the reporter's all-time count of the times it
 * was required and missing, from the latest export's totals; null when they have none. */
export type SkillsResponse = { skills: (SkillRow & { missing: number | null })[] };
