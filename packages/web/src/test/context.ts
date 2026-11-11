import type { ContextResponse, ContextUnit, ContextWeek } from '@cwd/shared';
import { fullRun, smallRun } from './runs.ts';

// Invented answers of GET /api/context for the Context page's stories, after the approved mockup: twelve weeks, oldest
// first as the API gives them (the rows below are written newest first, then reversed).

const WEEKS = [
  '2026-11-08',
  '2026-11-01',
  '2026-10-25',
  '2026-10-18',
  '2026-10-11',
  '2026-10-04',
  '2026-09-27',
  '2026-09-20',
  '2026-09-13',
  '2026-09-06',
  '2026-08-30',
  '2026-08-23',
];

const NO_TOOLS = { read: 0, bash_other: 0, run: 0, agent: 0, edit: 0, mcp: 0, other: 0 };

/** A week with no unit: nothing known but its zeros. */
function emptyWeek(week: string): ContextWeek {
  return {
    week,
    units: 0,
    calls: 0,
    tokens: 0,
    maxTokens: null,
    unitsOverCap: 0,
    toolResults: {},
    sweeps: { inline: 0, delegated: 0 },
    meanTokens: null,
    readShare: null,
  };
}

/** A week with units: its mean tokens per call made from its calls and tokens, its read share from its read class. */
function week(
  w: string,
  [units, calls, mean, maxTokens, unitsOverCap]: number[],
  toolResults: typeof NO_TOOLS,
  [inline, delegated]: number[],
): ContextWeek {
  const characters = Object.values(toolResults).reduce((sum, n) => sum + n, 0);
  return {
    week: w,
    units,
    calls,
    tokens: calls * mean,
    maxTokens,
    unitsOverCap,
    toolResults,
    sweeps: { inline, delegated },
    meanTokens: mean,
    readShare: (toolResults.read / characters) * 100,
  };
}

const tools = (read: number, bash: number, run: number, agent: number, edit: number, mcp: number, other: number) => ({
  read: read * 1000,
  bash_other: bash * 1000,
  run: run * 1000,
  agent: agent * 1000,
  edit: edit * 1000,
  mcp: mcp * 1000,
  other: other * 1000,
});

const ROWS: ContextWeek[] = [
  week(WEEKS[0], [19, 1580, 247_000, 744_000, 11], tools(706, 497, 221, 166, 88, 99, 33), [18, 9]),
  week(WEEKS[1], [34, 3110, 288_000, 902_000, 19], tools(1700, 828, 368, 276, 147, 166, 55), [31, 2]),
  week(WEEKS[2], [26, 2240, 262_000, 815_000, 13], tools(1400, 568, 252, 189, 101, 114, 38), [22, 0]),
  week(WEEKS[3], [21, 1650, 231_000, 688_000, 9], tools(921, 432, 192, 144, 77, 86, 29), [14, 1]),
  week(WEEKS[4], [17, 1370, 214_000, 702_000, 6], tools(719, 365, 162, 122, 65, 73, 24), [9, 1]),
  week(WEEKS[5], [14, 1105, 190_000, 610_000, 4], tools(557, 294, 131, 98, 52, 59, 20), [6, 0]),
  week(WEEKS[6], [11, 820, 175_000, 520_000, 2], tools(400, 230, 102, 76, 41, 46, 15), [3, 0]),
  week(WEEKS[7], [9, 690, 168_000, 455_000, 2], tools(312, 202, 90, 67, 36, 40, 13), [4, 0]),
  week(WEEKS[8], [6, 410, 142_000, 410_000, 1], tools(182, 134, 60, 45, 24, 27, 9), [2, 0]),
  emptyWeek(WEEKS[9]),
  emptyWeek(WEEKS[10]),
  emptyWeek(WEEKS[11]),
];

/** The session with the most calls past the cap, untitled sessions aside: no handoff. */
export const syncSession: ContextUnit = {
  kind: 'session',
  key: 'c3d4e5f607182930',
  run: null,
  session: { title: 'Refactor the sync queue', sessionId: 'a3c91f02-5b7d-4e8a-9c1f-2d3e4f5a6b7c', project: 'atlas' },
  at: '2026-11-02T10:14:00Z',
  calls: 412,
  medianTokens: 296_000,
  maxTokens: 902_000,
  callsOverCap: 187,
  overCap: true,
  handoff: null,
  handedOffTo: null,
  readShare: 61.2,
  sweeps: { inline: 9, delegated: 0 },
};

/** A run over the cap, with no handoff. */
export const searchRun: ContextUnit = {
  kind: 'run',
  key: fullRun.key,
  run: fullRun,
  session: null,
  at: '2026-11-04T16:20:00Z',
  calls: 268,
  medianTokens: 281_000,
  maxTokens: 744_000,
  callsOverCap: 96,
  overCap: true,
  handoff: null,
  handedOffTo: null,
  readShare: 52.4,
  sweeps: { inline: 4, delegated: 1 },
};

/** A session handed off to the next one. */
export const planSession: ContextUnit = {
  kind: 'session',
  key: 'd4e5f60718293a4b',
  run: null,
  session: { title: 'Plan the offline sync', sessionId: '7d1e4b90-2c3a-4f5e-8d9c-0b1a2c3d4e5f', project: 'atlas' },
  at: '2026-11-09T09:07:00Z',
  calls: 203,
  medianTokens: 274_000,
  maxTokens: 655_000,
  callsOverCap: 58,
  overCap: true,
  handoff: '2026-11-09T15:41:00Z',
  handedOffTo: { title: 'Plan the offline sync, part 2', sessionId: 'c4f8a215-6e7d-4a8b-9c0d-1e2f3a4b5c6d' },
  readShare: 44,
  sweeps: { inline: 2, delegated: 3 },
};

/** A run under the cap, listed only under "All". */
export const retryRun: ContextUnit = {
  kind: 'run',
  key: smallRun.key,
  run: smallRun,
  session: null,
  at: '2026-11-09T09:40:00Z',
  calls: 41,
  medianTokens: 88_000,
  maxTokens: 141_000,
  callsOverCap: 0,
  overCap: false,
  handoff: null,
  handedOffTo: null,
  readShare: null,
  sweeps: { inline: 0, delegated: 0 },
};

/** Full: units in nine weeks, the units over the cap listed, most calls past the cap first. */
export const contextFull: ContextResponse = {
  weeks: ROWS.toReversed(),
  cap: 300_000,
  uncounted: { runs: 3, sessions: 0 },
  units: [syncSession, searchRun, planSession],
  hidden: 0,
};

/** All: the units under the cap too. */
export const contextAll: ContextResponse = { ...contextFull, units: [...contextFull.units, retryRun] };

/** Empty: twelve weeks of nothing, a run with no context facts, and no units. */
export const contextEmpty: ContextResponse = {
  weeks: WEEKS.map(emptyWeek).toReversed(),
  cap: 300_000,
  uncounted: { runs: 1, sessions: 0 },
  units: [],
  hidden: 0,
};

/** Showing: no session ID, and two units of other projects only counted. */
export const contextHidden: ContextResponse = {
  ...contextFull,
  units: [
    { ...syncSession, session: { ...syncSession.session!, sessionId: null } },
    searchRun,
    {
      ...planSession,
      session: { ...planSession.session!, sessionId: null },
      handedOffTo: { ...planSession.handedOffTo!, sessionId: null },
    },
  ],
  hidden: 2,
};
