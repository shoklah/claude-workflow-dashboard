import type { StepKind } from '../report.ts';
import type { FindingsQuery } from './findings.ts';

/** `GET /api/compliance`'s query: the period's, plus `resolved=1` and `step` (a step kind). */
export type ComplianceQuery = FindingsQuery & { resolved: boolean; step?: StepKind };

/** A warning kind's row of the grid, by week; `kind` is null in the "other" row of warnings stored with no kind. */
export type ComplianceRow = { family: string; kind: string | null; cells: number[] };

/** A warning as the Compliance page lists it: its kind and family, its week, its text with any session ID split out,
 * its run (null for a session's), the step it names, and whether it was first seen after the "seen" time. */
export type ComplianceWarning = {
  kind: string | null;
  family: string;
  week: string;
  text: string;
  sessionId: string | null;
  runKey: string | null;
  project: string | null;
  branch: string | null;
  step: StepKind | null;
  isNew: boolean;
};

/** `GET /api/compliance`: the weeks, oldest first; a row per kind with a warning in the period, by family, "other"
 * last (none while showing); how many of the rows' warnings are new since the "seen" time; the warnings listed; and
 * how many showing mode left out of the list. */
export type ComplianceResponse = {
  weeks: string[];
  rows: ComplianceRow[];
  newWarnings: number;
  warnings: ComplianceWarning[];
  hidden: number;
};
