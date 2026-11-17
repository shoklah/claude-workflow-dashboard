import type { FindingsQuery } from './findings.ts';

/** How far a change got, or what a session held: a run (full or small), else a plan record, else neither. */
export type WorkStep = 'design' | 'plan' | 'implementation';

/** `GET /api/work`'s query: the period's, plus a goal's key. */
export type WorkQuery = FindingsQuery & { goal?: string };

/**
 * A change as the Changes view lists it: its key, title, home project's name (null for "other project", a root no
 * stored run has), its other projects (the shown, named ones by name, every one in the count), path, stage, last activity and whole totals, units outside the period included.
 */
export type ChangeRow = {
  key: string;
  title: string;
  project: string | null;
  otherProjects: string[];
  otherCount: number;
  path: 'full' | 'small';
  stage: WorkStep;
  lastActivity: string | null;
  runs: number;
  sessions: number;
  findings: number | null;
  cost: number | null;
};

/** A goal's section (key and name null for "No goal"): open when a change of it was active this week, its totals the
 * sums of its rows. */
export type GoalSection = {
  key: string | null;
  name: string | null;
  open: boolean;
  changes: number;
  runs: number;
  sessions: number;
  cost: number | null;
  lastActivity: string | null;
  rows: ChangeRow[];
};

/**
 * The Changes view: its goal sections, most recently active first and "No goal" last; the period's sessions in no
 * change; whether any stored unit has a goal; the goal filter's options; and the changes a scope left out.
 */
export type WorkResponse = {
  goals: GoalSection[];
  looseSessions: number;
  anyGoal: boolean;
  goalOptions: { key: string; name: string }[];
  hidden: number;
};
