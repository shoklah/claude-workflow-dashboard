import type { RunFacts } from '../facts.ts';
import type { FindingsQuery } from './findings.ts';
import type { SessionRow } from './sessions.ts';

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

/** A run as a box or a session row names it: its key, title (headline) and branch. */
export type HeldRun = { key: string; title: string | null; branch: string | null };

/**
 * A session's box: its title, step, newest shown held run and lane (an index into the graph's lanes); `elsewhere`,
 * null in its own change's or the No change lane, says where a session of the other lane belongs: another change (by
 * title), another goal (by name), no change, or a change or goal Work doesn't list ("Another change" or "Another
 * goal", by the page).
 */
export type GraphNode = {
  key: string;
  title: string | null;
  step: WorkStep;
  run: HeldRun | null;
  lane: number;
  elsewhere:
    | { kind: 'change'; title: string }
    | { kind: 'goal'; name: string }
    | { kind: 'none' }
    | { kind: 'unlisted' }
    | null;
};

/** An edge from the starting session to the started one; any `how` but `'handoff'` reads as started. */
export type GraphEdge = { from: string; to: string; how: 'started' | 'handoff' };

/** The session graph's lanes (a change's, No change, the other changes' or goals'), boxes, edges, and the sessions
 * showing mode left out. */
export type SessionGraphData = {
  lanes: { key: string | null; title: string; kind: 'change' | 'none' | 'other' }[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  hidden: number;
};

/**
 * A session as a change's or goal's Sessions table lists it: the Sessions view's facts, its step, who started it
 * (null: started by you; key and title null for a session showing mode hides), its newest shown held run and its
 * change (null when it has none or Work doesn't list it).
 */
export type WorkSessionRow = Pick<SessionRow, 'key' | 'title' | 'start' | 'end' | 'minutes' | 'models' | 'cost'> & {
  step: WorkStep;
  startedBy: { key: string | null; title: string | null } | null;
  run: HeldRun | null;
  change: { key: string; title: string } | null;
};

/** `GET /api/work/changes/:key`: a change's facts and whole totals, its session graph, and its shown runs and
 * sessions. `project` is null for "other project"; `spec` is the spec's file name. */
export type ChangeResponse = {
  key: string;
  title: string;
  goal: { key: string; name: string } | null;
  project: string | null;
  otherProjects: string[];
  otherCount: number;
  path: 'full' | 'small';
  stage: WorkStep;
  spec: string | null;
  startedAt: string | null;
  lastActivity: string | null;
  sessionCount: number;
  runCount: number;
  cost: number | null;
  graph: SessionGraphData;
  runs: RunFacts[];
  sessions: WorkSessionRow[];
};

/** `GET /api/work/goals/:key`: a goal's facts and whole totals (its changes plus its sessions in no change), its
 * session graph, and its shown changes and sessions. */
export type GoalResponse = {
  key: string;
  name: string;
  projects: string[];
  startedAt: string | null;
  lastActivity: string | null;
  changeCount: number;
  runCount: number;
  sessionCount: number;
  findings: number | null;
  cost: number | null;
  graph: SessionGraphData;
  changes: ChangeRow[];
  sessions: WorkSessionRow[];
};
