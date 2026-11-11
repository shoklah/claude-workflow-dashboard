import type { FindingsQuery } from './findings.ts';

/** Which units the Spend page sums: all, runs only or sessions only. */
export type SpendUnits = 'all' | 'runs' | 'sessions';

/** `GET /api/spend`'s query: the period's, plus `units`. */
export type SpendQuery = FindingsQuery & { units: SpendUnits };

/** The app's five groups of the reporter's phases. */
export type SpendGroup = 'plan' | 'implement' | 'review' | 'coordination' | 'unattributed';

/** `byModel` holds every model of the response's `models`: 0 with no spend on it in this row, null in every row when the
 * reporter has no price for it. Advisor figures are outside `cost` and `share`. */
export type SpendRow = {
  cost: number;
  share: number | null;
  byModel: Record<string, number | null>;
  advisor: { calls: number; cost: number };
};

/** A phase's row, by its name as the reporter gives it (masked while showing). */
export type SpendPhase = SpendRow & { name: string };

/** A group's row and its phases' rows. */
export type SpendGroupRow = SpendRow & { group: SpendGroup; phases: SpendPhase[] };

/** A week's cost by group, its total, and its units with no spend by phase. */
export type SpendWeek = {
  week: string;
  groups: Record<SpendGroup, number>;
  total: number;
  uncounted: { runs: number; sessions: number };
};

/**
 * The Spend page: the period's weeks, oldest first; all five groups, in SPEND_GROUPS' order, a group's phases those
 * with a counted entry, in the reporter's order; the total (share null); the models, largest cost first, unpriced ones
 * last; whether the period holds spend on a model with no price; and the first week from which every week has nothing
 * uncounted, null when the last week has.
 */
export type SpendResponse = {
  weeks: SpendWeek[];
  groups: SpendGroupRow[];
  total: SpendRow;
  models: string[];
  unpriced: boolean;
  fullFrom: string | null;
};
