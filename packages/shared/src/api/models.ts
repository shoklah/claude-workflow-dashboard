import type { Path } from '../report.ts';

/** An agent type's dispatches over a period, as the reporter's model_totals: their `model/effort` pairs as asked for
 * and as run (none for an agent with mismatches but no dispatch in the period), and `mismatches`, the reporter's
 * all-time count of those that ran off their request. */
export type AgentModels = {
  name: string;
  requested: Record<string, number>;
  actual: Record<string, number>;
  mismatches: number | null;
};

/** A path's main sessions over a period: the reporter's stage table (`model/effort` by stage), the `model/effort`
 * pairs they ran on, and `differs`, the reporter's all-time count of those off the stage table. */
export type MainModels = {
  path: Path;
  recommended: Record<string, string | null | undefined> | null;
  actual: Record<string, number>;
  differs: number | null;
};

/** The advisor's facts summed over units, as the reporter's advisor_facts: its calls, tokens, cost, calls by role,
 * failed calls by error code, notes, and its share in percent of the advisor and Fable dollars. */
export type AdvisorFacts = {
  calls: number;
  tokens: Record<string, number>;
  cost: number;
  byRole: Record<string, { calls: number; flagged: boolean }>;
  failed: Record<string, number>;
  notes: number;
  changed: number;
  missing: number;
  share: number;
};

/** A week's advisor spend against Fable spend, its share in percent and whether it passed the stop share. */
export type AdvisorWeek = {
  week: string;
  advisor: number | null;
  fable: number | null;
  share: number | null;
  stop: boolean | null;
};

/**
 * `GET /api/models`: the period's dispatches by agent and its main sessions by path, with the reporter's all-time
 * mismatches (`mismatchesSource`), stage table and differs (`stageSource`); the advisor's facts over the period's runs
 * and sessions, null on an export from before CR6; and the reporter's trial and its advisor weeks within the period.
 */
export type ModelsResponse = {
  agents: AgentModels[];
  mismatchesSource: 'reporter';
  main: MainModels[];
  stageSource: 'reporter';
  advisor: {
    facts: AdvisorFacts | null;
    reporter: { source: 'reporter'; trial: string | null; weeks: AdvisorWeek[] };
  };
};
