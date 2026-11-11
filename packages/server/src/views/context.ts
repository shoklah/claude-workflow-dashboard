import { parseTime, readShare, weekOf, type ContextSums, type ContextWeek, type RunEntry, type SessionEntry } from '@cwd/shared';

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
    for (const [kind, tokens] of Object.entries(unit.tool_results ?? {})) {
      sum.toolResults[kind] = (sum.toolResults[kind] ?? 0) + tokens;
    }
    sum.sweeps.inline += unit.sweeps?.inline ?? 0;
    sum.sweeps.delegated += unit.sweeps?.delegated ?? 0;
    sums.set(week, sum);
  }
  return sums;
}

/** A week's context sums with its start date, mean tokens per call (null with no call) and read share. */
export function contextWeek(week: string, sums: ContextSums): ContextWeek {
  return { ...sums, week, meanTokens: sums.calls ? sums.tokens / sums.calls : null, readShare: readShare(sums.toolResults) };
}
