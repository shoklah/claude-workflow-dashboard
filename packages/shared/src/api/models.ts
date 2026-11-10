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

/** The reporter's all-time advisor facts, from the latest export's totals. */
export type AdvisorFacts = {
  calls: number | null;
  tokens: Record<string, number | null> | null;
  cost: number | null;
  byRole: Record<string, { calls: number; flagged: boolean }>;
  failed: Record<string, number>;
  notes: number | null;
  changed: number | null;
  missing: number | null;
  trial: string | null;
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
 * mismatches (`mismatchesSource`), stage table and differs (`stageSource`); and the reporter's advisor facts, null
 * when the export has none, with its weeks within the period.
 */
export type ModelsResponse = {
  agents: AgentModels[];
  mismatchesSource: 'reporter';
  main: MainModels[];
  stageSource: 'reporter';
  advisor: { source: 'reporter'; facts: AdvisorFacts | null; weeks: AdvisorWeek[] };
};
