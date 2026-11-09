import { z } from 'zod';

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
});

// Per model: tokens, and the list-price cost, null for a model the reporter has no price for.
const ModelsSchema = z
  .record(
    z.string(),
    z.object({ input: num, output: num, cache_read: num, cache_write: num, cost: num }),
  )
  .nullish();
const EffortsSchema = z.record(z.string(), z.record(z.string(), z.number())).nullish();

// outcome is a file path, an object, a list, a boolean, 'ran' or null, depending on the skill.
const SkillSchema = z.object({ name: str, time: str, outcome: z.unknown().optional() });

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
  fable_points: num,
  all_points: num,
  minutes: num,
  window: z.object({ transcript: str, start: str, end: str }).nullish(),
  warns: strings,
  info: strings,
  later_fixes: z.array(z.object({ sha: str, date: str, subject: str })).nullish(),
  // The window's facts, all null when the run has no window.
  dispatches: z.array(DispatchSchema).nullish(),
  skills: z.array(SkillSchema).nullish(),
  missing_skills: strings,
  refusals: counts,
  models: ModelsSchema,
  efforts: EffortsSchema,
  advisor: z.object({ calls: num, cost: num }).nullish(),
  notes: z.object({ notes: num, changed: num, missing: num }).nullish(),
  main: z.object({ model: str, effort: str }).nullish(),
});

export const SessionEntrySchema = z.object({
  file: z.string(),
  skills: z.array(SkillSchema).nullish(),
  typed: z.array(z.object({ skill: str, time: str, met: bool })).nullish(),
  models: ModelsSchema,
  efforts: EffortsSchema,
  startup: bool,
  warns: strings,
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

const TotalsSchema = z.object({ weeks: z.array(WeekSchema).nullish() });

export const ReportSchema = z.object({
  version: z.literal(1),
  generated: str,
  since: str,
  now: str,
  runs: z.array(RunEntrySchema),
  sessions: z.array(SessionEntrySchema),
  totals: TotalsSchema,
});

export type Report = z.infer<typeof ReportSchema>;
export type RunEntry = z.infer<typeof RunEntrySchema>;
export type RunRecord = z.infer<typeof RunRecordSchema>;
export type Step = z.infer<typeof StepSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type SessionEntry = z.infer<typeof SessionEntrySchema>;
export type Totals = z.infer<typeof TotalsSchema>;
export type StepKind = (typeof STEP_KINDS)[number];
export type Outcome = (typeof OUTCOMES)[number];
export type Path = (typeof PATHS)[number];
