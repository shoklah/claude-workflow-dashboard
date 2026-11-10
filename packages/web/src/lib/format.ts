import type { Area, FindingCell, FindingRow, FindingSplit, FindingsResponse, RunFacts, StepKind } from '@cwd/shared';

/** Shown where a fact is missing (null, or a record from before steps). */
export const NONE = '–';

/** A step kind's name on screen. */
export const STEP_LABELS: Record<StepKind, string> = {
  plan_simplify: 'Plan simplify',
  plan_review: 'Plan review',
  task_review: 'Task review',
  fix_check: 'Fix-check',
  simplify: 'simplify',
  final_review: 'Final review',
  final_fix_check: 'Final fix-check',
};

/** An area's name on screen. */
export const AREA_LABELS: Record<Area, string> = {
  plan: 'Plan',
  implementation: 'Implementation',
  cleanup: 'Cleanup',
};

/** The badge on a figure taken from the latest export's totals, not summed over the period's runs. */
export const reporterMark = {
  text: 'reporter, all time',
  tooltip: "The latest export's figure over everything the reporter reads; it isn't summed by period yet.",
};

/** A key of a step's count line as words: `not_proportionate` as "not proportionate". */
export function countLabel(key: string): string {
  return key.replaceAll('_', ' ');
}

/** A warning kind's short wording, from PR #8's and CR10's sentences. */
export const KIND_LABELS: Record<string, string> = {
  simplify_not_run: 'simplify not run',
  no_transcript: 'no session transcript',
  final_review_without_simplify: 'final review without simplify',
  simplify_record_differs: 'simplify record differs',
  agent_not_found: 'agent type not found',
  count_line_missing: 'count line missing',
  final_findings_differ: 'final findings differ',
  named_role_by_general_purpose: 'named role by general-purpose',
  model_less_dispatch: 'model-less dispatch',
  startup_missing: 'startup guidelines missing',
  step_count_differs: 'step count differs',
  step_counts_differ: 'step counts differ',
  findings_dont_add_up: "findings don't add up",
  verdicts_dont_add_up: "fix-check verdicts don't add up",
  required_skill_missing: 'required skill did not run',
  agent_off_pin: 'agent off its pin',
  agent_skill_missing: 'agent ran without its skill',
  risk_area_small_path: 'risk area on the Small path',
  wave_unchecked: 'wave has no wave check',
  offer_not_recorded: 'offer not recorded',
  fix_added_differs: "fix_added differs from git's",
  conventions_not_added: 'conventions entry not added',
  unrecorded_session: 'session wrote no run record',
  plan_review_without_simplify: 'plan review without plan simplify',
  typed_skill_not_loaded: 'typed skill never loaded',
  step_agent_missing: 'step has no agent id',
  step_agent_unknown: "step's agent id matches no dispatch",
  step_agent_mismatch: "step's agent id is another kind's",
  step_agent_duplicate: 'steps share an agent id',
  findings_unlabelled: 'findings unlabelled',
  strengths_unrecorded: 'strengths unrecorded',
};

/** A warning kind on screen: its wording, a kind the dashboard doesn't know as its slug with spaces, none as "other". */
export function kindLabel(kind: string | null): string {
  return kind === null ? 'other' : (KIND_LABELS[kind] ?? countLabel(kind));
}

/** A warning family's name on screen, as the Compliance page heads its rows. */
export const FAMILY_LABELS: Record<string, string> = {
  review_flow: 'Review flow',
  steps_record: 'Steps and the record',
  agents_models: 'Agents and models',
  skills_offers: 'Skills and offers',
  sessions: 'Sessions',
  other: 'Other',
};

/** A count, or a dash when it isn't known. */
export function formatCount(count: number | null): string {
  return count === null ? NONE : String(count);
}

/** A count line as words: "cuts 11 · flags 5", a count that isn't known as a dash; a dash when it has no counts or
 * isn't known. */
export function countsLabel(counts: Record<string, number | null> | null): string {
  if (!counts || Object.keys(counts).length === 0) return NONE;
  return joined(Object.entries(counts).map(([key, n]) => `${countLabel(key)} ${formatCount(n)}`));
}

/** Counts by key without the zeros, as the approved basics mockup writes them: "small 4 · full 2", or "none". */
export function nonZeroCountsLabel(counts: Record<string, number>): string {
  const nonZero = Object.entries(counts).filter(([, n]) => n > 0);
  return nonZero.length === 0 ? 'none' : countsLabel(Object.fromEntries(nonZero));
}

/** The advisor's notes, those that changed something and its share of Fable spend, as a whole percent: "notes 12 ·
 * changed 9 · share 8%". */
