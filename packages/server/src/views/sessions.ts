import {
  modelsCost,
  parseTime,
  sessionRootOf,
  splitSessionId,
  type RunEntry,
  type RunFacts,
  type SessionEntry,
  type SessionRow,
  type SessionsQuery,
  type SessionsResponse,
} from '@cwd/shared';
import type { StoredUnit, StoredWarning } from '../db/read.ts';
import {
  currentWarnings,
  period,
  periodSessions,
  rootOf,
  sessionProjectKey,
  skillOutcomeLabel,
  storedFacts,
  storedNames,
} from './runs.ts';
import { maskText, showFacts, showSession, type Scope } from './scope.ts';
import { commandSkill } from './skills.ts';

const time = (at: string) => parseTime(at).getTime();

/**
 * A session's timeline, in time order: its skill loads with their outcome (skillOutcomeLabel), its commands, a command
 * `x:y` never loaded when an unmet typed trigger in `typed` (the session's and its held runs') has skill `y` and its
 * time, and its shown held runs' window starts (the session's start for a run with none); an untimed load or command
 * is left out. Names are masked (maskText).
 */
function timelineOf(
  session: SessionEntry,
  typed: NonNullable<SessionEntry['typed']>,
  runs: { run: StoredUnit<RunEntry>; facts: RunFacts }[],
  scope: Scope | null,
): SessionRow['timeline'] {
  const unmet = typed.filter((t) => t.met === false);
  const neverLoaded = (name: string, at: string) => unmet.some((t) => t.skill === commandSkill(name) && t.time === at);
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
      const at = run.merged.window?.start ?? session.start;
      return at ? [{ ...item(at, 'run', facts.branch ?? ''), runKey: run.key }] : [];
    }),
  ].sort((a, b) => time(a.at) - time(b.at));
}

/**
 * A session's title (masked, maskText), session ID (null with a scope), project key (sessionProjectKey over the stored
 * runs' roots) and project name (the scope's, else the stored one; null for "other project"), for the Sessions and
 * Context views.
 */
export function sessionFacts(
  session: SessionEntry,
  runRoots: Set<string>,
  names: Map<string, string>,
  scope: Scope | null,
): { title: string | null; sessionId: string | null; projectKey: string | null; project: string | null } {
  const key = sessionProjectKey(session.project, runRoots);
  return {
    title: maskText(scope, session.title ?? null),
    sessionId: scope ? null : splitSessionId(session.file).sessionId,
    projectKey: key,
    project: key === null ? null : (scope?.names.get(key) ?? names.get(sessionRootOf(session.project)!) ?? null),
  };
}

/**
 * The Sessions page: the sessions that started in the query's period (periodSessions), newest start first. The
 * project filter keeps a session whose root is that project's (a session in no stored run's root is "other project",
 * with no key, which no project filter matches), the path filter one holding a run of that path, and "has warnings"
 * one with a current warning (currentWarnings). A session holds the runs whose window is in its transcript, by window
 * start, a run with none at the session's start. With a scope, only sessions in a shown project are listed
 * (showSession), named by the scope, with no session ID; a hidden held run is left out of its holds, timeline and path
 * filter, the shown ones as showFacts gives them; titles and names are masked (maskText); `hidden` counts the sessions
 * that match the filters but aren't shown.
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
  const warned = new Map<string, number>();
  for (const w of currentWarnings([], input.sessions, input.warnings)) warned.set(w.key, (warned.get(w.key) ?? 0) + 1);
  const byTranscript = new Map<string, StoredUnit<RunEntry>[]>();
  for (const run of input.runs) {
    const file = run.merged.window?.transcript;
    if (file) byTranscript.set(file, [...(byTranscript.get(file) ?? []), run]);
  }
  const sessions: SessionRow[] = [];
  let hidden = 0;

  for (const unit of periodSessions(input.sessions, weeks)) {
    const session = unit.merged;
    const key = sessionProjectKey(session.project, runRoots);
    // A session in a period always has its start.
    const start = session.start!;
    const runStart = ({ run }: { run: StoredUnit<RunEntry> }) => time(run.merged.window?.start ?? start);
    const held = (byTranscript.get(session.file) ?? [])
      .map((run) => ({ run, facts: storedFacts(run, names) }))
      .sort((a, b) => runStart(a) - runStart(b));
    const warnings = warned.get(unit.key) ?? 0;
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
    const end = session.end ?? null;
    sessions.push({
      key: unit.key,
      ...sessionFacts(session, runRoots, names, scope),
      start,
      end,
      minutes: end === null ? null : (time(end) - time(start)) / 60000,
      models: models.map(([model]) => ({ model: maskText(scope, model), effort: maskText(scope, mostUsed(model)) })),
      cost: modelsCost(session.models),
      startup: session.startup ?? null,
      warnings,
      holds: shown.map(({ run, facts }) => ({ runKey: run.key, project: facts.project, branch: facts.branch, path: facts.path })),
      timeline: timelineOf(session, [session, ...held.map((h) => h.run.merged)].flatMap((u) => u.typed ?? []), shown, scope),
    });
  }

  return { sessions: sessions.sort((a, b) => time(b.start) - time(a.start)), hidden };
}
