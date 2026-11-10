import type { StepKind } from '../report.ts';
import type { AdvisorFacts } from './models.ts';

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
 * `GET /api/steps`: each step kind and rule over the period, the rules with the dispatch guard's refusals, the startup
 * guidelines and the advisor summed over the period's runs and sessions (unitSums), each null on an export from before
 * CR6.
 */
export type StepsResponse = {
  steps: StepRow[];
  rules: RuleSums & {
    dispatchGuard: Record<string, number> | null;
    startup: { with: number; without: number } | null;
    advisor: Pick<AdvisorFacts, 'calls' | 'notes' | 'changed' | 'cost' | 'share'> | null;
  };
};