export function advisorLabel(advisor: { notes: number | null; changed: number | null; share: number | null }): string {
  return `${countsLabel({ notes: advisor.notes, changed: advisor.changed })} · share ${formatShare(advisor.share)}`;
}

/** The advisor's share of Fable spend as a whole percent: "8%"; a dash when it isn't known. */
export function formatShare(share: number | null): string {
  return formatPercent(share === null ? null : Math.round(share));
}

/** An advisor week's stop mark: "STOP" when its share passed the stop share, else nothing. */
export function stopLabel(stop: boolean | null): string {
  return stop ? 'STOP' : '';
}

/** The sum of a record's counts, a count that isn't known as 0. */
export function total(counts: Record<string, number | null>): number {
  return Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

/** The tokens of every kind together, compact: "9.8M", "333K", a kind that isn't known as 0; a dash when they aren't
 * known. */
export function formatTokens(tokens: Record<string, number | null> | null): string {
  if (tokens === null) return NONE;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(total(tokens));
}

/** A rule's name on the Steps and rules page, as the static page names it; an offer's is followed by its skill. */
export const RULE_LABELS = {
  failingTest: 'failing-test check',
  dispatchGuard: 'dispatch guard',
  advisor: 'advisor',
  startup: 'startup guidelines',
  fixRoundCap: 'fix-round cap',
  stopRule: 'stop rule',
  offer: 'offer',
};

/** A finding's category by its display label from `labels` (a response's `categoryLabels`), its id when the labels
 * don't name it, or "unlabelled" while it has none. */
export function categoryLabel(category: string | null, labels: Record<string, string>): string {
  return category === null ? 'unlabelled' : (labels[category] ?? category);
}

/**
 * A finding's App column: "agrees" when the workflow made both calls (category and validity) and the app's label
 * matches them; else the app's category where it differs and its call where it differs or the workflow made none; a
 * dash with no app label.
 */
export function appCallLabel(f: FindingRow, labels: Record<string, string>): string {
  if (f.relevance === null) return NONE;
  const call = f.validity === null ? f.relevance : f.appRelevance;
  const differs = joined([f.appCategory && categoryLabel(f.appCategory, labels), call]);
  return differs || (f.judge === 'workflow' ? 'agrees' : f.relevance);
}

/** A Findings cell's count raised, with the app's part of it when it has one: "7 · 5 by the app". */
export function byAppSplit(cell: Pick<FindingCell, 'raised' | 'byApp'>): string {
  return joined([formatCount(cell.raised), cell.byApp > 0 ? `${formatCount(cell.byApp)} by the app` : null]);
}

/** The findings the session judged invalid: "6 judged invalid by the session". */
export function judgedInvalidLabel(count: number): string {
  return `${formatCount(count)} judged invalid by the session`;
}

/** Where a reviewer's strength comes from: its step, and its task when it has one: "Task review · task 3". */
export function strengthWhere(strength: { step: StepKind; task: number | null }): string {
  return joined([STEP_LABELS[strength.step], strength.task !== null ? `task ${strength.task}` : null]);
}

/** A cost in dollars, or a dash when it isn't known. */
export function formatCost(cost: number | null): string {
  return cost === null ? NONE : `$${cost.toFixed(2)}`;
}

/** A duration, rounded to whole minutes: "25 min", "2 h 10", "2 h 05"; a dash when it isn't known. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null) return NONE;
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, '0')}`;
}

/** The parts of a line that are known, joined: "atlas · feat/search · full". */
export function joined(parts: (string | null)[]): string {
  return parts.filter(Boolean).join(' · ');
}

/** A run's name: its project and branch, as far as they are known. */
export function runName(run: { project: string | null; branch: string | null }): string {
  return joined([run.project, run.branch]);
}

/** "14 · 12 closed"; "–" for a record from before steps, which has no findings to count. */
export function findingsLabel(run: Pick<RunFacts, 'findings' | 'beforeSteps'>): string {
  if (run.beforeSteps) return NONE;
  // closed: acted on + not acted on, the findings with an outcome other than open.
  const closed = run.findings.actedOn + run.findings.notActedOn;
  return `${run.findings.total} · ${closed} closed`;
}

/** A count out of its whole: "8 of 23"; a dash when it isn't known. */
export function ofLabel(count: number | null, of: number): string {
  return count === null ? NONE : `${count} of ${of}`;
}

/** A skill or command on Home's skills and commands: a command with its slash, "/model", a skill bare. */
export function usageName(row: { name: string; kind: 'skill' | 'command' }): string {
  return row.kind === 'command' ? `/${row.name}` : row.name;
}

/** A count with its noun, plural unless it is 1: "1 run", "2 runs". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** A step box's warnings link's name, since a list of links reads it alone: "1 warning on Final review". */
export function stepWarningsLabel(count: number, step: StepKind): string {
  return `${plural(count, 'warning')} on ${STEP_LABELS[step]}`;
}

/** Showing mode's line for what it leaves out: "+ 2 runs in other projects, counted in totals and charts only". */
export function hiddenLabel(count: number, noun: string): string {
  return `+ ${plural(count, noun)} in other projects, counted in totals and charts only`;
}

/** Compliance's line above its grid: the grid's warnings, its weeks and how many of the warnings are new, "41 warnings
 * in 8 weeks · 6 new since you last looked". */
export function warningsSummary(warnings: number, weeks: number, fresh: number): string {
  return `${plural(warnings, 'warning')} in ${plural(weeks, 'week')} · ${fresh} new since you last looked`;
}

/** Compliance's line for what showing mode left out of its list: other projects', sessions' and "other" warnings, the
 * last left out of the grid too. */
export function hiddenWarningsLabel(count: number): string {
  return `+ ${plural(count, 'warning')} left out while showing (other projects, sessions and other kinds); the grid counts all but other kinds`;
}

/** The findings' split as the tiles and the feed read it: "13 acted on · 1 open". */
export function actedOnSplit(findings: FindingSplit): string {
  return `${findings.actedOn} acted on · ${findings.open} open`;
}

/** A week's start date, as an axis or a column names it: "Nov 8". */
export function weekLabel(week: string): string {
  return new Date(week).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/** A whole percent, or a dash when it isn't known. */
export function formatPercent(percent: number | null): string {
  return percent === null ? NONE : `${percent}%`;
}

// The dataviz blue ramp's five steps, light to dark, with black text on step 4 (white there is 4.42:1, under AA's
// 4.5:1) and white on the darkest; and its neutral grey with secondary ink, for 0.
const SHADES = [
  'bg-[#cde2fb]',
  'bg-[#9ec5f4]',
  'bg-[#6da7ec]',
  'bg-[#2a78d6] text-black',
  'bg-[#184f95] text-white',
];
const ZERO_SHADE = 'bg-[#f0efec] text-[#52514e]';

// The dataviz palette's reserved status orange ("serious") for a warned step box's border, and the approved mockup's
// darker orange for the warning text beside it, readable on white (5.9:1).
export const WARNING_BORDER = 'border-[#ec835a]';
export const WARNING_INK = 'text-[#a8461c]';

// A share bar (a meter): the dataviz blue's fill, on a lighter step of the same ramp for its track.
export const SHARE_FILL = 'bg-[#2a78d6]';
export const SHARE_TRACK = 'bg-[#cde2fb]';

/** A heatmap cell's classes: its value's step of the ramp by its share of `max`, the grey for 0. */
export function cellShade(value: number, max: number): string {
  if (value <= 0 || max <= 0) return ZERO_SHADE;
  return SHADES[Math.min(SHADES.length, Math.ceil((SHADES.length * value) / max)) - 1];
}

/** The labeller's line: "Labeller off: no API key", or "8 labelled · 1 waiting · 43,350 tokens this week". */
export function labellerLabel(labeller: FindingsResponse['labeller']): string {
  if (!labeller.on) return 'Labeller off: no API key';
  const tokens = labeller.tokensThisWeek.input + labeller.tokensThisWeek.output;
  return `${labeller.labelled} labelled · ${labeller.waiting} waiting · ${tokens.toLocaleString('en-US')} tokens this week`;
}

/** A skill's loads by outcome: "ran × 2 · applied 2, skipped 1 × 1"; a dash with none. */
export function outcomesLabel(outcomes: Record<string, number>): string {
  return joined(Object.entries(outcomes).map(([label, count]) => `${label} × ${count}`)) || NONE;
}

/** A path's stage table as the static page writes it: "1=opus/medium 2=opus/medium", a stage with no
 * recommendation as a dash; a dash when it isn't known. */
export function stageTableLabel(recommended: Record<string, string | null | undefined> | null): string {
  if (!recommended) return NONE;
  return Object.entries(recommended)
    .map(([stage, want]) => `${stage}=${want ?? NONE}`)
    .join(' ');
}

/** The advisor's calls by role: "implementer 3 · task-reviewer 2 (should not consult)", a role that should never
 * consult flagged; a dash when they aren't known. */
export function advisorRolesLabel(byRole: Record<string, { calls: number; flagged: boolean }> | null): string {
  if (!byRole) return NONE;
  return (
    joined(Object.entries(byRole).map(([role, { calls, flagged }]) => `${role} ${calls}${flagged ? ' (should not consult)' : ''}`)) ||
    NONE
  );
}
