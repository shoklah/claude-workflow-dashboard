import type { Area } from '../categories.ts';
import type { Path } from '../report.ts';
import type { FindingRow } from './runs.ts';

/** A week's findings in one row: every one raised, those acted on (fixed or applied) and those the app judged
 * invalid. */
export type FindingCell = { raised: number; actedOn: number; invalid: number };

/** An area's category, by week; a null category is the area's unlabelled row. */
export type FindingsRow = { area: Area; category: string | null; cells: FindingCell[] };

/** A finding as the Findings page lists it: its run's key and name ("project · branch"), its week and area. */
export type FindingItem = FindingRow & { runKey: string; run: string; week: string; area: Area };

/** `GET /api/findings`'s query: `weeks` (default 4), `path` and `project` (a project's key). */
export type FindingsQuery = { weeks: number; path?: Path; project?: string };

/**
 * `GET /api/findings`: the weeks, oldest first; each area's categories by week, then its unlabelled row when it has
 * one; the findings of the shown projects' runs and how many showing mode left out; the relevance signals; and the
 * labeller's state.
 */
export type FindingsResponse = {
  weeks: string[];
  rows: FindingsRow[];
  findings: FindingItem[];
  hidden: number;
  signals: { laterFixes: number; finalAfterClean: number; notProportionate: number; declinedOrRuled: number };
  labeller: { on: boolean; labelled: number; waiting: number; tokensThisWeek: { input: number; output: number } };
};
