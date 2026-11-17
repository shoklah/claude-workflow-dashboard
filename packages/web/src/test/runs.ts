import type { FindingRow, RunFacts, RunPageResponse, RunRow, RunsResponse, TimelineGroup, TimelineStep } from '@cwd/shared';

// Invented runs for the Runs list's and the run page's stories.

/** Free text with HTML in it: it must show as text, never as markup. */
export const HTML_TEXT = '<img src=x onerror=alert(1)>';

const NO_FINDINGS = { total: 0, actedOn: 0, notActedOn: 0, open: 0 };

export const fullRun: RunRow = {
  key: 'a1b2c3d4e5f60718',
  projectKey: '1a2b3c4d5e6f7081',
  project: 'atlas',
  branch: 'feat/search',
  headline: 'Search every note by title and body',
  change: { key: 'e1f2a3b4c5d60718', title: 'Plan full-text search' },
  goal: { key: 'f1e2d3c4b5a60718', name: 'Findability' },
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

export const smallRun: RunRow = {
  key: 'b2c3d4e5f6071829',
  projectKey: '2b3c4d5e6f708192',
  project: 'harbor',
  branch: HTML_TEXT,
  headline: null,
  change: null,
  goal: null,
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
export const oldRun: RunRow = {
  key: 'c3d4e5f607182930',
  projectKey: '3c4d5e6f70819203',
  project: 'quarry',
  branch: 'feat/import',
  headline: null,
  change: null,
  goal: null,
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
  goalOptions: [fullRun.goal!],
};
export const runsWarned: RunsResponse = { runs: [fullRun], projects: runsFull.projects, hidden: 0, goalOptions: [fullRun.goal!] };
export const runsEmpty: RunsResponse = { runs: [], projects: [], hidden: 0, goalOptions: [] };
/** Showing mode on: one shown run, two runs of other projects counted only. */
export const runsHidden: RunsResponse = { runs: [fullRun], projects: [runsFull.projects[0]], hidden: 2, goalOptions: [] };

/** The active list's display labels, by category id, as an invented API response carries them. */
export const categoryLabels: Record<string, string> = {
  scope: 'Scope',
  task_split: 'Task split and order',
  spec_gap: 'Spec gap',
  risk_missed: 'Risk missed',
  test_plan: 'Test plan',
  code_facts: 'Code facts',
  correctness: 'Correctness',
  error_handling: 'Error handling',
  data_safety: 'Data safety',
  security_privacy: 'Security and privacy',
  reuse: 'Reuse and duplication',
  conventions: 'Conventions',
  simplicity: 'Simplicity',
  tests: 'Tests',
  naming: 'Naming and clarity',
  performance: 'Performance',
  docs: 'Docs',
};

/** A finding; a category given with no judge is the app's label. */
export function finding(f: Partial<FindingRow> & Pick<FindingRow, 'id' | 'step' | 'summary'>): FindingRow {
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
    category: null,
    validity: null,
    judge: f.category ? 'app' : null,
    relevance: null,
    labelReason: null,
    appCategory: null,
    appRelevance: null,
    ...f,
  };
}

/** Findings of a run after CR10: the workflow's label the app agrees with, one it labels differently, the app's own
 * label of a finding the workflow left unlabelled, the workflow's with no app label, and two the workflow categorised
 * without a validity call, one the app puts in another category. */
export const workflowFindings: FindingRow[] = [
  finding({ id: 'F1', step: 'task_review', task: 2, severity: 'important', summary: 'Week arithmetic restated instead of using the shared helper', outcome: 'fixed', category: 'reuse', validity: 'valid', judge: 'workflow', relevance: 'valid', labelReason: 'The helper already does this' }),
  finding({ id: 'F2', step: 'task_review', task: 4, severity: 'minor', summary: 'No test covers the empty export case', outcome: 'declined', reason: 'Out of scope for this task', category: 'tests', validity: 'invalid', judge: 'workflow', relevance: 'valid', labelReason: 'An empty export is a real case', appCategory: 'correctness', appRelevance: 'valid' }),
  finding({ id: 'F3', step: 'task_review', wave: 'A', severity: 'important', summary: 'Two tasks wrote contradicting convention lines', outcome: 'fixed', category: 'conventions', relevance: 'valid', labelReason: 'The two lines disagree' }),
  finding({ id: 'F4', step: 'final_review', severity: 'minor', summary: 'Config option nothing reads', outcome: 'deferred', category: 'simplicity', validity: 'unclear', judge: 'workflow' }),
  finding({ id: 'F5', step: 'final_review', severity: 'minor', summary: 'Retry count read twice', outcome: 'declined', category: 'correctness', judge: 'workflow', relevance: 'invalid', labelReason: 'Both reads give the same value' }),
  finding({ id: 'F6', step: 'final_review', severity: 'minor', summary: 'Timeout logged at debug level', outcome: 'deferred', category: 'correctness', judge: 'workflow', relevance: 'valid', labelReason: 'Operators need to see timeouts', appCategory: 'error_handling' }),
];

const F1 = finding({ id: 'F1', step: 'task_review', task: 1, severity: 'important', summary: 'Search drops the last page on exact multiples', outcome: 'fixed', closedRound: 1, verdicts: ['fixed'], category: 'correctness', relevance: 'valid', labelReason: 'Results on the last page are lost' });
const F2 = finding({ id: 'F2', step: 'task_review', task: 1, severity: 'minor', summary: "Test name doesn't say what it checks", outcome: 'deferred', category: 'naming', relevance: 'unclear', labelReason: 'The name is short but not wrong' });
const F3 = finding({ id: 'F3', step: 'task_review', task: 2, severity: 'critical', summary: HTML_TEXT, outcome: 'fixed', closedRound: 1, verdicts: ['fixed'], category: 'security_privacy', relevance: 'valid', labelReason: HTML_TEXT });
const F4 = finding({ id: 'F4', step: 'task_review', wave: 'A', severity: 'important', summary: 'Both tasks write the same index file', outcome: 'ruled', reason: 'One index per run is intended', closedRound: 3, verdicts: ['open', 'open', 'open'], category: 'data_safety', relevance: 'invalid', labelReason: 'The run means both tasks to share the index' });
const F5 = finding({ id: 'F5', step: 'simplify', summary: 'Merge the two query builders', outcome: 'applied', category: 'simplicity', relevance: 'valid', labelReason: 'Two builders do the same work' });
const F6 = finding({ id: 'F6', step: 'final_review', severity: 'minor', summary: 'Error text not localized', outcome: 'open' });

function step(s: Partial<TimelineStep> & Pick<TimelineStep, 'step'>): TimelineStep {
  return { round: 0, agent: null, model: null, effort: null, kit: null, counts: {}, findings: [], ...s };
}

/** A review step, by `task-reviewer` on Opus 5.5 at high effort unless it says otherwise. */
function review(s: Partial<TimelineStep>): TimelineStep {
  return step({ step: 'task_review', agent: 'task-reviewer', model: 'claude-opus-5-5', effort: 'high', ...s });
}

export const runFull: RunPageResponse = {
  facts: fullRun,
  timeline: [
    { kind: 'start', label: 'Start', at: fullRun.startedAt, conflicts: null, tasks: [], steps: [] },
    {
      kind: 'wave',
      label: 'Wave A',
      at: null,
      conflicts: null,
      tasks: [
        { task: 1, steps: [review({ counts: { important: 1, minor: 1 }, findings: [F1, F2] }), step({ step: 'fix_check', round: 1, agent: 'fix-checker', model: 'opus', counts: { fixed: 1 } })] },
        { task: 2, steps: [review({ counts: { critical: 1 }, findings: [F3] })] },
      ],
      steps: [
        review({ counts: { important: 1 }, findings: [F4] }),
        ...[1, 2, 3].map((round) => step({ step: 'fix_check', round, agent: 'fix-checker', counts: { open: 1 } })),
      ],
    },
    {
      kind: 'wave',
      label: 'Wave B',
      at: null,
      conflicts: 1,
      tasks: [
        { task: 3, steps: [review({})] },
        { task: 4, steps: [review({})] },
      ],
      steps: [],
    },
    { kind: 'simplify', label: 'Simplify', at: null, conflicts: null, tasks: [], steps: [step({ step: 'simplify', counts: { applied: 1 }, findings: [F5] })] },
    { kind: 'final', label: 'Final review', at: null, conflicts: null, tasks: [], steps: [review({ step: 'final_review', agent: 'final-reviewer', counts: { minor: 1 }, findings: [F6] })] },
    { kind: 'end', label: 'End', at: fullRun.finishedAt, conflicts: null, tasks: [], steps: [] },
  ],
  findings: [F1, F2, F3, F4, F5, F6],
  strengths: [
    { step: 'task_review', task: 3, wave: null, round: 0, category: 'reuse', summary: 'New page reuses the shared table and format helpers' },
    { step: 'final_review', task: null, wave: null, round: 0, category: 'tests', summary: 'Each view tested on both fixtures, null facts included' },
  ],
  skills: [
    { name: 'subagent-driven-development', outcome: 'ran' },
    { name: 'simplify', outcome: 'found something' },
  ],
  models: [
    { model: 'claude-opus-5-5', cost: 5.2 },
    { model: 'claude-fable-5-1', cost: 1.9 },
  ],
  advisor: { calls: 3, notes: 3 },
  context: {
    calls: 214,
    medianTokens: 281_449,
    maxTokens: 1_300_000,
    callsOverCap: 62,
    handoff: '2026-11-10T16:40:00.000Z',
    toolCharacters: 912_300,
    readShare: 43.6,
    sweeps: { inline: 1, delegated: 4 },
  },
  categoryLabels,
  warnings: [
    { text: 'session {session}: final-reviewer ran on another model than its pin', sessionId: '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e' },
    { text: 'WARN: feat/search (2026-11-10): final review without simplify: final_review at step 4', sessionId: null },
  ],
  change: fullRun.change,
  goal: fullRun.goal,
  session: { key: '0a1b2c3d4e5f6071', title: 'Search page build', sessionId: '0f1e2d3c-4b5a-4968-8778-695a4b3c2d1e' },
  handoffTo: null,
  related: [{ key: 'd4e5f60718293a4b', path: 'plan', finishedAt: '2026-11-08T16:05:00Z' }],
  offers: [
    { skill: 'graphify', outcome: 'accepted' },
    { skill: 'session-summary', outcome: 'skipped' },
  ],
  laterFixes: [{ date: '2026-11-10T10:14:00Z', subject: 'fix: search keeps the last page on exact multiples' }],
  agents: [
    { name: 'final-reviewer', actual: { 'claude-opus-5-5/high': 1 } },
    { name: 'implementer', actual: { 'claude-opus-5-5/medium': 4 } },
    { name: 'task-reviewer', actual: { 'claude-opus-5-5/high': 5 } },
  ],
  main: { model: 'claude-opus-5-5', effort: 'medium' },
  phases: [
    { name: 'plan_writing', cost: 1.1 },
    { name: 'implement', cost: 3.4 },
    { name: 'task_review', cost: 1.6 },
    { name: 'final_review', cost: 1.0 },
  ],
};

/** Findings for Left for later: the full run's (one deferred, one ruled, one applied, one open, two fixed), with one
 * declined, one to the owner with its reason and one with no outcome. */
export const leftFindings: FindingRow[] = [
  ...runFull.findings,
  finding({ id: 'F7', step: 'final_review', severity: 'minor', summary: 'Search box has no placeholder', outcome: 'declined', reason: 'The label says it already' }),
  finding({ id: 'F8', step: 'final_review', severity: 'important', summary: 'Ranking weights are not in the spec', outcome: 'to_owner', reason: 'The owner sets the weights' }),
  finding({ id: 'F9', step: 'task_review', task: 2, severity: 'minor', summary: 'Index rebuild logs every file' }),
];

/** The before-steps run: its timeline is start, an empty final review, end, as the API gives it. */
export const runBeforeSteps: RunPageResponse = {
  facts: oldRun,
  timeline: [
    { kind: 'start', label: 'Start', at: null, conflicts: null, tasks: [], steps: [] },
    { kind: 'final', label: 'Final review', at: null, conflicts: null, tasks: [], steps: [] },
    { kind: 'end', label: 'End', at: oldRun.finishedAt, conflicts: null, tasks: [], steps: [] },
  ],
  findings: [],
  strengths: [],
  skills: [],
  models: [],
  advisor: null,
  context: null,
  categoryLabels,
  warnings: [],
  change: null,
  goal: null,
  session: null,
  handoffTo: null,
  related: [],
  offers: [],
  laterFixes: [],
  agents: [],
  main: null,
  phases: [],
};

/** The full run with a stop. */
export const runStopped: RunPageResponse = { ...runFull, facts: { ...fullRun, stops: 1 } };

/** The full run handed off to a stored session. */
export const runHandedOff: RunPageResponse = { ...runFull, handoffTo: { title: 'Search page polish', sessionId: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c2d' } };

/** The full run alone: no time, cost, session, context, related run or later fix. */
export const runAlone: RunPageResponse = {
  ...runFull,
  facts: { ...fullRun, startedAt: null, finishedAt: null, minutes: null, cost: null },
  timeline: runFull.timeline.map((g) => (g.kind === 'start' || g.kind === 'end' ? { ...g, at: null } : g)),
  session: null,
  context: null,
  related: [],
  laterFixes: [],
};

/** A Small run: Simplify and a final review that found nothing, and no warnings. */
export const runSmall: RunPageResponse = {
  ...runFull,
  facts: { ...smallRun, findings: NO_FINDINGS },
  timeline: [
    { kind: 'start', label: 'Start', at: smallRun.startedAt, conflicts: null, tasks: [], steps: [] },
    { kind: 'simplify', label: 'Simplify', at: null, conflicts: null, tasks: [], steps: [step({ step: 'simplify' })] },
    { kind: 'final', label: 'Final review', at: null, conflicts: null, tasks: [], steps: [review({ step: 'final_review', agent: 'final-reviewer' })] },
    { kind: 'end', label: 'End', at: smallRun.finishedAt, conflicts: null, tasks: [], steps: [] },
  ],
  findings: [],
  strengths: [],
  warnings: [],
};

export const planRun: RunFacts = {
  ...fullRun,
  key: 'd4e5f60718293a4b',
  path: 'plan',
  startedAt: '2026-11-08T15:20:00Z',
  finishedAt: '2026-11-08T16:05:00Z',
  minutes: 45,
  cost: 1.4,
  findings: NO_FINDINGS,
  warnings: 0,
  tasks: null,
  waves: 0,
};

/** A Plan run: its plan simplify and plan review. */
export const runPlan: RunPageResponse = {
  ...runFull,
  facts: planRun,
  timeline: [
    { kind: 'start', label: 'Start', at: planRun.startedAt, conflicts: null, tasks: [], steps: [] },
    {
      kind: 'plan',
      label: 'Plan',
      at: null,
      conflicts: null,
      tasks: [],
      steps: [step({ step: 'plan_simplify', agent: 'plan-simplifier' }), review({ step: 'plan_review', agent: 'plan-reviewer' })],
    },
    { kind: 'end', label: 'End', at: planRun.finishedAt, conflicts: null, tasks: [], steps: [] },
  ],
  findings: [],
  strengths: [],
};

/** A finding of the long run, closed in the round of its last verdict when that verdict is `fixed`. */
function long(f: Partial<FindingRow> & Pick<FindingRow, 'id' | 'summary'>): FindingRow {
  const verdicts = f.verdicts ?? [];
  return finding({
    step: 'task_review',
    severity: 'minor',
    closedRound: verdicts.at(-1) === 'fixed' ? verdicts.length : null,
    ...f,
  });
}

/** Fix rounds by `fix-checker`, each with its verdicts' counts. */
function rounds(...counts: Record<string, number>[]): TimelineStep[] {
  return counts.map((c, i) => step({ step: 'fix_check', round: i + 1, agent: 'fix-checker', model: 'claude-opus-5-5', effort: 'high', counts: c }));
}

const L1 = long({ id: 'L1', task: 1, severity: 'important', summary: 'Retry loop never gives up after the third failure', outcome: 'fixed', verdicts: ['fixed'] });
const L2 = long({ id: 'L2', task: 1, summary: 'Rename syncQueue to pendingWrites', outcome: 'deferred' });
const L3 = long({ id: 'L3', task: 2, severity: 'important', summary: 'Queue flushed before the lock is taken', outcome: 'fixed', verdicts: ['fixed'] });
const L4 = long({ id: 'L4', wave: 'A', severity: 'important', summary: 'Both tasks add the same migration', outcome: 'fixed', verdicts: ['open', 'fixed'] });
const L5 = long({ id: 'L5', task: 4, severity: 'important', summary: 'Conflict rule drops the newer edit', outcome: 'fixed', verdicts: ['open', 'fixed'] });
const L6 = long({ id: 'L6', task: 4, summary: 'Conflict test names the wrong case', outcome: 'fixed', verdicts: ['fixed'] });
const L7 = long({ id: 'L7', task: 4, summary: 'Conflict count could use the plural helper', outcome: 'declined', reason: 'The spec asks for it this way' });
const L8 = long({ id: 'L8', task: 6, summary: 'Device name read twice', outcome: 'fixed', verdicts: ['fixed'] });
const L9 = long({ id: 'L9', task: 6, summary: 'Log line repeats the device name', outcome: 'deferred' });
const L10 = long({ id: 'L10', task: 7, severity: 'important', summary: 'Offline badge has no text for screen readers', outcome: 'fixed', verdicts: ['fixed'] });
const L11 = long({ id: 'L11', step: 'kit_review', task: 7, summary: 'Badge sets its own radius', outcome: 'fixed', verdicts: ['fixed'] });
const L12 = long({ id: 'L12', step: 'kit_review', task: 7, summary: 'Badge colour taken outside the tokens', outcome: 'deferred' });
const L13 = long({ id: 'L13', task: 8, severity: 'important', summary: 'Both workers write the same cache key', outcome: 'ruled', reason: 'Intended: both tasks read the same snapshot', verdicts: ['open', 'open', 'open'] });
const L14 = long({ id: 'L14', task: 9, severity: 'important', summary: 'Sync retries hold the whole queue', outcome: 'to_owner', verdicts: ['open', 'not_proportionate'] });
const L15 = long({ id: 'L15', task: 10, summary: 'Progress text not announced', outcome: 'open' });
const L16 = long({ id: 'L16', task: 10, summary: 'Progress bar repeats the percent', outcome: 'deferred' });
const L17 = long({ id: 'L17', wave: 'C', severity: 'important', summary: 'Two tasks wrote contradicting convention lines', outcome: 'fixed', verdicts: ['fixed'] });
const L18 = long({ id: 'L18', step: 'simplify', severity: null, summary: 'Merge the two retry helpers', outcome: 'applied' });
const L19 = long({ id: 'L19', step: 'simplify', severity: null, summary: 'Split syncWorker into two files', outcome: 'declined', reason: 'One file per worker is the codebase pattern' });
const L20 = long({ id: 'L20', step: 'final_review', severity: 'important', summary: 'Conflict banner text is not announced to screen readers', outcome: 'fixed', verdicts: ['fixed'] });
const L21 = long({ id: 'L21', step: 'final_review', summary: 'Offline badge misses contrast in dark mode', outcome: 'to_owner' });

const longTask = (task: number, steps: TimelineStep[]) => ({ task, steps });
const longGroup = (g: Pick<TimelineGroup, 'kind' | 'label' | 'tasks' | 'steps'> & { conflicts?: number }): TimelineGroup => ({
  at: null,
  ...g,
  conflicts: g.conflicts ?? null,
});

export const longRun: RunFacts = {
  ...fullRun,
  key: 'e5f60718293a4b5c',
  branch: 'feat/offline-sync',
  startedAt: '2026-11-10T10:05:00Z',
  finishedAt: '2026-11-10T17:45:00Z',
  minutes: 460,
  cost: 13.79,
  findings: { total: 21, actedOn: 11, notActedOn: 9, open: 1 },
  tasks: 12,
  waves: 3,
};

/** The twelve-task run: three waves (Wave B with two merge conflicts), a task with a kit review and a kit fix-check,
 * a loop that ended open, and a "not proportionate" verdict. */
export const runLong: RunPageResponse = {
  ...runFull,
  facts: longRun,
  timeline: [
    { kind: 'start', label: 'Start', at: longRun.startedAt, conflicts: null, tasks: [], steps: [] },
    longGroup({
      kind: 'wave',
      label: 'Wave A',
      tasks: [
        longTask(1, [review({ counts: { important: 1, minor: 1 }, findings: [L1, L2] }), ...rounds({ fixed: 1 })]),
        longTask(2, [review({ counts: { important: 1 }, findings: [L3] }), ...rounds({ fixed: 1 })]),
        longTask(3, [review({})]),
      ],
      steps: [review({ counts: { important: 1 }, findings: [L4] }), ...rounds({ open: 1 }, { fixed: 1 })],
    }),
    longGroup({
      kind: 'task',
      label: 'Task 4',
      tasks: [longTask(4, [review({ counts: { important: 1, minor: 2 }, findings: [L5, L6, L7] }), ...rounds({ open: 1, fixed: 1 }, { fixed: 1 })])],
      steps: [],
    }),
    longGroup({
      kind: 'wave',
      label: 'Wave B',
      conflicts: 2,
      tasks: [longTask(5, [review({})]), longTask(6, [review({ counts: { minor: 2 }, findings: [L8, L9] }), ...rounds({ fixed: 1 })])],
      steps: [review({})],
    }),
    longGroup({
      kind: 'task',
      label: 'Task 7',
      tasks: [
        longTask(7, [
          review({ counts: { important: 1 }, findings: [L10] }),
          ...rounds({ fixed: 1 }),
          review({ step: 'kit_review', agent: 'kit-reviewer', kit: 'ui', counts: { minor: 2 }, findings: [L11, L12] }),
          step({ step: 'fix_check', round: 1, agent: 'kit-reviewer', model: 'claude-opus-5-5', effort: 'high', kit: 'ui', counts: { fixed: 1 } }),
        ]),
      ],
      steps: [],
    }),
    longGroup({
      kind: 'task',
      label: 'Task 8',
      tasks: [longTask(8, [review({ counts: { important: 1 }, findings: [L13] }), ...rounds({ open: 1 }, { open: 1 }, { open: 1 })])],
      steps: [],
    }),
    longGroup({
      kind: 'wave',
      label: 'Wave C',
      tasks: [
        longTask(9, [review({ counts: { important: 1 }, findings: [L14] }), ...rounds({ open: 1 }, { not_proportionate: 1 })]),
        longTask(10, [review({ counts: { minor: 2 }, findings: [L15, L16] })]),
        longTask(11, [review({})]),
      ],
      steps: [review({ counts: { important: 1 }, findings: [L17] }), ...rounds({ fixed: 1 })],
    }),
    longGroup({ kind: 'task', label: 'Task 12', tasks: [longTask(12, [review({})])], steps: [] }),
    { kind: 'simplify', label: 'Simplify', at: null, conflicts: null, tasks: [], steps: [step({ step: 'simplify', counts: { applied: 1, declined: 1 }, findings: [L18, L19] })] },
    {
      kind: 'final',
      label: 'Final review',
      at: null,
      conflicts: null,
      tasks: [],
      steps: [
        review({ step: 'final_review', agent: 'final-reviewer', counts: { important: 1, minor: 1 }, findings: [L20, L21] }),
        step({ step: 'final_fix_check', round: 1, agent: 'fix-checker', model: 'claude-opus-5-5', effort: 'high', counts: { fixed: 1 } }),
      ],
    },
    { kind: 'end', label: 'End', at: longRun.finishedAt, conflicts: null, tasks: [], steps: [] },
  ],
  findings: [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10, L11, L12, L13, L14, L15, L16, L17, L18, L19, L20, L21],
  strengths: [
    { step: 'task_review', task: 1, wave: null, round: 0, category: 'tests', summary: 'Each retry delay has its own test' },
    { step: 'task_review', task: 4, wave: null, round: 0, category: 'simplicity', summary: 'The conflict rule is one pure function' },
    { step: 'final_review', task: null, wave: null, round: 0, category: 'security_privacy', summary: 'No sync payload reaches a log' },
  ],
};
