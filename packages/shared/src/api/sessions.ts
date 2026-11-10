import type { Path } from '../report.ts';
import type { FindingsQuery } from './findings.ts';

/** `GET /api/sessions`'s query: the period's, plus `warnings=1`. */
export type SessionsQuery = FindingsQuery & { warnings: boolean };

/**
 * A session as the Sessions page lists it: its stored key, title, session ID (null while showing), project (key and
 * name, null for "other project"), start and end, length in minutes, models by cost with each one's most-used effort,
 * cost, startup, current warnings, the runs its transcript holds, and its skill loads, commands and held runs' window
 * starts in time order. A command is `neverLoaded` when an unmet typed trigger has its skill and time.
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
  holds: { runKey: string; project: string; branch: string | null; path: Path | null }[];
  timeline: {
    at: string;
    kind: 'skill' | 'command' | 'run';
    name: string;
    outcome: string | null;
    neverLoaded: boolean;
    runKey: string | null;
  }[];
};

/** `GET /api/sessions`: the period's sessions that match the filters, newest start first, and how many showing mode
 * left out. */
export type SessionsResponse = { sessions: SessionRow[]; hidden: number };
