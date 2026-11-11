import type { ContextFacts, RunFacts } from '../facts.ts';
import type { FindingsQuery } from './findings.ts';

/** One week's sums over the units with a `context`, as the reporter's context_rows: how many units, their main calls
 * and tokens, the largest unit's max tokens (null when none), the units over the cap, the tool results' tokens by class
 * and the sweeps by kind. */
export type ContextSums = {
  units: number;
  calls: number;
  tokens: number;
  maxTokens: number | null;
  unitsOverCap: number;
  toolResults: Record<string, number>;
  sweeps: ContextFacts['sweeps'];
};

/** A week's context sums with its start date, its mean tokens per call (null with no call) and its read share. */
export type ContextWeek = ContextSums & { week: string; meanTokens: number | null; readShare: number | null };

/** `GET /api/context`'s query: the period's, plus `over=1`, the units over the cap only. */
export type ContextQuery = FindingsQuery & { over: boolean };

/**
 * A run or session with a `context`, as the Context page lists it: a run's facts (as showFacts gives them) or a
 * session's title, ID (null while showing) and project name; its time (a run's record date, a session's start); its main
 * calls, median and largest tokens, calls past the cap, whether it went over, its handoff's time and the session it
 * handed off to; its read share and its sweeps by kind.
 */
export type ContextUnit = ContextFacts & {
  kind: 'run' | 'session';
  key: string;
  run: RunFacts | null;
  session: { title: string | null; sessionId: string | null; project: string | null } | null;
  at: string | null;
  overCap: boolean;
  handedOffTo: { title: string | null; sessionId: string | null } | null;
};

/**
 * The Context page: the period's weeks' context sums, oldest first, the cap it draws, its runs and sessions with no
 * `tool_results` (uncounted), its listed units, and how many it left out while showing.
 */
export type ContextResponse = {
  weeks: ContextWeek[];
  cap: number;
  uncounted: { runs: number; sessions: number };
  units: ContextUnit[];
  hidden: number;
};
