import {
  parseTime,
  PATHS,
  runFacts,
  splitFindings,
  splitSessionId,
  STEP_KINDS,
  weekOf,
  weekStart,
  type Path,
  type DiagramStep,
  type FeedItem,
  type FixLine,
  type HomeResponse,
  type RunEntry,
  type RunFacts,
  type Step,
  type StepKind,
  type WeekNumbers,
} from '@cwd/shared';
import type { StoredUnit, StoredWarning } from '../db/read.ts';
import { currentWarnings, storedFacts, storedNames } from './runs.ts';

type WeekSum = { runs: WeekNumbers['runs']; cost: number | null };
type Run = { unit: StoredUnit<RunEntry>; facts: RunFacts; finished: Date };

const DAY = 24 * 60 * 60 * 1000;
const CHART_WEEKS = 12;
const FEED_SIZE = 50;
// The diagram's tabs: plan records' steps then Full runs' steps, as in the workflow's README diagram; Small runs'.
const FULL_STEPS: StepKind[] = ['plan_simplify', 'plan_review', 'task_review', 'simplify', 'final_review'];
const SMALL_STEPS: StepKind[] = ['task_review', 'simplify', 'final_review'];
const FIX_CHECKS: StepKind[] = ['fix_check', 'final_fix_check'];
// No runs on any path, a fresh object each time since weekSums adds to it.
const noRuns = (): WeekSum['runs'] => Object.fromEntries(PATHS.map((p) => [p, 0])) as Record<Path, number>;

/**
 * Per week start date, over the runs with a date, as the reporter's week_rows: `runs`, the runs by path; `cost`, the
 * sum of the runs' costs (RunFacts.cost), null when no run of the week has one.
 */
export function weekSums(runs: RunEntry[]): Map<string, WeekSum> {
  const sums = new Map<string, WeekSum>();
  for (const run of runs) {
    if (!run.record?.date) continue;
    const facts = runFacts(run);
    const week = weekOf(parseTime(run.record.date));
    const sum = sums.get(week) ?? { runs: noRuns(), cost: null };
    if (facts.path) sum.runs[facts.path] += 1;
    if (facts.cost !== null) sum.cost = (sum.cost ?? 0) + facts.cost;
    sums.set(week, sum);
  }
  return sums;
}

/** A diagram tab's step boxes: per step kind, the steps that ran, their findings and those acted on. */
function diagramSteps(steps: Step[], kinds: StepKind[]): DiagramStep[] {
  return kinds.map((step) => {
    const ran = steps.filter((s) => s.step === step);
    const split = splitFindings(ran);
    return { step, ran: ran.length, findings: split.total, actedOn: split.actedOn, warnings: 0 };
  });
}

/** The fix-check line: the fix_check and final_fix_check steps, those left with an open finding, and round 3 ones. */
function fixLine(steps: Step[]): FixLine {
  const checks = steps.filter((s) => s.step != null && FIX_CHECKS.includes(s.step));
  return {
    ran: checks.length,
    open: checks.filter((s) => (s.counts?.open ?? 0) > 0).length,
    roundThree: checks.filter((s) => s.round === 3).length,
  };
}

