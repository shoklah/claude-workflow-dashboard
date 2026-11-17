import type { Relevance } from '../categories.ts';
import type { ContextFacts, RunFacts } from '../facts.ts';
import type { Outcome, Path, StepKind } from '../report.ts';
import type { AgentModels } from './models.ts';
import type { SessionRow } from './sessions.ts';

/** `GET /api/runs`'s query: `path`, `project` (a project's key), `weeks` (default 4) and `warnings=1`. */
export type RunsQuery = { path?: Path; project?: string; weeks: number; warnings: boolean };

export type RunRow = RunFacts;

/** `GET /api/runs`: the runs finished in the last `weeks` weeks that match the filters, newest first, the key and
 * name of every stored run's project, by name, and how many matching runs showing mode left out. */
export type RunsResponse = { runs: RunRow[]; projects: { key: string; name: string }[]; hidden: number };

/**
 * A finding of a step, with that step's kind, task, wave and round, and its labels. `category` is the workflow's when
 * the finding carries one, else the app's, and `judge` says whose it is (null while it has neither); `validity` is the
 * workflow's call. `relevance` and `labelReason` are the app's call and reason (`reason` stays the session's), and
 * `appCategory` and `appRelevance` the app's label only where it differs from the workflow's category or validity.
 */
export type FindingRow = {
  id: string | null;
  step: StepKind;
  task: number | null;
  wave: string | null;
  round: number | null;
  closedRound: number | null;
  severity: string | null;
  kind: string | null;
  summary: string | null;
  outcome: Outcome | null;
  reason: string | null;
  verdicts: string[];
  category: string | null;
  validity: Relevance | null;
  judge: 'workflow' | 'app' | null;
  relevance: Relevance | null;
  labelReason: string | null;
  appCategory: string | null;
  appRelevance: Relevance | null;
};

/** A step of the timeline: its model and effort its tied dispatch's, else its own (the alias it was asked for), field by
 * field, and its kit's name on a kit's own review and fix-checks. */
export type TimelineStep = {
  step: StepKind;
  round: number | null;
  agent: string | null;
  model: string | null;
  effort: string | null;
  kit: string | null;
  counts: Record<string, number>;
  findings: FindingRow[];
};

/** A part of the untimed timeline: only `start` and `end` carry a time. A wave holds its tasks' steps and its wave
 * check's steps; a task in no wave is a `task` group holding that one task. `conflicts` is a wave's merge conflicts,
 * null on every other group. */
export type TimelineGroup = {
  kind: 'start' | 'plan' | 'wave' | 'task' | 'simplify' | 'final' | 'end';
  label: string;
  at: string | null;
  conflicts: number | null;
  tasks: { task: number; steps: TimelineStep[] }[];
  steps: TimelineStep[];
};

/** A reviewer's strength, with its step's kind, task, wave and round. */
export type StrengthRow = {
  step: StepKind;
  task: number | null;
  wave: string | null;
  round: number | null;
  category: string | null;
  summary: string | null;
};

/** A run's main calls' context, as the reporter reads it: its calls, their median and largest context in tokens, the
 * calls past the cap and the handoff's time, its tool results' characters (every class) and the read class's share in
 * percent, and its sweeps. */
export type RunContext = ContextFacts & { toolCharacters: number };

/** `GET /api/runs/:key`: one run, its timeline, every finding, its review steps' strengths, and its skills, models,
 * advisor notes, context (null when the reporter read none) and warnings; `categoryLabels` names each category id of
 * the active list for display, empty with none. */
export type RunResponse = {
  facts: RunFacts;
  timeline: TimelineGroup[];
  findings: FindingRow[];
  strengths: StrengthRow[];
  skills: { name: string; outcome: string }[];
  models: { model: string; cost: number | null }[];
  advisor: { calls: number; notes: number } | null;
  context: RunContext | null;
  warnings: { text: string; sessionId: string | null }[];
  categoryLabels: Record<string, string>;
};

/** `GET /api/runs/:key`: the run as `runView` builds it, with what surrounds it: the session whose file is its
 * transcript and the one it handed off to (null when not stored or not shown), the other runs of its project and branch,
 * its offers, its later fixes (no sha), its agents as modelSums names them, its main session's model and effort, and
 * its phases' costs. */
export type RunPageResponse = RunResponse & {
  session: Pick<SessionRow, 'title' | 'sessionId'> | null;
  handoffTo: Pick<SessionRow, 'title' | 'sessionId'> | null;
  related: { key: string; path: Path | null; finishedAt: string | null }[];
  offers: { skill: string; outcome: string }[];
  laterFixes: { date: string | null; subject: string }[];
  agents: Pick<AgentModels, 'name' | 'actual'>[];
  main: { model: string | null; effort: string | null } | null;
  phases: { name: string; cost: number | null }[];
};
