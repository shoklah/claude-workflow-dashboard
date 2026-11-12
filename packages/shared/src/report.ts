import { z } from 'zod';
import { RELEVANCE } from './categories.ts';
import type { SpendUnits } from './api/spend.ts';

// The reporter's --json output (workflow-report.py, report_data). Every field is optional and nullable unless the
// loader can't work without it; unknown keys are stripped.

export const STEP_KINDS = [
  'plan_simplify',
  'plan_review',
  'task_review',
  'fix_check',
  'simplify',
  'final_review',
  'final_fix_check',
] as const;
export const OUTCOMES = ['fixed', 'applied', 'declined', 'deferred', 'ruled', 'open', 'to_owner'] as const;
export const PATHS = ['small', 'full', 'plan'] as const;

const str = z.string().nullish();
const num = z.number().nullish();
const bool = z.boolean().nullish();
const strings = z.array(z.string()).nullish();
const counts = z.record(z.string(), z.number()).nullish();

const FindingSchema = z.object({
  id: str,
  severity: str,
  kind: str,
  summary: str,
  category: str,
  validity: z.enum(RELEVANCE).nullish(),
  outcome: z.enum(OUTCOMES).nullish(),
  reason: str,
  closed_round: num,
  verdicts: strings,
});

const StepSchema = z.object({
  step: z.enum(STEP_KINDS).nullish(),
  task: num,
  wave: str,
  round: num,
  agent: str,
  model: str,
  effort: str,
  counts,
  findings: z.array(FindingSchema).nullish(),
  strengths: z.array(z.object({ category: str, summary: str })).nullish(),
});

const WaveSchema = z.object({ wave: str, tasks: z.array(z.number()).nullish(), conflicts: num });

// A record from the run log, as written; only the fields the dashboard reads.
const RunRecordSchema = z.object({
  schema: num,
  date: str,
  started: str,
  project: str,
  branch: str,
  base: str,
  head: str,
  path: str,
  plan: str,
  archive: str,
  risk_area: bool,
  stage: str,
  advisor: bool,
  fable_start: num,
  fable_end: num,
  all_start: num,
  all_end: num,
  tasks: num,
  fix_rounds: num,
  stops: num,
  // The raw record as a session wrote it; only `result` is read, so a task that isn't a number never fails an import.
  failing_test: z.array(z.object({ result: str })).nullish(),
});

// A WARN line as an object: its text is the warns line beside it, its kind one the reporter may add to.
const WarningSchema = z.object({ text: z.string(), kind: str, step: z.object({ step: str }).nullish() });

// Per model: tokens, and the list-price cost, null for a model the reporter has no price for.
const ModelsSchema = z
  .record(
    z.string(),
    z.object({ input: num, output: num, cache_read: num, cache_write: num, cost: num }),
  )
  .nullish();
// Per workflow phase, in the reporter's order: its models and its advisor, which sum to the unit's own.
const PhasesSchema = z
  .array(z.object({ name: z.string(), models: ModelsSchema, advisor: z.object({ calls: num, cost: num }).nullish() }))
  .nullish();
const EffortsSchema = z.record(z.string(), z.record(z.string(), z.number())).nullish();

// outcome is a file path, an object, a list, a boolean, 'ran' or null, depending on the skill.
const SkillSchema = z.object({ name: str, time: str, outcome: z.unknown().optional() });

// A typed trigger: a skill asked for by a typed phrase or command, met when a later row loads it.
const TypedSchema = z.object({ skill: str, time: str, met: bool });

// A unit's advisor facts (CR6's unit_advisor), which totals.advisor sums: its tokens, calls by role, failed calls by
// error code, and its advisor and Fable dollars by week.
const UnitAdvisorSchema = z.object({
  calls: num,
  cost: num,
  tokens: counts,
  by_role: z.record(z.string(), z.object({ calls: num, flagged: bool })).nullish(),
  failed: counts,
  weeks: z.array(z.object({ week: str, advisor: num, fable: num })).nullish(),
});

// A unit's advisor notes: how many, how many changed something, and the consultations with none.
const NotesSchema = z.object({ notes: num, changed: num, missing: num });

