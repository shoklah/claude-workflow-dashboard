import {
  contextFacts,
  parseTime,
  readShare,
  weekOf,
  type ContextQuery,
  type ContextResponse,
  type ContextSums,
  type ContextUnit,
  type ContextWeek,
  type RunEntry,
  type SessionEntry,
} from '@cwd/shared';
import type { StoredUnit } from '../db/read.ts';
import { addCount, periodStoredUnits, rootOf, storedFacts, storedNames } from './runs.ts';
import { showFacts, showSession, type Scope } from './scope.ts';
import { sessionFacts } from './sessions.ts';

/** The context cap the Context page draws: the app's default until the reporter exports its own (CR14). */
export const CONTEXT_CAP = 300_000;

/** A week with no unit: every count 0, no largest tokens, no tool result class. */
export function emptyContext(): ContextSums {
  return { units: 0, calls: 0, tokens: 0, maxTokens: null, unitsOverCap: 0, toolResults: {}, sweeps: { inline: 0, delegated: 0 } };
}

/**
 * Per week start date, as the reporter's context_rows, over the units whose `context` isn't null: a run in its record's
 * week, a session in its start's (a unit with no such time counts nowhere). `calls` and `tokens` summed, `maxTokens`
 * the largest unit's `max_tokens`, `unitsOverCap` the units over the cap, `toolResults` summed by class and `sweeps` by
 * kind, a missing class or kind 0.
 */
export function contextSums(runs: RunEntry[], sessions: SessionEntry[]): Map<string, ContextSums> {
  const sums = new Map<string, ContextSums>();
  const units = [
    ...runs.map((run) => ({ unit: run, time: run.record?.date })),
    ...sessions.map((session) => ({ unit: session, time: session.start })),
  ];
  for (const { unit, time } of units) {
    const context = unit.context;
    if (!context || !time) continue;
    const week = weekOf(parseTime(time));
    const sum = sums.get(week) ?? emptyContext();
    sum.units += 1;
    sum.calls += context.calls ?? 0;
    sum.tokens += context.tokens ?? 0;
    if (context.max_tokens != null) sum.maxTokens = Math.max(sum.maxTokens ?? 0, context.max_tokens);
    if (context.over_cap) sum.unitsOverCap += 1;
    for (const [kind, tokens] of Object.entries(unit.tool_results ?? {})) addCount(sum.toolResults, kind, tokens);
    for (const [kind, n] of Object.entries(unit.sweeps ?? {})) addCount(sum.sweeps, kind, n ?? 0);
    sums.set(week, sum);
  }
  return sums;
}

/** A week's context sums with its start date, mean tokens per call (null with no call) and read share. */
export function contextWeek(week: string, sums: ContextSums): ContextWeek {
  return { ...sums, week, meanTokens: sums.calls ? sums.tokens / sums.calls : null, readShare: readShare(sums.toolResults) };
}

/**
 * The Context page: the period's units (periodStoredUnits), its weeks' context sums oldest first (contextSums, a week
 * with no unit empty), its runs and sessions with no `tool_results` (uncounted), and its units with a `context` (only
 * those over the cap with `over`), by calls past the cap, then largest tokens. A session's handoff names the stored
 * session whose key is its `handoff_to`. With a scope, a run is listed as showFacts gives it and a session only when
 * showSession holds, as sessionFacts names it; a successor session that isn't shown is null; `hidden` counts the units
 * left out. Sums and `uncounted` count every project.
 */
export function contextView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  query: ContextQuery;
  now: Date;
  scope: Scope | null;
}): ContextResponse {
  const { query, scope } = input;
  const { weeks, runs, sessions } = periodStoredUnits(input.runs, input.sessions, query, input.now);
  const sums = contextSums(
    runs.map((unit) => unit.merged),
    sessions.map((unit) => unit.merged),
  );
  const names = storedNames(input.runs);
  const runRoots = new Set(input.runs.map(rootOf));
  const byKey = new Map(input.sessions.map((unit) => [unit.key, unit.merged]));
  const listed = (entry: RunEntry | SessionEntry) => !!entry.context && (!query.over || !!entry.context.over_cap);

  const unitOf = (
    entry: RunEntry | SessionEntry,
    fields: Pick<ContextUnit, 'kind' | 'key' | 'run' | 'session' | 'at'>,
  ): ContextUnit => {
    const context = entry.context!;
    const next = context.handoff_to ? byKey.get(context.handoff_to) : undefined;
    const shownNext = next && showSession(scope, next.project) ? sessionFacts(next, runRoots, names, scope) : null;
    return {
      ...fields,
      ...contextFacts(entry)!,
      overCap: !!context.over_cap,
      handedOffTo: shownNext && { title: shownNext.title, sessionId: shownNext.sessionId },
    };
  };

  const units: ContextUnit[] = [];
  let hidden = 0;
  for (const unit of runs) {
    if (!listed(unit.merged)) continue;
    const run = showFacts(scope, storedFacts(unit, names));
    if (!run) {
      hidden += 1;
      continue;
    }
    const at = unit.merged.record?.date ?? null;
    units.push(unitOf(unit.merged, { kind: 'run', key: unit.key, run, session: null, at }));
  }
  for (const unit of sessions) {
    const session = unit.merged;
    if (!listed(session)) continue;
    if (!showSession(scope, session.project)) {
      hidden += 1;
      continue;
    }
    const { title, sessionId, project } = sessionFacts(session, runRoots, names, scope);
    const at = session.start ?? null;
    units.push(unitOf(session, { kind: 'session', key: unit.key, run: null, session: { title, sessionId, project }, at }));
  }

  const noToolResults = (unit: StoredUnit<RunEntry | SessionEntry>) => unit.merged.tool_results == null;
  return {
    weeks: weeks.map((week) => contextWeek(week, sums.get(week) ?? emptyContext())),
    cap: CONTEXT_CAP,
    uncounted: { runs: runs.filter(noToolResults).length, sessions: sessions.filter(noToolResults).length },
    units: units.sort((a, b) => b.callsOverCap - a.callsOverCap || (b.maxTokens ?? 0) - (a.maxTokens ?? 0)),
    hidden,
  };
}
