import type { ChangeResponse, ChangeRow, GoalSection, RunFacts, SessionGraphData, WorkResponse, WorkSessionRow } from '@cwd/shared';
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

// Invented answers of GET /api/work/changes/:key for a change's page and its session graph.

const S = {
  design: 's1a2b3c4d5e6f701',
  handoff: 's1a2b3c4d5e6f702',
  plan: 's1a2b3c4d5e6f703',
  queue: 's1a2b3c4d5e6f704',
  replay: 's1a2b3c4d5e6f705',
  terms: 's1a2b3c4d5e6f706',
  banner: 's1a2b3c4d5e6f707',
};

const queueRun = { key: 'r1a2b3c4d5e6f701', title: 'Queue edits while offline', branch: 'claude/offline-sync-queue' };
const replayRun = { key: 'r1a2b3c4d5e6f702', title: 'Replay the queue on reconnect', branch: 'claude/offline-sync-replay' };

/** The offline sync change's graph: five sessions in its lane, joined by a handoff and started edges, and two sessions
 * of another goal and another change that its sessions started. */
export const syncGraph: SessionGraphData = {
  lanes: [
    { key: syncChange.key, title: syncChange.title, kind: 'change' },
    { key: null, title: 'Other changes', kind: 'other' },
  ],
  nodes: [
    { key: S.design, title: 'Design offline sync', step: 'design', run: null, lane: 0, elsewhere: null },
    { key: S.handoff, title: 'Design offline sync, after handoff', step: 'design', run: null, lane: 0, elsewhere: null },
    { key: S.plan, title: 'Plan the offline queue', step: 'plan', run: null, lane: 0, elsewhere: null },
    { key: S.queue, title: 'Implement the queue', step: 'implementation', run: queueRun, lane: 0, elsewhere: null },
    { key: S.replay, title: 'Implement replay', step: 'implementation', run: replayRun, lane: 0, elsewhere: null },
    {
      key: S.terms,
      title: 'Start on the terms of use page',
      step: 'design',
      run: null,
      lane: 1,
      elsewhere: { kind: 'goal', name: 'Legal pages' },
    },
    {
      key: S.banner,
      title: 'Design the conflict banner',
      step: 'design',
      run: null,
      lane: 1,
      elsewhere: { kind: 'change', title: 'Conflict banner' },
    },
  ],
  edges: [
    { from: S.design, to: S.handoff, how: 'handoff' },
    { from: S.handoff, to: S.plan, how: 'started' },
    { from: S.plan, to: S.queue, how: 'started' },
    { from: S.queue, to: S.replay, how: 'started' },
    { from: S.handoff, to: S.terms, how: 'started' },
    { from: S.queue, to: S.banner, how: 'started' },
  ],
  hidden: 0,
};

/** A graph of one session: its box, no edge. */
export const oneGraph: SessionGraphData = {
  lanes: [syncGraph.lanes[0]],
  nodes: [syncGraph.nodes[0]],
  edges: [],
  hidden: 0,
};

/** A graph of no session. */
export const emptyGraph: SessionGraphData = { lanes: [], nodes: [], edges: [], hidden: 0 };

/** Showing mode on: a box titled with markup holding a run with no title, the other lane's sessions in no change and in a change Work doesn't
 * list, and two sessions left out. */
export const hiddenGraph: SessionGraphData = {
  lanes: syncGraph.lanes,
  nodes: [
    { ...syncGraph.nodes[0], title: HTML_TEXT, run: { ...queueRun, title: null } },
    { ...syncGraph.nodes[5], elsewhere: { kind: 'none' } },
    { ...syncGraph.nodes[6], elsewhere: { kind: 'unlisted' } },
  ],
  edges: [
    { from: S.design, to: S.terms, how: 'started' },
    { from: S.design, to: S.banner, how: 'handoff' },
  ],
  hidden: 2,
};

const plannedRun = {
  key: 'r1a2b3c4d5e6f703',
  projectKey: '1a2b3c4d5e6f7082',
  project: 'tidepool-api',
  branch: 'claude/offline-sync-plan',
  headline: 'Plan the offline queue',
  path: 'plan',
  stage: null,
  startedAt: '2026-11-04T11:00:00Z',
  finishedAt: '2026-11-04T13:00:00Z',
  minutes: 120,
  cost: null,
  findings: { total: 0, actedOn: 0, notActedOn: 0, open: 0 },
  warnings: 0,
  stops: null,
  tasks: null,
  waves: 0,
  beforeSteps: false,
} satisfies RunFacts;

