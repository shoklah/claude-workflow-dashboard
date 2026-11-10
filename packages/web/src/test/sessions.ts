import type { SessionRow, SessionsResponse } from '@cwd/shared';
import { fullRun, smallRun } from './runs.ts';

// Invented answers of GET /api/sessions for the Sessions page's stories.

export const sessionsEmpty: SessionsResponse = { sessions: [], hidden: 0 };

/** A session whose transcript holds two runs, with a /grill-me whose skill never loaded. */
export const twoRunSession: SessionRow = {
  key: 'f1e2d3c4b5a69788',
  title: 'Plan the search index',
  sessionId: '7d1e4b2a-9c3f-4a8e-b5d6-1f2e3a4b5c6d',
  projectKey: fullRun.projectKey,
  project: 'atlas',
  start: '2026-11-10T09:07:00Z',
  end: '2026-11-10T11:47:00Z',
  minutes: 160,
  models: [{ model: 'claude-opus-5-5', effort: 'medium' }],
  cost: 1.05,
  startup: true,
  warnings: 1,
  holds: [
    { runKey: fullRun.key, project: 'atlas', branch: 'feat/search', path: 'full' },
    { runKey: smallRun.key, project: 'harbor', branch: 'fix/retry', path: 'small' },
  ],
  timeline: [
    { at: '2026-11-10T09:07:00Z', kind: 'skill', name: 'brainstorming', outcome: 'wrote a file', neverLoaded: false, runKey: null },
    { at: '2026-11-10T09:31:00Z', kind: 'command', name: 'graphify', outcome: null, neverLoaded: false, runKey: null },
    { at: '2026-11-10T10:02:00Z', kind: 'command', name: 'grill-me', outcome: null, neverLoaded: true, runKey: null },
    { at: '2026-11-10T10:40:00Z', kind: 'run', name: 'feat/search', outcome: null, neverLoaded: false, runKey: fullRun.key },
    { at: '2026-11-10T11:12:00Z', kind: 'command', name: 'model', outcome: null, neverLoaded: false, runKey: null },
    { at: '2026-11-10T11:20:00Z', kind: 'run', name: 'fix/retry', outcome: null, neverLoaded: false, runKey: smallRun.key },
  ],
};

/** A session with no title in no stored run's project, its startup guidelines missing. */
export const otherSession: SessionRow = {
  key: 'a9b8c7d6e5f40312',
  title: null,
  sessionId: 'e81b2d77-4c5a-4b3e-9f1d-2a6c8e0b7d34',
  projectKey: null,
  project: null,
  start: '2026-11-08T18:02:00Z',
  end: '2026-11-08T18:14:00Z',
  minutes: 12,
  models: [{ model: 'claude-sonnet-5-5', effort: 'high' }],
  cost: 0.12,
  startup: false,
  warnings: 1,
  holds: [],
  timeline: [{ at: '2026-11-08T18:05:00Z', kind: 'command', name: 'model', outcome: null, neverLoaded: false, runKey: null }],
};

/** A session with no command, no run and no warning. */
export const quietSession: SessionRow = {
  key: 'b0c1d2e3f4a59687',
  title: 'Debug the export timeout',
  sessionId: '0c55f1ae-8d2b-4e7c-a3f9-6b1d4e8c2a50',
  projectKey: smallRun.projectKey,
  project: 'harbor',
  start: '2026-11-06T11:30:00Z',
  end: '2026-11-06T12:35:00Z',
  minutes: 65,
  models: [{ model: 'claude-opus-5-5', effort: 'high' }],
  cost: 2.4,
  startup: true,
  warnings: 0,
  holds: [],
  timeline: [
    { at: '2026-11-06T11:32:00Z', kind: 'skill', name: 'systematic-debugging', outcome: 'ran', neverLoaded: false, runKey: null },
  ],
};

export const sessionsFull: SessionsResponse = { sessions: [twoRunSession, otherSession, quietSession], hidden: 0 };

/** Showing mode on: no session ID, and two sessions in other projects left out. */
export const sessionsHidden: SessionsResponse = {
  sessions: [
    {
      ...twoRunSession,
      sessionId: null,
      holds: twoRunSession.holds.slice(0, 1),
      timeline: twoRunSession.timeline.filter((t) => t.runKey !== smallRun.key),
    },
  ],
  hidden: 2,
};
