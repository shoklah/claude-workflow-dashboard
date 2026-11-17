import { parseTime, toStepKind, type Area, type Path, type FindingRow, type Outcome, type SpendGroup, type StepKind, type WorkStep } from '@cwd/shared';

/** Shown where a fact is missing (null, or a record from before steps). */
export const NONE = '–';

/** A step kind's name on screen. */
export const STEP_LABELS: Record<StepKind, string> = {
  plan_simplify: 'Plan simplify',
  plan_review: 'Plan review',
  task_review: 'Task review',
  fix_check: 'Fix-check',
  simplify: 'Simplify',
  final_review: 'Final review',
  final_fix_check: 'Final fix-check',
  kit_review: 'Kit review',
};

/** An area's name on screen. */
export const AREA_LABELS: Record<Area, string> = {
  plan: 'Plan',
  implementation: 'Implementation',
  cleanup: 'Cleanup',
  kit: 'Kit',
};

/** The badge on a figure taken from the latest export's totals, not summed over the period's runs. */
export const reporterMark = {
  text: 'reporter, all time',
  tooltip: "The latest export's figure over everything the reporter reads; it isn't summed by period yet.",
};

/** The badge on Compliance's information lines, which are the latest export's, not an all-time figure. */
export const informationMark = {
  text: 'reporter',
  tooltip: "The latest export's lines, as the reporter writes them; not filtered by period.",
};

/** A key of a step's count line as words: `not_proportionate` as "not proportionate". */
export function countLabel(key: string): string {
  return key.replaceAll('_', ' ');
}

/** A warning kind's short wording, capitalised, from PR #8's and CR10's sentences. */
export const KIND_LABELS: Record<string, string> = {
  simplify_not_run: 'Simplify not run',
  no_transcript: 'No session transcript',
  final_review_without_simplify: 'Final review without simplify',
  simplify_record_differs: 'Simplify record differs',
  agent_not_found: 'Agent type not found',
  count_line_missing: 'Count line missing',
  final_findings_differ: 'Final findings differ',
  named_role_by_general_purpose: 'Named role by general-purpose',
  model_less_dispatch: 'Model-less dispatch',
  startup_missing: 'Startup guidelines missing',
  step_count_differs: 'Step count differs',
  step_counts_differ: 'Step counts differ',
  findings_dont_add_up: "Findings don't add up",
  verdicts_dont_add_up: "Fix-check verdicts don't add up",
  required_skill_missing: 'Required skill did not run',
  agent_off_pin: 'Agent off its pin',
  agent_skill_missing: 'Agent ran without its skill',
  risk_area_small_path: 'Risk area on the Small path',
  wave_unchecked: 'Wave has no wave check',
  offer_not_recorded: 'Offer not recorded',
  fix_added_differs: "Fix_added differs from git's",
  conventions_not_added: 'Conventions entry not added',
  unrecorded_session: 'Session wrote no run record',
  plan_review_without_simplify: 'Plan review without plan simplify',
  typed_skill_not_loaded: 'Typed skill never loaded',
  step_agent_missing: 'Step has no agent id',
  step_agent_unknown: "Step's agent id matches no dispatch",
  step_agent_mismatch: "Step's agent id is another kind's",
  step_agent_duplicate: 'Steps share an agent id',
  findings_unlabelled: 'Findings unlabelled',
  strengths_unrecorded: 'Strengths unrecorded',
};

/** A warning kind on screen, capitalised: its wording, a kind the dashboard doesn't know as its slug with spaces, none as
 * "Other". */
export function kindLabel(kind: string | null): string {
  return kind === null ? 'Other' : (KIND_LABELS[kind] ?? capitalize(countLabel(kind)));
}

/** A reporter's phase on screen, capitalised as the Spend page writes phases: a step kind by its step's label
 * ("Fix-check"), another name with spaces ("Plan writing"). */
export function phaseLabel(name: string): string {
  const kind = toStepKind(name);
  return capitalize((kind ? STEP_LABELS[kind] : countLabel(name)).toLowerCase());
}

/** A spend group's name on screen. */
export const SPEND_GROUP_LABELS: Record<SpendGroup, string> = {
  plan: 'Plan',
  implement: 'Implement',
  review: 'Review and cleanup',
  coordination: 'Coordination',
  unattributed: 'Unattributed',
};

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

// The count keys whose words aren't their slug's.
export const COUNT_LABELS: Record<string, string> = { couldnt_run: "Couldn't run", unneeded: 'Not required' };