const syncRuns: RunFacts[] = [
  {
    ...plannedRun,
    key: replayRun.key,
    projectKey: '1a2b3c4d5e6f7081',
    project: 'lantern-notes',
    branch: replayRun.branch,
    headline: replayRun.title,
    path: 'full',
    stage: '6',
    startedAt: '2026-11-11T13:49:00Z',
    finishedAt: '2026-11-11T17:40:00Z',
    minutes: 231,
    cost: 26.9,
    findings: { total: 12, actedOn: 10, notActedOn: 1, open: 1 },
    tasks: 6,
    stops: 0,
  },
  {
    ...plannedRun,
    key: queueRun.key,
    projectKey: '1a2b3c4d5e6f7081',
    project: 'lantern-notes',
    branch: queueRun.branch,
    headline: queueRun.title,
    path: 'full',
    stage: '6',
    startedAt: '2026-11-08T15:03:00Z',
    finishedAt: '2026-11-08T18:10:00Z',
    minutes: 187,
    cost: 22.15,
    findings: { total: 11, actedOn: 11, notActedOn: 0, open: 0 },
    tasks: 5,
    stops: 0,
  },
];

const OPUS = [{ model: 'claude-opus-5-5', effort: 'medium' }];
const FABLE = [{ model: 'claude-fable-5-2', effort: 'high' }];

const syncSessions: WorkSessionRow[] = [
  {
    key: S.design,
    title: 'Design offline sync',
    start: '2026-11-03T10:10:00Z',
    end: '2026-11-03T12:54:00Z',
    minutes: 164,
    models: FABLE,
    cost: 5.9,
    step: 'design',
    startedBy: null,
    run: null,
    change: { key: syncChange.key, title: syncChange.title },
  },
  {
    key: S.handoff,
    title: 'Design offline sync, after handoff',
    start: '2026-11-03T14:20:00Z',
    end: '2026-11-03T15:55:00Z',
    minutes: 95,
    models: FABLE,
    cost: 3.25,
    step: 'design',
    startedBy: { key: S.design, title: 'Design offline sync' },
    run: null,
    change: { key: syncChange.key, title: syncChange.title },
  },
  {
    key: S.plan,
    title: 'Plan the offline queue',
    start: '2026-11-04T11:00:00Z',
    end: '2026-11-04T13:00:00Z',
    minutes: 120,
    models: FABLE,
    cost: 3.2,
    step: 'plan',
    startedBy: { key: null, title: null },
    run: null,
    change: { key: syncChange.key, title: syncChange.title },
  },
  {
    key: S.queue,
    title: 'Implement the queue',
    start: '2026-11-08T14:50:00Z',
    end: '2026-11-08T18:22:00Z',
    minutes: 212,
    models: OPUS,
    cost: 22.15,
    step: 'implementation',
    startedBy: { key: S.plan, title: 'Plan the offline queue' },
    run: queueRun,
    change: { key: syncChange.key, title: syncChange.title },
  },
  {
    key: S.replay,
    title: HTML_TEXT,
    start: '2026-11-11T13:40:00Z',
    end: '2026-11-11T17:48:00Z',
    minutes: 248,
    models: OPUS,
    cost: 26.9,
    step: 'implementation',
    startedBy: { key: S.queue, title: 'Implement the queue' },
    run: replayRun,
    change: { key: syncChange.key, title: syncChange.title },
  },
];

/** The offline sync change: in two projects, with a goal, a spec, a plan record among its runs and its graph. */
export const changeFull: ChangeResponse = {
  key: syncChange.key,
  title: syncChange.title,
  goal: { key: 'g1a2b3c4d5e6f708', name: 'Offline sync' },
  project: 'lantern-notes',
  otherProjects: ['tidepool-api'],
  otherCount: 1,
  path: 'full',
  stage: 'implementation',
  spec: '2026-11-05-offline-sync-design.md',
  startedAt: '2026-11-03T10:10:00Z',
  lastActivity: '2026-11-11T17:40:00Z',
  sessionCount: 5,
  runCount: 3,
  cost: 61.4,
  graph: syncGraph,
  runs: [...syncRuns, plannedRun],
  sessions: syncSessions,
};

/** A change of one project and one run with no spec, no goal and no known cost: no Project, Other projects, Path
 * or Spec. */
export const changeSmall: ChangeResponse = {
  ...changeFull,
  key: markupChange.key,
  title: 'fix/retry',
  goal: null,
  otherProjects: [],
  otherCount: 0,
  path: 'small',
  spec: null,
  startedAt: null,
  sessionCount: 1,
  runCount: 1,
  cost: null,
  graph: oneGraph,
  runs: [{ ...syncRuns[1], path: 'small' }],
  sessions: [syncSessions[0]],
};
