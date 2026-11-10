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
};
