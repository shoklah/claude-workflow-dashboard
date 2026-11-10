import {
  parseTime,
  SESSION_FILE,
  type RunEntry,
  type RunFacts,
  type SessionEntry,
  type SessionRow,
  type SessionsQuery,
  type SessionsResponse,
} from '@cwd/shared';
import type { StoredUnit, StoredWarning } from '../db/read.ts';
import { projectKey } from '../keys.ts';
import {
  currentWarnings,
  period,
  periodSessions,
  rootOf,
  sessionRootOf,
  skillOutcomeLabel,
  storedFacts,
  storedNames,
} from './runs.ts';
import { maskText, showFacts, showSession, type Scope } from './scope.ts';

const time = (at: string) => parseTime(at).getTime();

/**
 * A session's timeline, in time order: its skill loads with their outcome (skillOutcomeLabel), its commands, a command
 * `x:y` never loaded when an unmet typed trigger in `typed` (the session's and its held runs') has skill `y` and its
 * time, and its shown held runs' window starts; an untimed load or command is left out. Names are masked (maskText).
 */
function timelineOf(
  session: SessionEntry,
  typed: NonNullable<SessionEntry['typed']>,
  runs: { run: StoredUnit<RunEntry>; facts: RunFacts }[],
  scope: Scope | null,
): SessionRow['timeline'] {
  const unmet = typed.filter((t) => t.met === false);
  const neverLoaded = (name: string, at: string) => unmet.some((t) => t.skill === name.split(':').at(-1) && t.time === at);
  const item = (at: string, kind: 'skill' | 'command' | 'run', name: string) => ({
    at,
    kind,
    name,
    outcome: null,
    neverLoaded: false,
    runKey: null,
  });
  return [
    ...(session.skills ?? []).flatMap((s) =>
      s.time ? [{ ...item(s.time, 'skill', maskText(scope, s.name ?? '')), outcome: skillOutcomeLabel(s.outcome) }] : [],
    ),
    ...(session.commands ?? []).flatMap((c) =>
      c.time
        ? [{ ...item(c.time, 'command', maskText(scope, c.name ?? '')), neverLoaded: neverLoaded(c.name ?? '', c.time) }]
        : [],
    ),
    ...runs.flatMap(({ run, facts }) => {
      const at = run.merged.window?.start;
      return at ? [{ ...item(at, 'run', facts.branch ?? ''), runKey: run.key }] : [];
    }),
  ].sort((a, b) => time(a.at) - time(b.at));
}

/**
 * The Sessions page: the sessions that started in the query's period (periodSessions), newest start first. The
 * project filter keeps a session whose root is that project's (a session in no stored run's root is "other project",
 * with no key, which no project filter matches), the path filter one holding a run of that path, and "has warnings"
 * one with a current warning (currentWarnings). A session holds the runs whose window is in its transcript, by window
 * start. With a scope, only sessions in a shown project are listed (showSession), named by the scope, with no session
 * ID; a hidden held run is left out of its holds, timeline and path filter, the shown ones as showFacts gives them;
 * titles and names are masked (maskText); `hidden` counts the sessions that match the filters but aren't shown.
 */
export function sessionsView(input: {
  runs: StoredUnit<RunEntry>[];
  sessions: StoredUnit<SessionEntry>[];
  warnings: StoredWarning[];
  query: SessionsQuery;
  now: Date;
  scope: Scope | null;
}): SessionsResponse {
  const { query, scope } = input;
  const { weeks, filters } = period(query, input.now);
  const names = storedNames(input.runs);
  const runRoots = new Set(input.runs.map(rootOf));
  const warned = currentWarnings([], input.sessions, input.warnings);
  const sessions: SessionRow[] = [];
  let hidden = 0;

  for (const unit of periodSessions(input.sessions, weeks)) {
    const session = unit.merged;
    const root = sessionRootOf(session.project);
    const key = root && runRoots.has(root) ? projectKey(root) : null;
    const held = input.runs
      .filter((run) => run.merged.window?.transcript === session.file)
      .map((run) => ({ run, facts: storedFacts(run, names) }))
      .sort((a, b) => time(a.run.merged.window?.start ?? '') - time(b.run.merged.window?.start ?? ''));
    const warnings = warned.filter((w) => w.kind === 'session' && w.key === unit.key).length;
    // period's filters over the held runs, a session holding none matching no path filter.
    const matches = (holds: Pick<RunFacts, 'path'>[]) =>
      (query.path ? holds : [{ path: null }]).some((h) => filters({ path: h.path, projectKey: key ?? '' })) &&
      (!query.warnings || warnings > 0);

    if (!showSession(scope, session.project)) {
      if (matches(held.map((h) => h.facts))) hidden += 1;
      continue;
    }
    const shown = held.flatMap(({ run, facts }) => {
      const show = showFacts(scope, facts);
      return show ? [{ run, facts: show }] : [];
    });
    if (!matches(shown.map((s) => s.facts))) continue;

    const efforts = session.efforts ?? {};
    const mostUsed = (model: string) => Object.entries(efforts[model] ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const models = Object.entries(session.models ?? {}).sort((a, b) => (b[1].cost ?? 0) - (a[1].cost ?? 0));
    // A session in a period always has its start.
    const start = session.start!;
    const end = session.end ?? null;
    sessions.push({
      key: unit.key,
      title: maskText(scope, session.title ?? null),
      sessionId: scope ? null : (SESSION_FILE.exec(session.file)?.[1] ?? null),
      projectKey: key,
      project: key === null ? null : (scope?.names.get(key) ?? names.get(root!) ?? null),
      start,
      end,
      minutes: end === null ? null : (time(end) - time(start)) / 60000,
      models: models.map(([model]) => ({ model: maskText(scope, model), effort: maskText(scope, mostUsed(model)) })),
      // As runFacts' cost: null with no models, else the sum of the priced ones.
      cost: session.models ? models.reduce((sum, [, m]) => sum + (m.cost ?? 0), 0) : null,
      startup: session.startup ?? null,
      warnings,
      holds: shown.map(({ run, facts }) => ({ runKey: run.key, project: facts.project, branch: facts.branch, path: facts.path })),
      timeline: timelineOf(session, [session, ...held.map((h) => h.run.merged)].flatMap((u) => u.typed ?? []), shown, scope),
    });
  }

  return { sessions: sessions.sort((a, b) => time(b.start) - time(a.start)), hidden };
}
