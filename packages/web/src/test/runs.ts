import type { FindingRow, RunFacts, RunResponse, RunsResponse, TimelineStep } from '@cwd/shared';

// Invented runs for the Runs list's and the run page's stories.

/** Free text with HTML in it: it must show as text, never as markup. */
export const HTML_TEXT = '<img src=x onerror=alert(1)>';

const NO_FINDINGS = { total: 0, actedOn: 0, notActedOn: 0, open: 0 };

export const fullRun: RunFacts = {
  key: 'a1b2c3d4e5f60718',
  projectKey: '1a2b3c4d5e6f7081',
  project: 'atlas',
  branch: 'feat/search',
  path: 'full',
  stage: '1',
  startedAt: '2026-11-09T09:12:00Z',
  finishedAt: '2026-11-09T11:22:00Z',
  minutes: 130,
  cost: 7.1,
  findings: { total: 6, actedOn: 3, notActedOn: 2, open: 1 },
  warnings: 1,
  stops: 0,
  tasks: 4,
  waves: 2,
  beforeSteps: false,
};

export const smallRun: RunFacts = {
  key: 'b2c3d4e5f6071829',
  projectKey: '2b3c4d5e6f708192',
  project: 'harbor',
  branch: HTML_TEXT,
  path: 'small',
  stage: '2',
  startedAt: '2026-11-09T09:15:00Z',
  finishedAt: '2026-11-09T09:40:00Z',
  minutes: 25,
  cost: 1.2,
  findings: { total: 1, actedOn: 1, notActedOn: 0, open: 0 },
  warnings: 0,
  stops: 0,
  tasks: 1,
  waves: 0,
  beforeSteps: false,
};

/** A record from before steps were logged: what it can't give is null. */
export const oldRun: RunFacts = {
  key: 'c3d4e5f607182930',
  projectKey: '3c4d5e6f70819203',
  project: 'quarry',
  branch: 'feat/import',
  path: 'full',
  stage: null,
  startedAt: null,
  finishedAt: '2026-10-30T15:31:00Z',
  minutes: null,
  cost: null,
  findings: NO_FINDINGS,
  warnings: 0,
  stops: null,
  tasks: null,
  waves: 0,
  beforeSteps: true,
};

export const runsFull: RunsResponse = {
  runs: [smallRun, fullRun, oldRun],
  projects: [fullRun, smallRun, oldRun].map((run) => ({ key: run.projectKey, name: run.project })),
  hidden: 0,
};
export const runsWarned: RunsResponse = { runs: [fullRun], projects: runsFull.projects, hidden: 0 };
export const runsEmpty: RunsResponse = { runs: [], projects: [], hidden: 0 };

function finding(f: Partial<FindingRow> & Pick<FindingRow, 'id' | 'step' | 'summary'>): FindingRow {
  return {
    task: null,
    wave: null,
    round: 0,
    closedRound: null,
    severity: null,
    kind: null,
    outcome: null,
    reason: null,
    verdicts: [],
    ...f,
  };
}

const F1 = finding({ id: 'F1', step: 'task_review', task: 1, severity: 'important', summary: 'Search drops the last page on exact multiples', outcome: 'fixed', closedRound: 1, verdicts: ['fixed'] });
const F2 = finding({ id: 'F2', step: 'task_review', task: 1, severity: 'minor', summary: "Test name doesn't say what it checks", outcome: 'deferred' });
const F3 = finding({ id: 'F3', step: 'task_review', task: 2, severity: 'critical', summary: HTML_TEXT, outcome: 'fixed', closedRound: 1, verdicts: ['fixed'] });
const F4 = finding({ id: 'F4', step: 'task_review', wave: 'A', severity: 'important', summary: 'Both tasks write the same index file', outcome: 'ruled', reason: 'One index per run is intended', closedRound: 3, verdicts: ['open', 'open', 'open'] });
const F5 = finding({ id: 'F5', step: 'simplify', summary: 'Merge the two query builders', outcome: 'applied' });
const F6 = finding({ id: 'F6', step: 'final_review', severity: 'minor', summary: 'Error text not localized', outcome: 'open' });

function step(s: Partial<TimelineStep> & Pick<TimelineStep, 'step'>): TimelineStep {
  return { round: 0, agent: null, counts: {}, findings: [], ...s };
}

export const runFull: RunResponse = {
  facts: fullRun,
  timeline: [
    { kind: 'start', label: 'Start', at: fullRun.startedAt, tasks: [], steps: [] },
    {
      kind: 'wave',
      label: 'Wave A',
      at: null,
      tasks: [
        { task: 1, steps: [step({ step: 'task_review', counts: { important: 1, minor: 1 }, findings: [F1, F2] }), step({ step: 'fix_check', round: 1, counts: { fixed: 1 } })] },
        { task: 2, steps: [step({ step: 'task_review', counts: { critical: 1 }, findings: [F3] })] },
      ],
      steps: [step({ step: 'task_review', counts: { important: 1 }, findings: [F4] })],
    },
    {
      kind: 'wave',
      label: 'Wave B',
      at: null,
      tasks: [
        { task: 3, steps: [step({ step: 'task_review' })] },
        { task: 4, steps: [step({ step: 'task_review' })] },
      ],
      steps: [],
    },
    { kind: 'simplify', label: 'Simplify', at: null, tasks: [], steps: [step({ step: 'simplify', counts: { applied: 1 }, findings: [F5] })] },
    { kind: 'final', label: 'Final review', at: null, tasks: [], steps: [step({ step: 'final_review', counts: { minor: 1 }, findings: [F6] })] },
    { kind: 'end', label: 'End', at: fullRun.finishedAt, tasks: [], steps: [] },
  ],
  findings: [F1, F2, F3, F4, F5, F6],
  skills: [
    { name: 'subagent-driven-development', outcome: 'ran' },
    { name: 'simplify', outcome: 'applied 1, skipped 0' },
  ],
  models: [
    { model: 'claude-opus-5-5', cost: 5.2 },
    { model: 'claude-fable-5-1', cost: 1.9 },
  ],
  advisor: { calls: 3, notes: 3 },
  warnings: [
    { text: 'session {session}: final-reviewer ran on another model than its pin', sessionId: '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e' },
  ],
};

/** The before-steps run: its timeline is start, an empty final review, end, as the API gives it. */
export const runBeforeSteps: RunResponse = {
  facts: oldRun,
  timeline: [
    { kind: 'start', label: 'Start', at: null, tasks: [], steps: [] },
    { kind: 'final', label: 'Final review', at: null, tasks: [], steps: [] },
    { kind: 'end', label: 'End', at: oldRun.finishedAt, tasks: [], steps: [] },
  ],
  findings: [],
  skills: [],
  models: [],
  advisor: null,
  warnings: [],
};
