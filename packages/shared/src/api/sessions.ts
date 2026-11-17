import type { Path } from '../report.ts';
import type { FindingsQuery } from './findings.ts';

/** `GET /api/sessions`'s query: the period's, plus `warnings=1`, `goal` (a goal's key) and `session` (a session's key,
 * which lists that session alone, whatever the other filters). */
export type SessionsQuery = FindingsQuery & { warnings: boolean; goal?: string; session?: string };

/**
 * A session as the Sessions page lists it: its stored key, title, session ID (null while showing), project (key and
 * name, null for "other project"), start and end, length in minutes, models by cost with each one's most-used effort,
 * cost, startup, current warnings, its change and goal as Work lists them, the runs its transcript holds, and its skill
 * loads, commands and held runs' window starts in time order (a run's with its headline). A command is `neverLoaded`
 * when an unmet typed trigger has its skill and time.
 */
export type SessionRow = {
  key: string;
  title: string | null;
  sessionId: string | null;
  projectKey: string | null;
  project: string | null;
  start: string;
  end: string | null;
  minutes: number | null;
  models: { model: string; effort: string | null }[];
  cost: number | null;
  startup: boolean | null;
  warnings: number;
  change: { key: string; title: string } | null;
  goal: { key: string; name: string } | null;
  holds: { runKey: string; project: string; branch: string | null; headline: string | null; path: Path | null }[];
  timeline: {
    at: string;
    kind: 'skill' | 'command' | 'run';
    name: string;
    headline: string | null;
    outcome: string | null;
    neverLoaded: boolean;
    runKey: string | null;
  }[];
};

/** `GET /api/sessions`: the period's sessions that match the filters, newest start first, how many showing mode left
 * out, and the Goal select's options. */
export type SessionsResponse = { sessions: SessionRow[]; hidden: number; goalOptions: { key: string; name: string }[] };
