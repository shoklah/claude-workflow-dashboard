import type { Relevance } from '../categories.ts';
import type { RunFacts } from '../facts.ts';
import type { Outcome, Path, StepKind } from '../report.ts';

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

export type TimelineStep = {
  step: StepKind;
  round: number | null;
  agent: string | null;
  counts: Record<string, number>;
  findings: FindingRow[];
};

/** A part of the untimed timeline: only `start` and `end` carry a time. A wave holds its tasks' steps and its wave
 * check's steps; a task in no wave is a `task` group holding that one task. */
export type TimelineGroup = {
  kind: 'start' | 'plan' | 'wave' | 'task' | 'simplify' | 'final' | 'end';
  label: string;
  at: string | null;
  tasks: { task: number; steps: TimelineStep[] }[];
  steps: TimelineStep[];
};

/** A reviewer's strength, with its step's kind, task and round. */
export type StrengthRow = {
  step: StepKind;
  task: number | null;
  round: number | null;
  category: string | null;
  summary: string | null;
};

/** `GET /api/runs/:key`: one run, its timeline, every finding, its review steps' strengths, and its skills, models,
 * advisor notes and warnings; `categoryLabels` names each category id of the active list for display, empty with none. */
export type RunResponse = {
  facts: RunFacts;
  timeline: TimelineGroup[];
  findings: FindingRow[];
  strengths: StrengthRow[];
  skills: { name: string; outcome: string }[];
  models: { model: string; cost: number | null }[];
  advisor: { calls: number; notes: number } | null;
  warnings: { text: string; sessionId: string | null }[];
  categoryLabels: Record<string, string>;
};