/** A count key, severity, outcome or verdict on screen, capitalised: `not_proportionate` as "Not proportionate",
 * `unneeded` as "Not required". */
export function countName(key: string): string {
  return COUNT_LABELS[key] ?? capitalize(countLabel(key));
}

/** A finding's outcome on screen: its count name, "No outcome" when it has none. */
export function outcomeLabel(outcome: Outcome | 'none' | null): string {
  return outcome == null || outcome === 'none' ? 'No outcome' : countName(outcome);
}

/** Who ran a step, by name only: its agent, or "in the session" without one (a flow box's reviewer). */
export function reviewerLabel(step: { agent: string | null } | null): string {
  return step?.agent || 'in the session';
}

/** Who ran a step: its agent, then its model (`modelLabel`) and effort, "task-reviewer · Opus 5.5, high"; "in the
 * session" without an agent. */
export function stepBy(step: { agent: string | null; model: string | null; effort: string | null } | null): string {
  if (!step?.agent) return reviewerLabel(step);
  const model = modelLabel(step.model);
  return joined([step.agent, model && (step.effort ? `${model}, ${step.effort}` : model)]);
}

/** Who ran a step, after a verb: "by task-reviewer · Opus 5.5, high", or "in the session" without an agent. */
export function byLabel(step: Parameters<typeof stepBy>[0]): string {
  return step?.agent ? `by ${stepBy(step)}` : stepBy(step);
}

/** A fix-check verdict on screen: `open` as "Still open", any other by its count name ("Not proportionate"). */
export function verdictLabel(verdict: string): string {
  return verdict === 'open' ? 'Still open' : countName(verdict);
}

/** A round's verdict on the step detail's stacked list: "Round 2: still open". */
export function roundVerdictLabel(round: number, verdict: string): string {
  return `Round ${round}: ${verdictLabel(verdict).toLowerCase()}`;
}

/** A finding's outcome takes the warning ink: Open and No outcome, on the graph's chips and the step detail's alike. */
export function outcomeWarns(outcome: Outcome | 'none' | null): boolean {
  return outcome == null || outcome === 'none' || outcome === 'open';
}

/** A count line's counts as lines, each its name (`countName`) and its number; null when the counts aren't known. */
export function countLines(counts: Record<string, number | null> | null): [string, number | null][] | null {
  return counts && Object.entries(counts).map(([key, n]) => [countName(key), n]);
}

/** A share as a whole percent: "8%"; a dash when it isn't known. */
export function formatShare(share: number | null): string {
  return formatPercent(share == null ? null : Math.round(share));
}

