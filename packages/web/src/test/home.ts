import type { DiagramStep, HomeResponse, StepKind, Usage, UsageRow, WeekNumbers } from '@cwd/shared';

// Invented home screens for the home stories: a full one, as in the approved mockup, and an empty one.

const WEEKS = [
  '2026-08-23',
  '2026-08-30',
  '2026-09-06',
  '2026-09-13',
  '2026-09-20',
  '2026-09-27',
  '2026-10-04',
  '2026-10-11',
  '2026-10-18',
  '2026-10-25',
  '2026-11-01',
  '2026-11-08',
];

const zeros = () => WEEKS.map(() => 0);
const step = (kind: StepKind, ran: number, findings: number, actedOn: number, warnings = 0): DiagramStep => ({
  step: kind,
  ran,
  findings,
  actedOn,
  warnings,
});

export const emptyWeek: WeekNumbers = {
  runs: { small: 0, full: 0, plan: 0 },
  findings: { total: 0, actedOn: 0, notActedOn: 0, open: 0 },
  cost: null,
  costPerRun: null,
  warnings: 0,
  newWarnings: 0,
};

const skill = (name: string, sessions: number, runs: number, typed: number, typedNeverLoaded: number): UsageRow => ({
  name,
  kind: 'skill',
  sessions,
  runs,
  typed,
  typedNeverLoaded,
});
const command = (name: string, sessions: number, typed: number): UsageRow => ({
  name,
  kind: 'command',
  sessions,
  runs: null,
  typed,
  typedNeverLoaded: null,
});

/** No sessions or runs in the period. */
export const emptyUsage: Usage = { sessions: 0, runs: 0, rows: [] };

/** Skills and commands as in the approved 2c mockup, this week and over the last four weeks. */
export const fullUsage: HomeResponse['usage'] = {
  thisWeek: {
    sessions: 23,
    runs: 6,
    rows: [
      skill('brainstorming', 8, 2, 1, 0),
      command('model', 7, 9),
      skill('systematic-debugging', 6, 0, 0, 0),
      command('compact', 4, 5),
      skill('simplify', 3, 5, 4, 0),
      skill('grill-me', 1, 0, 3, 2),
    ],
  },
  lastFourWeeks: {
    sessions: 81,
    runs: 22,
    rows: [
      command('model', 30, 41),
      skill('brainstorming', 27, 7, 4, 0),
      skill('systematic-debugging', 19, 1, 2, 1),
      command('compact', 15, 18),
      skill('simplify', 9, 19, 12, 0),
      skill('grill-me', 4, 2, 9, 5),
      command('superpowers:write-plan', 2, 2),
    ],
  },
};

