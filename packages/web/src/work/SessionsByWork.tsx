import { parseTime, type WorkSessionRow } from '@cwd/shared';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Num, Unknown } from '../components/Num.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { SessionLink } from '../components/SessionLink.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { STAGE_LABELS, formatDollars, formatLength, sessionName } from '../lib/format.ts';
import { CHANGE_FACT } from '../runs/RunsTable.tsx';
import { ALIGNED } from './ChangesTable.tsx';
import { MODEL_FACT } from '../sessions/SessionsTable.tsx';

/** Who started a session: the starter's title, "Another session" when showing mode hides it or it isn't stored, else the dash read
 * "started by you". */
function StartedBy({ by }: { by: WorkSessionRow['startedBy'] }) {
  if (!by) return <Unknown label="started by you" />;
  return <>{by.key === null ? 'Another session' : sessionName(by.title)}</>;
}

const COLUMNS: ListColumn<WorkSessionRow>[] = [
  {
    id: 'session',
    header: 'Session',
    wide: true,
    names: true,
    value: (s) => s.title,
    cell: (s) => <SessionLink sessionKey={s.key} title={s.title} />,
  },
  { id: 'step', header: 'Step', width: ALIGNED.stage, value: (s) => STAGE_LABELS[s.step], cell: (s) => STAGE_LABELS[s.step] },
  {
    id: 'started',
    header: 'Started',
    fold: true,
    width: ALIGNED.time,
    value: (s) => parseTime(s.start).getTime(),
    cell: (s) => <Time iso={s.start} />,
  },
  { id: 'length', header: 'Length', num: true, width: ALIGNED.count, value: (s) => s.minutes, cell: (s) => <Num value={s.minutes} format={formatLength} /> },
  {
    id: 'cost',
    header: 'Est. cost ($)',
    num: true,
    fold: true,
    value: (s) => s.cost,
    cell: (s) => <Num value={s.cost} format={formatDollars} />,
  },
];

const FACTS: ListFact<WorkSessionRow>[] = [
  ['Started by', (s) => <StartedBy by={s.startedBy} />],
  MODEL_FACT,
  ['Run', (s) => (s.run ? <RunLink runKey={s.run.key} branch={s.run.branch} title={s.run.title} /> : null)],
];
/** On a goal's page, its change first, linking to the change's page, as the Runs and Sessions lists show it. */
const GOAL_FACTS: ListFact<WorkSessionRow>[] = [CHANGE_FACT, ...FACTS];

/** A change's or goal's Sessions list, as the API orders them: each title linking to the session in the Sessions
 * view, its step, start, length and cost, a row opening to (with `change`) its change, its starter, models and held
 * run. */
export function SessionsByWork({ sessions, change }: { sessions: WorkSessionRow[]; change: boolean }) {
  return (
    <DataList
      rows={sessions}
      rowKey={(s) => s.key}
      name={(s) => sessionName(s.title)}
      columns={COLUMNS}
      facts={change ? GOAL_FACTS : FACTS}
      label="Sessions table"
      empty="No sessions here yet. A session shows here once its transcript is imported."
    />
  );
}
