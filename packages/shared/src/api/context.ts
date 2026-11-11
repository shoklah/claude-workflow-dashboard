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
  sweeps: { inline: number; delegated: number };
};

/** A week's context sums with its start date, its mean tokens per call (null with no call) and its read share. */
export type ContextWeek = ContextSums & { week: string; meanTokens: number | null; readShare: number | null };
