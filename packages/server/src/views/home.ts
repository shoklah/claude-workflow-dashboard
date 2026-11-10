import {
  parseTime,
  PATHS,
  runFacts,
  splitFindings,
  STEP_KINDS,
  weekOf,
  type Path,
  type DiagramStep,
  type FeedItem,
  type FixLine,
  type HomeResponse,
  type RunEntry,
  type RunFacts,
  type SessionEntry,
  type SkillRow,
  type Step,
  type StepKind,
  type Usage,
  type UsageRow,
  type WeekNumbers,
  type WeekRow,
} from '@cwd/shared';
import type { StoredUnit, StoredWarning } from '../db/read.ts';
import { currentWarnings, period, periodUnits, sessionWarningShown, storedFacts, storedNames } from './runs.ts';
import { maskText, showFacts, showWarning, type Scope } from './scope.ts';
import { commandSkill, skillSums } from './skills.ts';

type Run = { unit: StoredUnit<RunEntry>; facts: RunFacts; finished: Date };

const DAY = 24 * 60 * 60 * 1000;
const CHART_WEEKS = 12;
const FEED_SIZE = 50;
// The diagram's tabs: plan records' steps then Full runs' steps, as in the workflow's README diagram; Small runs'.
const FULL_STEPS: StepKind[] = ['plan_simplify', 'plan_review', 'task_review', 'simplify', 'final_review'];
const SMALL_STEPS: StepKind[] = ['task_review', 'simplify', 'final_review'];
const FIX_CHECKS: StepKind[] = ['fix_check', 'final_fix_check'];
// No runs on any path, a fresh object each time since weekSums adds to it.
const noRuns = (): WeekRow['runs'] => Object.fromEntries(PATHS.map((p) => [p, 0])) as Record<Path, number>;

/** The median of the values that aren't null, or null when there are none, as the reporter's median_or_none. */
export function median(values: (number | null)[]): number | null {
  const known = values.filter((v) => v !== null).sort((a, b) => a - b);
  if (known.length === 0) return null;
  const mid = Math.floor(known.length / 2);
  return known.length % 2 ? known[mid] : (known[mid - 1] + known[mid]) / 2;
}

/** A week with no runs: every count 0, every sum of known values null. */
export function emptyWeek(): WeekRow {
  return {
    runs: noRuns(),
    tasks: 0,
    findings: { critical: 0, important: 0, minor: 0, unneeded: 0 },
    fixRounds: 0,
    stops: 0,
    fablePoints: null,
    allPoints: null,
    cost: null,
    minutesPerRun: null,
    laterFixes: 0,
  };
}

// A sum of known values: null until one is known.
const addKnown = (sum: number | null, value: number | null | undefined) => (value == null ? sum : (sum ?? 0) + value);

/**
 * Per week start date, over the runs with a date, as the reporter's week_rows: `runs`, the runs by path; `tasks`,
 * `fixRounds` and `stops`, the sums of the records' (a missing one 0); `findings`, the sum of the runs'
 * final_findings; `fablePoints` and `allPoints`, the sums of the runs' known points, null when none has them; `cost`,
 * the sum of the runs' costs (RunFacts.cost), null when no run of the week has one; `minutesPerRun`, the median of the
 * runs' known minutes; `laterFixes`, the runs' later fix commits.
 */
export function weekSums(runs: RunEntry[]): Map<string, WeekRow> {
  const sums = new Map<string, WeekRow>();
  const minutes = new Map<string, (number | null)[]>();
  for (const run of runs) {
    if (!run.record?.date) continue;
    const facts = runFacts(run);
    const week = weekOf(parseTime(run.record.date));
    const sum = sums.get(week) ?? emptyWeek();
    if (facts.path) sum.runs[facts.path] += 1;
    sum.tasks += run.record.tasks ?? 0;
    sum.fixRounds += run.record.fix_rounds ?? 0;
    sum.stops += run.record.stops ?? 0;
    for (const key of ['critical', 'important', 'minor', 'unneeded'] as const) {
      sum.findings[key] += run.final_findings?.[key] ?? 0;
    }
    sum.fablePoints = addKnown(sum.fablePoints, run.fable_points);
    sum.allPoints = addKnown(sum.allPoints, run.all_points);
    sum.cost = addKnown(sum.cost, facts.cost);
    sum.laterFixes += run.later_fixes?.length ?? 0;
    if (!minutes.has(week)) minutes.set(week, []);
    minutes.get(week)!.push(facts.minutes);
    sums.set(week, sum);
  }
  for (const [week, sum] of sums) sum.minutesPerRun = median(minutes.get(week)!);
  return sums;
}

