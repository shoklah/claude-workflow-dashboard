import type { Area, FindingSplit, FindingsResponse, RunFacts, StepKind } from '@cwd/shared';

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

// The categories whose display label adds the spec's parentheses; the others show as they are stored.
const CATEGORY_LABELS: Record<string, string> = {
  scope: 'scope (missing or extra work)',
  simplicity: 'simplicity (over-building)',
};

/** A finding's category as the app's label shows it, or "unlabelled" while it has none. */
export function categoryLabel(category: string | null): string {
  return category === null ? 'unlabelled' : (CATEGORY_LABELS[category] ?? category);
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

/** A count with its noun, plural unless it is 1: "1 run", "2 runs". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/** Showing mode's line for what it leaves out: "+ 2 runs in other projects, counted in totals and charts only". */
export function hiddenLabel(count: number, noun: string): string {
  return `+ ${plural(count, noun)} in other projects, counted in totals and charts only`;
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