/** The sum of a record's or a list's counts, a count that isn't known as 0. */
export function total(counts: Record<string, number | null> | readonly (number | null)[]): number {
  return Object.values(counts).reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

const COMPACT = new Intl.NumberFormat('en-US', { notation: 'compact' });

/** A number written compact with its default rounding: "281K", "1.3M"; a dash when it isn't known. */
export function formatCompact(value: number | null): string {
  return value == null ? NONE : COMPACT.format(value);
}

/** A tool-result class's name on screen, in the Context page's column order. */
export const TOOL_CLASS_LABELS: Record<string, string> = {
  read: 'Read',
  bash_other: 'Bash',
  run: 'Run',
  agent: 'Agent',
  edit: 'Edit',
  mcp: 'MCP',
  other: 'Other',
};

/** The Context page's line for the units its sums leave out: "Not counted: 3 runs and 0 sessions with no context
 * facts." */
export function uncountedLabel({ runs, sessions }: { runs: number; sessions: number }): string {
  return `Not counted: ${plural(runs, 'run')} and ${plural(sessions, 'session')} with no context facts.`;
}

/** The Spend page's line for the units its sums leave out, in the approved mockup's words: "Not counted: 4 units with
 * no spend by phase (3 runs, 1 session); every week from Oct 4 is fully counted.", the last clause only when such a
 * week is known. */
export function spendUncountedLabel(
  { runs, sessions }: { runs: number; sessions: number },
  fullFrom: string | null,
): string {
  const counts = `Not counted: ${plural(runs + sessions, 'unit')} with no spend by phase (${plural(runs, 'run')}, ${plural(sessions, 'session')})`;
  return fullFrom === null ? `${counts}.` : `${counts}; every week from ${weekLabel(fullFrom)} is fully counted.`;
}

/** The tokens of every kind together, compact with one fraction digit: "9.8M", "333K", a kind that isn't known as 0; a
 * dash when they aren't known. */
export function formatTokens(tokens: Record<string, number | null> | null): string {
  if (tokens === null) return NONE;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(total(tokens));
}

/** A rule's name on the Steps and rules page, capitalised, as the static page names it; an offer's is followed by its
 * skill. */
export const RULE_LABELS = {
  failingTest: 'Failing-test check',
  dispatchGuard: 'Dispatch guard',
  advisor: 'Advisor',
  startup: 'Startup guidelines',
  fixRoundCap: 'Fix-round cap',
  stopRule: 'Stop rule',
  offer: 'Offer',
};

/** A finding's category by its display label from `labels` (a response's `categoryLabels`), its id when the labels
 * don't name it, or "unlabelled" while it has none. */
export function categoryLabel(category: string | null, labels: Record<string, string>): string {
  return category === null ? 'unlabelled' : (labels[category] ?? category);
}

/**
 * A finding's App column: "agrees" when the workflow made both calls (category and validity) and the app's label
 * matches them; else the app's category where it differs and its call (`countName`) where it differs or the workflow
 * made none; a dash with no app label.
 */
export function appCallLabel(f: FindingRow, labels: Record<string, string>): string {
  if (f.relevance === null) return NONE;
  const call = f.validity === null ? f.relevance : f.appRelevance;
  const differs = joined([f.appCategory && categoryLabel(f.appCategory, labels), call && countName(call)]);
  return differs || (f.judge === 'workflow' ? 'agrees' : countName(f.relevance));
}

/** A finding's or a strength's task as its Task cell shows it: the task's number, else its wave ("Wave A"), else null. */
export function taskLabel(f: { task: number | null; wave: string | null }): string | null {
  return f.task !== null ? String(f.task) : f.wave !== null ? `Wave ${f.wave}` : null;
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

export { closedFindings, foundFindings } from '@cwd/shared';

/** A skill or command on Home's skills and commands: a command with its slash, "/model", a skill bare. */
export function usageName(row: { name: string; kind: 'skill' | 'command' }): string {
  return row.kind === 'command' ? `/${row.name}` : row.name;
}

/** A session's name: its title, "no title" without one. */
export function sessionName(title: string | null): string {
  return title ?? 'no title';
}

/** A session's project: its name, "Other project" for one in no stored run's project. */
export function projectLabel(project: string | null): string {
  return project ?? 'Other project';
}

/** A day as "Nov 8", the time of day as "09:07" (en-US, 24-hour), the one pair of date options on every screen. */
const DAY = { month: 'short', day: 'numeric' } as const;
const CLOCK = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } as const;
// Built once: a call with options builds a new formatter each time, and a heatmap labels every cell.
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', DAY);
const DAY_TIME_FORMAT = new Intl.DateTimeFormat('en-US', { ...DAY, ...CLOCK });
const CLOCK_FORMAT = new Intl.DateTimeFormat('en-US', CLOCK);
const WEEK_FORMAT = new Intl.DateTimeFormat('en-US', { ...DAY, timeZone: 'UTC' });

/** A day in the reader's time zone, written in en-US: "Nov 12". */
export function formatDay(date: Date): string {
  return DAY_FORMAT.format(date);
}

/** A day and time in the reader's time zone, written in en-US on the 24-hour clock: "Nov 12, 10:20". */
export function formatDayTime(date: Date): string {
  return DAY_TIME_FORMAT.format(date);
}

/** A session's timeline times, in its order and the reader's time zone, written in en-US on the 24-hour clock: the
 * time of day, "09:07", with the date before it on the first entry and on the first entry of each new day,
 * "Nov 8, 08:02". */
export function timelineTimes(isos: string[]): string[] {
  const dates = isos.map((iso) => parseTime(iso));
  return dates.map((date, i) => {
    const newDay = i === 0 || date.toDateString() !== dates[i - 1].toDateString();
    return newDay ? formatDayTime(date) : CLOCK_FORMAT.format(date);
  });
}

/** A yes-or-no fact: "yes", "no", or a dash when it isn't known. */
export function yesNoLabel(value: boolean | null): string {
  return value === null ? NONE : value ? 'yes' : 'no';
}

/** A count with its noun, plural unless it is 1: "1 run", "2 runs". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** A fix loop's rounds as a screen reader hears them, saying when the last left findings open. */
export function roundsLabel(count: number, open: boolean): string {
  return open ? `${plural(count, 'round')}, the last left findings open` : plural(count, 'round');
}

/** The later fix commits' count on screen: "1 later fix", "2 later fixes". */
export function laterFixesLabel(count: number): string {
  return `${count} later ${count === 1 ? 'fix' : 'fixes'}`;
}

/** What the reporter counts as a later fix, the tooltip of its term. */
export const LATER_FIXES_TERM = 'Commits starting with "fix" that touched this run\'s files in the 14 days after it.';

/** A step box's warnings link's name, since a list of links reads it alone: "1 warning on Final review". */
export function stepWarningsLabel(count: number, step: StepKind): string {
  return `${plural(count, 'warning')} on ${STEP_LABELS[step]}`;
}

/** Showing mode's line for what it leaves out: "+ 2 runs in other projects, counted in totals and charts only". */
export function hiddenLabel(count: number, noun: string): string {
  return `+ ${plural(count, noun)} in other projects, counted in totals and charts only`;
}

/** The Work page's line for the period's sessions in no change: "4 sessions in this period belong to no change.". */
export function looseSessionsLabel(count: number): string {
  return `${plural(count, 'session')} in this period ${count === 1 ? 'belongs' : 'belong'} to no change.`;
}

/** A change's other projects beside its home project: "+2". */
export function otherCountLabel(count: number): string {
  return `+${formatWhole(count)}`;
}

/** The tooltip of a change's "+N": its other projects' names, then how many more showing mode doesn't name,
 * "tidepool-api, 1 other project". */
export function otherProjectsLabel(names: string[], count: number): string {
  const unnamed = count - names.length;
  return [...names, ...(unnamed > 0 ? [plural(unnamed, 'other project')] : [])].join(', ');
}

/** Compliance's line above its grid: the grid's warnings, its weeks and how many of the warnings are new, "41 warnings
 * in 8 weeks, 6 of them new since you last looked.". */
export function warningsSummary(warnings: number, weeks: number, fresh: number): string {
  return `${plural(warnings, 'warning')} in ${plural(weeks, 'week')}, ${fresh} of them new since you last looked.`;
}

/** Compliance's line for what showing mode left out of its list: other projects', sessions' and "other" warnings, the
 * last left out of the grid too. */
export function hiddenWarningsLabel(count: number): string {
  return `+ ${plural(count, 'warning')} left out while showing (other projects, sessions and other kinds); the grid counts all but other kinds`;
}

/** Compliance's line for the reporter's information lines showing mode hides: "3 information lines are hidden while
 * showing". */
export function hiddenInformationLabel(count: number): string {
  return `${plural(count, 'information line')} ${count === 1 ? 'is' : 'are'} hidden while showing`;
}

/** A week's start date, as an axis or a column names it: "Nov 8". */
export function weekLabel(week: string): string {
  return WEEK_FORMAT.format(new Date(week));
}

/** A whole percent, or a dash when it isn't known. */
export function formatPercent(percent: number | null): string {
  return percent === null ? NONE : `${percent}%`;
}

// The theme's sequential ramp, near zero to high, each step with the ink that reads on it in both modes (DESIGN.md's
// Chart colours); and the faint zero cell with secondary ink, for 0. Written out whole, so Tailwind finds the classes.
const SHADES = [
  'bg-shade-1 text-on-shade-1',
  'bg-shade-2 text-on-shade-2',
  'bg-shade-3 text-on-shade-3',
  'bg-shade-4 text-on-shade-4',
  'bg-shade-5 text-on-shade-5',
];
const ZERO_SHADE = 'bg-shade-zero text-on-shade-zero';

// The reserved status orange ("serious") for a warned element's border, and the warning ink for its text, readable on
// the panels in both modes (DESIGN.md's Status).
export const WARNING_BORDER = 'border-warning-edge';
export const WARNING_INK = 'text-warning-ink';
// The import notice's and showing mode's amber glass bar (DESIGN.md's Notice bars).
export const NOTICE = 'rounded-panel border border-notice-edge bg-notice text-sm text-notice-ink';
// The run page's two findings tables: each one's 4 px left side (its container's own border, so it follows the rounded
// corners), amber for problems and green for strengths, and its title icon's ink.
export const PROBLEMS_SIDE = 'border-l-4 border-l-notice-edge';
export const STRENGTHS_SIDE = 'border-l-4 border-l-success-edge';
export const PROBLEMS_INK = 'text-notice-edge';
export const STRENGTHS_INK = 'text-success-edge';

// A share bar (a meter): the ramp's dataviz blue for its fill (an empty bar, so the step's text colour does nothing),
// on the ramp's lightest step for its track.
export const SHARE_FILL = SHADES[3];
export const SHARE_TRACK = SHADES[0];

/** A heatmap cell's classes: its value's step of the ramp by its share of `max`, the grey for 0. */
export function cellShade(value: number, max: number): string {
  if (value <= 0 || max <= 0) return ZERO_SHADE;
  return SHADES[Math.min(SHADES.length, Math.ceil((SHADES.length * value) / max)) - 1];
}

/** A path's name on screen. */
export const PATH_LABELS: Record<Path, string> = { small: 'Small', full: 'Full', plan: 'Plan' };

/** How far a change got, or what a session held, on screen. */
export const STAGE_LABELS: Record<WorkStep, string> = { design: 'Design', plan: 'Plan', implementation: 'Implementation' };

/** A path on screen: its name, a path the dashboard doesn't know as it is; null for none. */
export function pathLabel(path: string | null): string | null {
  return path === null ? null : ((PATH_LABELS as Record<string, string>)[path] ?? path);
}

/** A model id in the reader's words: "claude-opus-5-5" as "Opus 5.5", "claude-fable-6-preview" as "Fable 6 preview",
 * a short name ("opus") capitalised, an id of another shape ("<synthetic>") as it is; null for none ("-" or empty). */
export function modelLabel(id: string | null | undefined): string | null {
  if (!id || id === '-') return null;
  // A dated id drops its date ("-20251001"), and the older shape "claude-3-5-sonnet" puts its family first.
  const name = id.replace(/-\d{8}$/, '').replace(/^claude-(\d+)(-\d+)?-([a-z]+)$/, 'claude-$3-$1$2');
  const match = /^(?:claude-)?([a-z]+)(?:-(\d+))?(?:-(\d+))?(?:-(.+))?$/.exec(name);
  if (!match) return id;
  const [, family, major, minor, rest] = match;
  const version = major ? ` ${major}${minor ? `.${minor}` : ''}` : '';
  return `${capitalize(family)}${version}${rest ? ` ${rest}` : ''}`;
}

/** A "model/effort" pair's two parts, the model through `modelLabel`, none ("-") as null. */
export function splitPair(pair: string): { model: string | null; effort: string | null } {
  const [model, effort] = pair.split('/');
  return { model: modelLabel(model), effort: !effort || effort === '-' ? null : effort };
}

/** A model and effort and how many ran so. */
export type Pair = { model: string | null; effort: string | null; count: number };

/** Counts by "model/effort" pair, each split by `splitPair`, in the counts' order. */
export const pairsOf = (counts: Record<string, number>): Pair[] =>
  Object.entries(counts).map(([pair, count]) => ({ ...splitPair(pair), count }));

const DOLLARS = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Dollars for a cell under a "($)" header: "12.40", "1,234.50". */
export function formatDollars(cost: number): string {
  return DOLLARS.format(cost);
}

const WHOLE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** A whole number with grouping, for a cell under a header that names its unit: "5,759". */
export function formatWhole(value: number): string {
  return WHOLE.format(value);
}

const COMPACT_FIXED = new Intl.NumberFormat('en-US', { notation: 'compact', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** A count compact with one fixed decimal, so a column of token counts lines up: "2.0M", "333.0K". */
export function formatCompactFixed(value: number): string {
  return COMPACT_FIXED.format(value);
}

/** A session's length in the largest units that fit, rounded to whole minutes first: "45 min", "7 h 46" under a day
 * (as `formatMinutes`), "3 d 11 h" from a day. */
export function formatLength(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 24 * 60) return formatMinutes(total);
  return `${Math.floor(total / (24 * 60))} d ${Math.floor((total % (24 * 60)) / 60)} h`;
}

/** A label's first letter in upper case: "important" as "Important". */
export function capitalize(label: string): string {
  return label ? label[0].toUpperCase() + label.slice(1) : label;
}

/** A warning's text for display: without the "WARN:" log prefix, without the run's own "branch (date): " lead when
 * `branch` is the run's, and with "{session}" in words, capitalised unless its first word is an identifier (one with
 * `/`, `_` or `-`: a branch, a step), which stays as written; the stored text stays whole. */
export function warningBody(text: string, branch: string | null = null): string {
  let body = text.replace(/^WARN:\s*/, '');
  if (branch && body.startsWith(`${branch} (`)) body = body.replace(/^.*?\):\s*/, '');
  body = body.replace(/^session \{session\}:?\s*/, '').replace(/\s*\{session\}\s*/, ' the session ').trim();
  return /^\S*[/_-]/.test(body) ? body : capitalize(body);
}