// A unit's main calls' context: null when the reporter read no call of its own. handoff_to is the successor session's
// reporter key, CR15's proposed field, absent until it lands.
const ContextSchema = z.object({
  calls: num,
  tokens: num,
  median_tokens: num,
  max_tokens: num,
  over_cap: bool,
  calls_over_cap: num,
  handoff: str,
  handoff_to: str,
});

const SweepsSchema = z.object({ inline: num, delegated: num });

const DispatchSchema = z.object({
  kind: str,
  agent: str,
  description: str,
  requested_model: str,
  requested_effort: str,
  model: str,
  effort: str,
  skills: strings,
  counts,
  models: ModelsSchema,
});

export const RunEntrySchema = z.object({
  record: RunRecordSchema.nullish(),
  schema: num,
  steps: z.array(StepSchema).nullish(),
  final_findings: z
    .object({ critical: num, important: num, minor: num, unneeded: num })
    .nullish(),
  simplify: z
    .object({ ran: z.enum(['agents', 'inline', 'no']).nullish(), applied: num, skipped: num })
    .nullish(),
  waves: z.array(WaveSchema).nullish(),
  offers: z.array(z.object({ skill: str, outcome: str })).nullish(),
  fable_points: num,
  all_points: num,
  minutes: num,
  window: z.object({ transcript: str, start: str, end: str }).nullish(),
  warns: strings,
  warnings: z.array(WarningSchema).nullish(),
  info: strings,
  later_fixes: z.array(z.object({ sha: str, date: str, subject: str })).nullish(),
  // The window's facts, all null when the run has no window.
  dispatches: z.array(DispatchSchema).nullish(),
  skills: z.array(SkillSchema).nullish(),
  missing_skills: strings,
  typed: z.array(TypedSchema).nullish(),
  refusals: counts,
  models: ModelsSchema,
  phases: PhasesSchema,
  efforts: EffortsSchema,
  advisor: UnitAdvisorSchema.nullish(),
  notes: NotesSchema.nullish(),
  main: z.object({ model: str, effort: str }).nullish(),
  context: ContextSchema.nullish(),
  tool_results: counts,
  sweeps: SweepsSchema.nullish(),
  title: str,
});

// A main transcript's rows outside every run window (CR6), with its whole transcript's facts (CR11): its first and
// last row times, its first working directory, and its slash commands by name and time.
export const SessionEntrySchema = z.object({
  file: z.string(),
  start: str,
  end: str,
  project: str,
  commands: z.array(z.object({ name: str, time: str })).nullish(),
  skills: z.array(SkillSchema).nullish(),
  typed: z.array(TypedSchema).nullish(),
  models: ModelsSchema,
  phases: PhasesSchema,
  efforts: EffortsSchema,
  advisor: UnitAdvisorSchema.nullish(),
  notes: NotesSchema.nullish(),
  refusals: counts,
  startup: bool,
  context: ContextSchema.nullish(),
  tool_results: counts,
  sweeps: SweepsSchema.nullish(),
  warns: strings,
  warnings: z.array(WarningSchema).nullish(),
  title: str,
});

const WeekSchema = z.object({
  week: str,
  runs: counts,
  tasks: num,
  findings: z.object({ critical: num, important: num, minor: num, unneeded: num }).nullish(),
  fix_rounds: num,
  stops: num,
  fable_points: num,
  all_points: num,
  cost: num,
  minutes_per_run: num,
  later_fixes: num,
});

const tokens = z.object({ input: num, output: num, cache_read: num, cache_write: num }).nullish();

// A step kind's scoreboard row; simplify's tokens and cost are null.
const ScoreSchema = z.object({ ran: num, found: num, counts, outcomes: counts, tokens, cost: num }).nullish();

const ScoreboardSchema = z.object({
  ...Object.fromEntries(STEP_KINDS.map((kind) => [kind, ScoreSchema])) as Record<StepKind, typeof ScoreSchema>,
  failing_test: counts,
  dispatch_guard: counts,
  advisor: z.object({ calls: num, notes: num, changed: num, cost: num, share: num }).nullish(),
  startup: z.object({ with: num, without: num }).nullish(),
  fix_round_cap: z.object({ runs: num, ruled: num }).nullish(),
  stop_rule: z.object({ stops: num }).nullish(),
});

