import type { FindingSplit } from '../facts.ts';
import type { Path, StepKind } from '../report.ts';

/** One week's numbers on the home screen's tiles; each is a plain sum over the week's stored runs. */
export type WeekNumbers = {
  runs: Record<Path, number>;
  findings: FindingSplit;
  cost: number | null;
  costPerRun: number | null;
  warnings: number;
  newWarnings: number;
};

/** A step box on the workflow diagram; `warnings` counts the current warnings naming its step. */
export type DiagramStep = { step: StepKind; ran: number; findings: number; actedOn: number; warnings: number };

/** The fix-check line under a diagram tab. */
export type FixLine = { ran: number; open: number; roundThree: number };

/** An item of the "since you last looked" feed: a finished run or a first-seen warning. */
export type FeedItem = {
  at: string;
  type: 'run' | 'warning';
  runKey: string | null;
  project: string | null;
  branch: string | null;
  path: string | null;
  text: string | null;
  sessionId: string | null;
  findings: FindingSplit | null;
  minutes: number | null;
  cost: number | null;
};

/**
 * A skill or slash command on Home's skills and commands section, over a period's sessions and runs: `sessions`, the
 * sessions that loaded the skill, typed it (a typed trigger) or typed a command naming it; `runs`, the runs that loaded
 * it; `typed`, a skill's typed triggers or a command's commands; `typedNeverLoaded`, a skill's typed triggers never met.
 * A command no skill has has no `runs` and no `typedNeverLoaded`.
 */
export type UsageRow = {
  name: string;
  kind: 'skill' | 'command';
  sessions: number;
  runs: number | null;
  typed: number;
  typedNeverLoaded: number | null;
};

/** A period's skills and commands: its sessions, its runs and a row per skill or command, most sessions first. */
export type Usage = { sessions: number; runs: number; rows: UsageRow[] };

/** `GET /api/home`: the home screen. Weeks are their start dates (`YYYY-MM-DD`), times ISO. */
export type HomeResponse = {
  thisWeek: WeekNumbers;
  lastWeek: WeekNumbers;
  diagram: {
    full: DiagramStep[];
    small: DiagramStep[];
    fixChecks: { full: FixLine; small: FixLine };
    beforeSteps: number;
  };
  charts: {
    weeks: string[];
    findingsByStep: Record<StepKind, number[]>;
    cost: (number | null)[];
    warnings: number[];
  };
  feed: FeedItem[];
  coverageFrom: string | null;
  usage: { thisWeek: Usage; lastFourWeeks: Usage };
};