/** The earliest finish time of the runs whose transcript the reporter could read, null when none is readable. */
export function coverageFrom(runs: StoredUnit<RunEntry>[]): string | null {
  const times = runs.filter((r) => r.readable).map((r) => r.merged.record?.date ?? '');
  return times.sort((a, b) => parseTime(a).getTime() - parseTime(b).getTime())[0] ?? null;
}

/**
 * Home's skills and commands over a period's runs and sessions. A skill is a name in `skillNames` (every stored unit's
 * loaded or typed skills, so a name's kind is the same in every period) or loaded or typed in the period; a command
 * `x:y` names skill `y`. A skill's row, for a skill loaded, typed or named by a command in the period: `sessions`, the
 * sessions that loaded it, typed it or typed a command naming it; `runs`, the runs that loaded it, both by skillSums;
 * `typed`, its typed triggers on runs and sessions; `typedNeverLoaded`, those never met (skillSums' missing over the
 * triggers). A command naming no skill gets a command row: the sessions that typed it and its commands. Rows are
 * ordered by sessions, most first, then by name. With a scope, every name is masked (maskText) first, so names that
 * mask alike merge and the sums still count every project.
 */
export function usageSums(
  runs: RunEntry[],
  sessions: SessionEntry[],
  scope: Scope | null,
  skillNames: string[],
): Usage {
  const mask = (name: string | null | undefined) => maskText(scope, name ?? '');
  const masked = (unit: RunEntry | SessionEntry) => ({
    skills: unit.skills?.map((s) => ({ ...s, name: mask(s.name) })),
    typed: unit.typed?.map((t) => ({ ...t, skill: mask(t.skill) })),
  });
  const runUnits = runs.map(masked);
  const sessionUnits = sessions.map(masked);
  const typed = [...runUnits, ...sessionUnits].flatMap((unit) => unit.typed ?? []);
  const byName = (rows: SkillRow[]) => new Map(rows.map((row) => [row.name, row]));
  const all = byName(skillSums([...runUnits, ...sessionUnits]));
  const skills = new Set([...skillNames.map(mask), ...all.keys()]);
  const skillOf = (command: { name?: string | null }) => mask(commandSkill(command.name));
  // A session's loads, plus a load for each skill it typed and each command naming a skill, so skillSums counts the
  // session once.
  const inSessions = byName(
    skillSums(
      sessions.map((session, i) => ({
        skills: [
          ...(sessionUnits[i].skills ?? []),
          ...(sessionUnits[i].typed ?? []).map((t) => ({ name: t.skill })),
          ...(session.commands ?? []).map((c) => ({ name: skillOf(c) })).filter((c) => skills.has(c.name)),
        ],
      })),
    ),
  );
  const inRuns = byName(skillSums(runUnits));
  const used = new Set([...all.keys(), ...typed.map((t) => t.skill ?? ''), ...inSessions.keys()]);
  const rows: UsageRow[] = [...used].map((name) => ({
    name,
    kind: 'skill',
    sessions: inSessions.get(name)?.runs ?? 0,
    runs: inRuns.get(name)?.runs ?? 0,
    typed: typed.filter((t) => t.skill === name).length,
    typedNeverLoaded: all.get(name)?.missing ?? 0,
  }));
  const commands = new Map<string, UsageRow>();
  for (const session of sessions) {
    const names = (session.commands ?? []).filter((c) => !skills.has(skillOf(c))).map((c) => mask(c.name));
    for (const name of names) {
      if (!commands.has(name)) {
        commands.set(name, { name, kind: 'command', sessions: 0, runs: null, typed: 0, typedNeverLoaded: null });
      }
      commands.get(name)!.typed += 1;
    }
    for (const name of new Set(names)) commands.get(name)!.sessions += 1;
  }
  rows.push(...commands.values());
  rows.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  return { sessions: sessions.length, runs: runs.length, rows };
}