const RunTimeSchema = z.object({ runs: num, timed: num, median_minutes: num }).nullish();

const AdvisorSchema = z.object({
  calls: num,
  tokens,
  cost: num,
  by_role: z.record(z.string(), z.object({ calls: num, flagged: bool })).nullish(),
  failed: counts,
  notes: num,
  changed: num,
  missing: num,
  weeks: z.array(z.object({ week: str, advisor: num, fable: num, share: num, stop: bool })).nullish(),
  trial: str,
});

const TotalsSchema = z.object({
  weeks: z.array(WeekSchema).nullish(),
  scoreboard: ScoreboardSchema.nullish(),
  run_time: z.object({ with_waves: RunTimeSchema, without_waves: RunTimeSchema }).nullish(),
  skills: z.record(z.string(), z.object({ runs: num, last: str, missing: num })).nullish(),
  models: z
    .object({
      agents: z.record(z.string(), z.object({ requested: counts, actual: counts, mismatches: num })).nullish(),
      main: z
        .record(z.string(), z.object({ recommended: z.record(z.string(), str).nullish(), actual: counts, differs: num }))
        .nullish(),
    })
    .nullish(),
  advisor: AdvisorSchema.nullish(),
  // Per offered skill: its outcomes' counts, and offered (accepted plus skipped).
  offers: z.record(z.string(), counts).nullish(),
  // Per week, over the units whose context isn't null (context_rows).
  context: z
    .array(
      z.object({
        week: str,
        calls: num,
        tokens: num,
        max_tokens: num,
        units_over_cap: num,
        tool_results: counts,
        sweeps: SweepsSchema.nullish(),
      }),
    )
    .nullish(),
  health: z.object({ info: strings }).nullish(),
});

// The finding category list: its version, tie-break rule, validity definitions and a list per area.
const CategoryListSchema = z.object({
  version: num,
  rule: str,
  validity: z.record(z.string(), z.string()).nullish(),
  areas: z
    .array(z.object({ area: str, list: z.array(z.object({ id: z.string(), label: str, means: str })).nullish() }))
    .nullish(),
});

export const ReportSchema = z.object({
  version: z.literal(1),
  generated: str,
  since: str,
  now: str,
  categories: CategoryListSchema.nullish(),
  runs: z.array(RunEntrySchema),
  sessions: z.array(SessionEntrySchema),
  totals: TotalsSchema,
  // `cursor` and `removed` come only with `--changed-since` (CR6).
  cursor: str,
  removed: z.object({ runs: strings, sessions: strings }).nullish(),
});

export type Report = z.infer<typeof ReportSchema>;
export type RunEntry = z.infer<typeof RunEntrySchema>;
export type RunRecord = z.infer<typeof RunRecordSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type SessionEntry = z.infer<typeof SessionEntrySchema>;
export type Totals = z.infer<typeof TotalsSchema>;
export type Warning = z.infer<typeof WarningSchema>;
export type CategoryList = z.infer<typeof CategoryListSchema>;
export type StepKind = (typeof STEP_KINDS)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type Path = (typeof PATHS)[number];

/** The stored totals of an export (lastGoodImport's) as the schema reads them, or null when there are none or the
 * schema rejects them. */
export function reporterTotals(totals: unknown): Totals | null {
  return TotalsSchema.safeParse(totals).data ?? null;
}

/** A value as a run path, or undefined when it isn't one. */
export function toPath(value: unknown): Path | undefined {
  return PATHS.find((p) => p === value);
}

/** A value as a step kind, or undefined when it isn't one. */
export function toStepKind(value: unknown): StepKind | undefined {
  return STEP_KINDS.find((k) => k === value);
}

/** A value as the Spend page's units, 'all' when it isn't 'runs' or 'sessions'. */
export function toSpendUnits(value: unknown): SpendUnits {
  return value === 'runs' || value === 'sessions' ? value : 'all';
}
