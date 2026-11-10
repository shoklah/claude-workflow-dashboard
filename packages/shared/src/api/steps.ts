import type { StepKind } from '../report.ts';

/**
 * A step kind's row over a period, as the reporter's scoreboard: the steps that ran, those whose counts found
 * something, their summed counts, their findings by the static page's outcome columns, and the tokens and cost of the
 * window's dispatches of that kind; simplify's tokens and cost are null.
 */
export type StepRow = {
  step: StepKind;
  ran: number;
  found: number;
  counts: Record<string, number>;
  fixedOrApplied: number;
  declined: number;
  deferred: number;
  openOrToOwner: number;
  tokens: Record<string, number> | null;
  cost: number | null;
};

/**
 * The rules summed over a period, as the reporter's scoreboard: the failing-test results, the runs reaching round 3
 * and the findings ruled, the stops, and per offered skill its outcomes and `offered` (accepted plus skipped).
 */
export type RuleSums = {
  failingTest: Record<string, number>;
  fixRoundCap: { runs: number; ruled: number };
  stopRule: number;
  offers: Record<string, Record<string, number> & { offered: number }>;
};

/**
 * `GET /api/steps`: each step kind and rule over the period, and the reporter's all-time figures from the latest
 * export's totals (dispatch-guard refusals, the advisor, startup guidelines), each null when the export has none.
 */
export type StepsResponse = {
  steps: StepRow[];
  rules: RuleSums;
  reporter: {
    source: 'reporter';
    dispatchGuard: Record<string, number> | null;
    advisor: {
      calls: number | null;
      notes: number | null;
      changed: number | null;
      cost: number | null;
      share: number | null;
    } | null;
    startup: { with: number | null; without: number | null } | null;
  };
};
