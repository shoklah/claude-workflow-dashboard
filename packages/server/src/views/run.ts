import { modelsCost, parseTime, runFacts, type RunEntry, type RunPageResponse, type SessionEntry } from '@cwd/shared';
import type { ActiveList } from '../categories.ts';
import type { StoredLabel } from '../db/labels.ts';
import type { StoredUnit, StoredWarning } from '../db/read.ts';
import { maskModels, modelSums } from './models.ts';
import { rootOf, runView } from './runs.ts';
import { maskText, type Scope } from './scope.ts';
import { shownSession } from './sessions.ts';
import { maskPhase } from './spend.ts';

/** A finish time's milliseconds, Infinity when unknown, to sort runs by it. */
function finished(at: string | null): number {
  return at === null ? Infinity : parseTime(at).getTime();
}

/**
 * The run page: runView of the run (null when it is), with its session (the stored one whose file is its transcript)
 * and the one it handed off to (its context's `handoff_to`), each as shownSession names it; the other stored runs of
 * its project root and branch, in the order they finished (none without a branch); its offers, later fixes (no sha), agents (modelSums' rows), main session and phases'
 * costs (modelsCost). With a scope, offers' skills and fixes' subjects are masked (maskText), agents and main as Models
 * masks them (maskModels), and phase names as Spend does (maskPhase).
 */
export function runPageView(input: {
  run: StoredUnit<RunEntry>;
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  warnings: StoredWarning[];
  names: Map<string, string>;
  scope: Scope | null;
  labels: Map<string, StoredLabel>;
  list: ActiveList | null;
}): RunPageResponse | null {
  const { run, runs, sessions, names, scope } = input;
  const view = runView(run, input.warnings, names, scope, input.labels, input.list);
  if (!view) return null;
  const entry = run.merged;
  const runRoots = new Set(runs.map(rootOf));
  const sessionOf = (found: StoredUnit<SessionEntry> | undefined) =>
    shownSession(found?.merged, runRoots, names, scope);
  const transcript = entry.window?.transcript;
  const handoffTo = entry.context?.handoff_to;
  const root = rootOf(run);
  const branch = entry.record?.branch ?? null;
  const masked = maskModels(scope, entry);
  return {
    ...view,
    session: sessionOf(transcript ? sessions.find((s) => s.merged.file === transcript) : undefined),
    handoffTo: sessionOf(handoffTo ? sessions.find((s) => s.key === handoffTo) : undefined),
    // A run with no branch has no branch to share; the others come in the order they finished, unknown times last.
    related: branch === null ? [] : runs
      .filter((u) => u.key !== run.key && rootOf(u) === root && u.merged.record?.branch === branch)
      .map((u) => {
        const { path, finishedAt } = runFacts(u.merged);
        return { key: u.key, path, finishedAt };
      })
      .sort((a, b) => (a.finishedAt === b.finishedAt ? 0 : finished(a.finishedAt) - finished(b.finishedAt))),
    offers: (entry.offers ?? []).map((o) => ({ skill: maskText(scope, o.skill ?? ''), outcome: o.outcome ?? '' })),
    laterFixes: (entry.later_fixes ?? []).map((f) => ({ date: f.date ?? null, subject: maskText(scope, f.subject ?? '') })),
    agents: Object.entries(modelSums([masked]).agents)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, row]) => ({ name, actual: row.actual })),
    main: masked.main ? { model: masked.main.model ?? null, effort: masked.main.effort ?? null } : null,
    phases: (entry.phases ?? []).map((p) => ({ name: maskPhase(scope, p.name), cost: modelsCost(p.models) })),
  };
}
