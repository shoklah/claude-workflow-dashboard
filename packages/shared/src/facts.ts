import { runKey } from './keys.ts';
import { PATHS, type Outcome, type Path, type RunEntry, type Step } from './report.ts';

export type FindingSplit = { total: number; actedOn: number; notActedOn: number; open: number };

export type RunFacts = {
  key: string;
  project: string;
  branch: string | null;
  path: Path | null;
  stage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  minutes: number | null;
  cost: number | null;
  findings: FindingSplit;
  warnings: number;
  stops: number | null;
  tasks: number | null;
  waves: number;
  beforeSteps: boolean;
};

const ACTED_ON: readonly Outcome[] = ['fixed', 'applied'];
const NOT_ACTED_ON: readonly Outcome[] = ['declined', 'deferred', 'ruled', 'to_owner'];

// A session transcript's file name, as the reporter writes it in a session warning.
const SESSION_FILE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl/i;

/** Every finding of every step: acted on = fixed or applied, not acted on = declined, deferred, ruled or to_owner,
 * open = open; a finding with no outcome counts in total only. */
export function splitFindings(steps: Step[]): FindingSplit {
  const split = { total: 0, actedOn: 0, notActedOn: 0, open: 0 };
  for (const finding of steps.flatMap((step) => step.findings ?? [])) {
    split.total += 1;
    const outcome = finding.outcome;
    if (!outcome) continue;
    if (ACTED_ON.includes(outcome)) split.actedOn += 1;
    else if (NOT_ACTED_ON.includes(outcome)) split.notActedOn += 1;
    else if (outcome === 'open') split.open += 1;
  }
  return split;
}

/** A warning's text with its first `<uuid>.jsonl` written `{session}`, and that UUID; the text as is when it has none. */
export function splitSessionId(text: string): { text: string; sessionId: string | null } {
  const match = SESSION_FILE.exec(text);
  if (!match) return { text, sessionId: null };
  return { text: text.replace(match[0], '{session}'), sessionId: match[1] };
}

/** A run's facts, each taken from its run entry as the reporter gives it. */
export function runFacts(run: RunEntry): RunFacts {
  const record = run.record;
  const key = runKey(run);
  // A run with no date has no key, and the import never stores one.
  if (key === null) throw new Error('a run with no date has no key');
  const path = PATHS.find((p) => p === record?.path) ?? null;
  return {
    key,
    // project: the last segment of record.project, so no path leaves the backend.
    project: (record?.project ?? '').split('/').filter(Boolean).at(-1) ?? '',
    branch: record?.branch ?? null,
    path,
    stage: record?.stage ?? null,
    startedAt: record?.started ?? null,
    // finishedAt: the record's date, the time the run finished.
    finishedAt: record?.date ?? null,
    // minutes: the reporter's run time, from started to date.
    minutes: run.minutes ?? null,
    // cost: null when models is null (no window), otherwise the sum of its entries' non-null cost (0 when none is
    // priced), as the reporter's spent does.
    cost: run.models ? Object.values(run.models).reduce((sum, m) => sum + (m.cost ?? 0), 0) : null,
    findings: splitFindings(run.steps ?? []),
    // warnings: the number of the run's warns.
    warnings: run.warns?.length ?? 0,
    // stops: record.stops.
    stops: record?.stops ?? null,
    tasks: record?.tasks ?? null,
    // waves: the length of waves.
    waves: run.waves?.length ?? 0,
    // beforeSteps: schema < 2, a record from before steps were logged; a missing schema is 1, as in the reporter.
    beforeSteps: (run.schema ?? 1) < 2,
  };
}