export const fullHome: HomeResponse = {
  thisWeek: {
    runs: { small: 3, full: 2, plan: 1 },
    findings: { total: 19, actedOn: 13, notActedOn: 5, open: 1 },
    cost: 21,
    costPerRun: 3.5,
    warnings: 12,
    newWarnings: 3,
  },
  lastWeek: {
    runs: { small: 4, full: 3, plan: 1 },
    findings: { total: 15, actedOn: 12, notActedOn: 3, open: 0 },
    cost: 27.25,
    costPerRun: 3.41,
    warnings: 9,
    newWarnings: 0,
  },
  diagram: {
    full: [
      step('plan_simplify', 2, 5, 4),
      step('plan_review', 2, 3, 2),
      step('task_review', 11, 9, 8),
      step('simplify', 2, 6, 6),
      step('final_review', 2, 5, 4),
    ],
    small: [step('task_review', 3, 2, 2), step('simplify', 3, 4, 3), step('final_review', 3, 1, 1)],
    fixChecks: { full: { ran: 7, open: 1, roundThree: 1 }, small: { ran: 2, open: 0, roundThree: 0 } },
    beforeSteps: 2,
  },
  charts: {
    weeks: WEEKS,
    findingsByStep: {
      plan_simplify: [0, 0, 0, 0, 0, 0, 2, 3, 1, 4, 3, 5],
      plan_review: [0, 0, 0, 0, 0, 0, 1, 2, 2, 1, 2, 3],
      task_review: [0, 0, 0, 0, 0, 0, 6, 8, 5, 9, 4, 9],
      fix_check: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
      simplify: [0, 0, 0, 0, 0, 0, 3, 4, 2, 5, 3, 6],
      final_review: [0, 0, 0, 0, 0, 0, 2, 3, 1, 4, 2, 5],
      final_fix_check: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    },
    cost: [null, null, null, null, null, null, 18.4, 24.1, 15.9, 31.2, 27.25, 21],
    warnings: [0, 0, 0, 0, 0, 0, 7, 11, 6, 8, 9, 12],
  },
  feed: [
    {
      at: '2026-11-12T10:40:00.000Z',
      type: 'run',
      runKey: 'a1b2c3d4e5f60718',
      project: 'atlas',
      branch: 'feat/search',
      path: 'full',
      text: null,
      sessionId: null,
      findings: { total: 6, actedOn: 5, notActedOn: 1, open: 0 },
      minutes: 130,
      cost: 7.1,
    },
    {
      at: '2026-11-12T10:10:00.000Z',
      type: 'warning',
      runKey: null,
      project: null,
      branch: null,
      path: null,
      text: 'session {session}: typed "grill me" but grill-me never loaded',
      sessionId: '3f9a0c1e-5b7d-4e2f-8a6c-9d0b1e2f3a4b',
      findings: null,
      minutes: null,
      cost: null,
    },
    {
      at: '2026-11-12T09:55:00.000Z',
      type: 'warning',
      runKey: 'a1b2c3d4e5f60718',
      project: 'atlas',
      branch: 'feat/search',
      path: null,
      text: 'feat/search (2026-11-12): final-reviewer ran on another model than its pin',
      sessionId: null,
      findings: null,
      minutes: null,
      cost: null,
    },
    {
      at: '2026-11-12T08:30:00.000Z',
      type: 'run',
      runKey: '0f1e2d3c4b5a6978',
      project: 'harbor',
      branch: '<img src=x onerror=alert(1)>',
      path: 'small',
      text: null,
      sessionId: null,
      findings: { total: 1, actedOn: 1, notActedOn: 0, open: 0 },
      minutes: 25,
      cost: 1.2,
    },
  ],
  coverageFrom: '2026-10-05T09:30:00Z',
  usage: fullUsage,
};

export const emptyHome: HomeResponse = {
  thisWeek: emptyWeek,
  lastWeek: emptyWeek,
  diagram: {
    full: fullHome.diagram.full.map((s) => step(s.step, 0, 0, 0)),
    small: fullHome.diagram.small.map((s) => step(s.step, 0, 0, 0)),
    fixChecks: { full: { ran: 0, open: 0, roundThree: 0 }, small: { ran: 0, open: 0, roundThree: 0 } },
    beforeSteps: 0,
  },
  charts: {
    weeks: WEEKS,
    findingsByStep: Object.fromEntries(
      Object.keys(fullHome.charts.findingsByStep).map((kind) => [kind, zeros()]),
    ) as Record<StepKind, number[]>,
    cost: WEEKS.map(() => null),
    warnings: zeros(),
  },
  feed: [],
  coverageFrom: null,
  usage: { thisWeek: emptyUsage, lastFourWeeks: emptyUsage },
};

/** The Full path's diagram as in the approved Compliance mockup: current warnings name the task and final reviews. */
export const warnedDiagram: HomeResponse['diagram'] = {
  ...fullHome.diagram,
  full: [
    step('plan_simplify', 2, 5, 4),
    step('plan_review', 2, 3, 2),
    step('task_review', 11, 9, 8, 2),
    step('simplify', 2, 6, 6),
    step('final_review', 2, 5, 4, 1),
  ],
};