/** The home screen, from the stored runs and warnings: every number is a plain sum over the runs' own facts. */
export function homeView(input: {
  runs: StoredUnit<RunEntry>[];
  warnings: StoredWarning[];
  seenAt: Date | null;
  now: Date;
}): HomeResponse {
  const { seenAt, now } = input;
  // Only the current warnings show: a run's are the texts in its latest warns.
  const warnings = currentWarnings(input.runs, input.warnings);
  // Stored runs always have a date: the import skips a run without one.
  const names = storedNames(input.runs);
  const runs: Run[] = input.runs.map((unit) => {
    const facts = storedFacts(unit, names);
    return { unit, facts, finished: parseTime(facts.finishedAt!) };
  });
  const isNew = (firstSeenAt: Date) => seenAt === null || firstSeenAt > seenAt;
  const sums = weekSums(runs.map((r) => r.unit.merged));
  const stepsOf = (of: Run[]) => of.flatMap((r) => r.unit.merged.steps ?? []);

  // The charts' weeks: this week and the 11 before it, oldest first.
  const start = weekStart(now).getTime();
  const weeks = Array.from({ length: CHART_WEEKS }, (_, i) =>
    weekOf(new Date(start - (CHART_WEEKS - 1 - i) * 7 * DAY)),
  );
  const byWeek = weeks.map((week) => runs.filter((r) => weekOf(r.finished) === week));

  function weekNumbers(week: string, inWeek: Run[]): WeekNumbers {
    const sum = sums.get(week);
    const cost = sum?.cost ?? null;
    const sessionWarnings = warnings.filter((w) => w.kind === 'session' && weekOf(w.firstSeenAt) === week);
    const newRunWarnings = warnings.filter(
      (w) => w.kind === 'run' && isNew(w.firstSeenAt) && inWeek.some((r) => r.unit.key === w.key),
    );
    return {
      runs: sum?.runs ?? noRuns(),
      // findings: every finding of the week's runs' steps, the sum of their RunFacts.findings.
      findings: splitFindings(stepsOf(inWeek)),
      cost,
      // costPerRun: the week's cost over its number of runs.
      costPerRun: cost === null ? null : cost / inWeek.length,
      // warnings: the week's runs' RunFacts.warnings (their latest warns), plus the session warnings first seen in the
      // week; newWarnings: those of them first seen after seenAt.
      warnings: inWeek.reduce((n, r) => n + r.facts.warnings, 0) + sessionWarnings.length,
      newWarnings: newRunWarnings.length + sessionWarnings.filter((w) => isNew(w.firstSeenAt)).length,
    };
  }
  const numbers = weeks.map((week, i) => weekNumbers(week, byWeek[i]));

  // The diagram: runs finished in the last 7 days; a schema 1 run, from before steps were logged, only counts in
  // beforeSteps.
  const recent = runs.filter((r) => r.finished.getTime() > now.getTime() - 7 * DAY);
  const withSteps = recent.filter((r) => !r.facts.beforeSteps);
  const fullSteps = stepsOf(withSteps.filter((r) => r.facts.path === 'full' || r.facts.path === 'plan'));
  const smallSteps = stepsOf(withSteps.filter((r) => r.facts.path === 'small'));

  const byKey = new Map(runs.map((r) => [r.unit.key, r]));
  const runItems = runs
    .filter((r) => isNew(r.unit.firstSeenAt))
    .map(({ unit, facts, finished }): FeedItem => ({
      at: finished.toISOString(),
      type: 'run',
      runKey: unit.key,
      project: facts.project,
      branch: facts.branch,
      path: facts.path,
      text: null,
      sessionId: null,
      findings: facts.findings,
      minutes: facts.minutes,
      cost: facts.cost,
    }));
  const warningItems = warnings
    .filter((w) => isNew(w.firstSeenAt))
    .map((w): FeedItem => {
      const run = w.kind === 'run' ? byKey.get(w.key) : undefined;
      return {
        at: w.firstSeenAt.toISOString(),
        type: 'warning',
        runKey: run?.unit.key ?? null,
        project: run?.facts.project ?? null,
        branch: run?.facts.branch ?? null,
        path: null,
        ...splitSessionId(w.text),
        findings: null,
        minutes: null,
        cost: null,
      };
    });

  const readable = runs.filter((r) => r.unit.readable).sort((a, b) => a.finished.getTime() - b.finished.getTime());

  return {
    thisWeek: numbers[CHART_WEEKS - 1],
    lastWeek: numbers[CHART_WEEKS - 2],
    diagram: {
      full: diagramSteps(fullSteps, FULL_STEPS),
      small: diagramSteps(smallSteps, SMALL_STEPS),
      fixChecks: { full: fixLine(fullSteps), small: fixLine(smallSteps) },
      beforeSteps: recent.filter((r) => r.facts.beforeSteps).length,
    },
    charts: {
      weeks,
      // findingsByStep: per step kind and week, the findings of that kind of step in the week's runs.
      findingsByStep: Object.fromEntries(
        STEP_KINDS.map((kind) => [
          kind,
          byWeek.map((of) => splitFindings(stepsOf(of).filter((s) => s.step === kind)).total),
        ]),
      ) as Record<StepKind, number[]>,
      cost: numbers.map((n) => n.cost),
      warnings: numbers.map((n) => n.warnings),
    },
    // The feed: the runs and warnings first seen after seenAt, newest first; a run at its finish time.
    feed: [...runItems, ...warningItems].sort((a, b) => b.at.localeCompare(a.at)).slice(0, FEED_SIZE),
    // coverageFrom: the earliest finish time of the runs whose transcript the reporter could read.
    coverageFrom: readable[0]?.facts.finishedAt ?? null,
  };
}