/** A diagram tab's step boxes: per step kind, the steps that ran, their findings and those acted on, and the warnings
 * naming it. */
function diagramSteps(steps: Step[], kinds: StepKind[], warnings: StoredWarning[]): DiagramStep[] {
  return kinds.map((step) => {
    const ran = steps.filter((s) => s.step === step);
    const split = splitFindings(ran);
    const named = warnings.filter((w) => w.stepKind === step).length;
    return { step, ran: ran.length, findings: split.total, actedOn: split.actedOn, warnings: named };
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

/** The home screen, from the stored runs and warnings: every number is a plain sum over the runs' own facts. With a
 * scope, the numbers (the diagram's warnings, session ones included) still count every run and session, but the feed
 * holds only the shown projects' runs, run warnings and session warnings (showSession). */
export function homeView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  warnings: StoredWarning[];
  seenAt: Date | null;
  now: Date;
  scope: Scope | null;
}): HomeResponse {
  const { seenAt, now, scope } = input;
  // Only the current warnings show (currentWarnings).
  const warnings = currentWarnings(input.runs, input.sessions, input.warnings);
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
  const weeks = period({ weeks: CHART_WEEKS }, now).weeks;
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
  const fullRuns = withSteps.filter((r) => r.facts.path === 'full' || r.facts.path === 'plan');
  const smallRuns = withSteps.filter((r) => r.facts.path === 'small');
  const fullSteps = stepsOf(fullRuns);
  const smallSteps = stepsOf(smallRuns);
  // A tab's warnings: the current warnings of its runs, and the session warnings first seen in the 7 days, with a scope
  // too, since counts include every project.
  const recentSessions = warnings.filter(
    (w) => w.kind === 'session' && w.firstSeenAt.getTime() > now.getTime() - 7 * DAY,
  );
  const warningsOf = (of: Run[]) => {
    const keys = new Set(of.map((r) => r.unit.key));
    return [...warnings.filter((w) => w.kind === 'run' && keys.has(w.key)), ...recentSessions];
  };

  // The feed's runs: with a scope, the shown projects' runs, named by the scope.
  const shown = runs.flatMap((r) => {
    const facts = showFacts(scope, r.facts);
    return facts ? [{ ...r, facts }] : [];
  });
  const byKey = new Map(shown.map((r) => [r.unit.key, r]));
  const runItems = shown
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
  // With a scope, a hidden run's warnings and the warnings of a session in no shown root are left out.
  const sessionShown = sessionWarningShown(scope, input.sessions);
  const warningItems = warnings
    .filter(
      (w) =>
        isNew(w.firstSeenAt) &&
        (w.kind === 'run' ? byKey.has(w.key) : sessionShown(w.key)),
    )
    .map((w): FeedItem => {
      const run = w.kind === 'run' ? byKey.get(w.key) : undefined;
      return {
        at: w.firstSeenAt.toISOString(),
        type: 'warning',
        runKey: run?.unit.key ?? null,
        project: run?.facts.project ?? null,
        branch: run?.facts.branch ?? null,
        path: null,
        ...showWarning(scope, w.text),
        findings: null,
        minutes: null,
        cost: null,
      };
    });

  // Every stored unit's loaded or typed skills, so a command's kind is the same in every period.
  const skillNames = [
    ...new Set(
      [...input.runs, ...input.sessions].flatMap(({ merged }) => [
        ...(merged.skills ?? []).map((s) => s.name ?? ''),
        ...(merged.typed ?? []).map((t) => t.skill ?? ''),
      ]),
    ),
  ];
  const usageOf = (weeks: number) => {
    const units = periodUnits(input.runs, input.sessions, { weeks }, now);
    return usageSums(units.runs, units.sessions, scope, skillNames);
  };

  return {
    thisWeek: numbers[CHART_WEEKS - 1],
    lastWeek: numbers[CHART_WEEKS - 2],
    diagram: {
      full: diagramSteps(fullSteps, FULL_STEPS, warningsOf(fullRuns)),
      small: diagramSteps(smallSteps, SMALL_STEPS, warningsOf(smallRuns)),
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
    coverageFrom: coverageFrom(input.runs),
    // Skills and commands over this week's and the last four weeks' runs and sessions (periodUnits).
    usage: { thisWeek: usageOf(1), lastFourWeeks: usageOf(4) },
  };
}
