import type { ChangeRow, GoalSection, WorkResponse } from '@cwd/shared';
import { HTML_TEXT } from './runs.ts';

// Invented answers of GET /api/work for the Work page's stories.

/** A change of two projects, one of them hidden by showing mode: one named, two in the count. */
export const syncChange: ChangeRow = {
  key: 'c1a2b3c4d5e6f708',
  title: 'Offline sync: queue and replay',
  project: 'lantern-notes',
  otherProjects: ['tidepool-api'],
  otherCount: 2,
  path: 'full',
  stage: 'implementation',
  lastActivity: '2026-11-11T17:40:00Z',
  runs: 2,
  sessions: 5,
  findings: 23,
  cost: 61.4,
};

/** A change in one project, its headline markup that must show as text. */
export const markupChange: ChangeRow = {
  key: 'c2b3c4d5e6f70819',
  title: HTML_TEXT,
  project: 'lantern-notes',
  otherProjects: [],
  otherCount: 0,
  path: 'small',
  stage: 'implementation',
  lastActivity: '2026-11-10T12:05:00Z',
  runs: 1,
  sessions: 1,
  findings: 2,
  cost: 3.1,
};

/** A change still in design, in no stored run's project: no run, no findings, no known cost. */
export const designChange: ChangeRow = {
  key: 'c3c4d5e6f708192a',
  title: 'Terms of use page',
  project: null,
  otherProjects: [],
  otherCount: 0,
  path: 'full',
  stage: 'design',
  lastActivity: null,
  runs: 0,
  sessions: 1,
  findings: null,
  cost: null,
};

const searchChange: ChangeRow = {
  key: 'c4d5e6f708192a3b',
  title: 'Cache the top queries',
  project: 'tidepool-api',
  otherProjects: [],
  otherCount: 0,
  path: 'full',
  stage: 'plan',
  lastActivity: '2026-11-11T11:30:00Z',
  runs: 0,
  sessions: 2,
  findings: null,
  cost: 11.6,
};

const looseChange: ChangeRow = {
  key: 'c5e6f708192a3b4c',
  title: 'fix/retry',
  project: 'harbor',
  otherProjects: [],
  otherCount: 0,
  path: 'small',
  stage: 'implementation',
  lastActivity: '2026-11-07T15:45:00Z',
  runs: 1,
  sessions: 1,
  findings: 0,
  cost: 4.25,
};

/** A goal with a change active this week: open, with a long name that wraps in its column. */
export const syncGoal: GoalSection = {
  key: 'g1a2b3c4d5e6f708',
  name: 'Offline sync for every note, across devices and when the network drops',
  open: true,
  changes: 2,
  runs: 3,
  sessions: 6,
  cost: 64.5,
  lastActivity: '2026-11-11T17:40:00Z',
  rows: [syncChange, markupChange],
};

/** A goal with a change active this week: open, its totals' numbers wider than the first's. */
export const searchGoal: GoalSection = {
  key: 'g2b3c4d5e6f70819',
  name: 'Search speed',
  open: true,
  changes: 12,
  runs: 140,
  sessions: 1250,
  cost: 1234.5,
  lastActivity: '2026-11-11T11:30:00Z',
  rows: [searchChange, designChange],
};

/** "No goal": no key, no name, closed, its cost not known. */
export const noGoal: GoalSection = {
  key: null,
  name: null,
  open: false,
  changes: 1,
  runs: 1,
  sessions: 1,
  cost: null,
  lastActivity: '2026-11-07T15:45:00Z',
  rows: [looseChange],
};

const goalOptions = [
  { key: searchGoal.key!, name: searchGoal.name! },
  { key: syncGoal.key!, name: syncGoal.name! },
];

export const workFull: WorkResponse = { goals: [syncGoal, searchGoal, noGoal], looseSessions: 4, anyGoal: true, goalOptions, hidden: 0 };

/** Nothing imported or nothing in the period. */
export const workEmpty: WorkResponse = { goals: [], looseSessions: 0, anyGoal: false, goalOptions: [], hidden: 0 };

/** No stored unit has a goal yet: every change under "No goal", open since one was active this week. */
export const workNoGoals: WorkResponse = {
  goals: [{ ...noGoal, open: true }],
  looseSessions: 1,
  anyGoal: false,
  goalOptions: [],
  hidden: 0,
};

/** The filters match no change, though the data has goals. */
export const workFilteredEmpty: WorkResponse = { goals: [], looseSessions: 0, anyGoal: true, goalOptions, hidden: 0 };

/** Showing mode on: two changes in other projects left out. */
export const workHidden: WorkResponse = { goals: [searchGoal], looseSessions: 0, anyGoal: true, goalOptions, hidden: 2 };
