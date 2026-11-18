import { parseTime, type WorkSessionRow } from '@cwd/shared';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Num, Text, Unknown } from '../components/Num.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { SessionLink } from '../components/SessionLink.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { STAGE_LABELS, formatDollars, formatLength, modelLabel, sessionName } from '../lib/format.ts';
import { CHANGE_FACTS } from '../runs/RunsTable.tsx';

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
    value: (s) => sessionName(s.title),
    cell: (s) => <SessionLink sessionKey={s.key} title={s.title} />,
  },
  { id: 'step', header: 'Step', value: (s) => STAGE_LABELS[s.step], cell: (s) => STAGE_LABELS[s.step] },
  {
    id: 'started',
    header: 'Started',
    fold: true,
    value: (s) => parseTime(s.start).getTime(),
    cell: (s) => <Time iso={s.start} />,
  },
  { id: 'length', header: 'Length', num: true, value: (s) => s.minutes, cell: (s) => <Num value={s.minutes} format={formatLength} /> },
  {
    id: 'cost',
    header: 'Est. cost ($)',
    num: true,
    fold: true,
    value: (s) => s.cost,
    cell: (s) => <Num value={s.cost} format={formatDollars} />,
  },
];

/** Its change, linking to the change's page, as the Runs and Sessions lists show it. */
const [CHANGE] = CHANGE_FACTS;

const FACTS: ListFact<WorkSessionRow>[] = [
  ['Started by', (s) => <StartedBy by={s.startedBy} />],
  [
    'Model',
    (s) =>
      s.models.length === 0
        ? null
        : s.models.map(({ model }) => (
            <span key={model} className="block">
              <Text value={modelLabel(model)} />
            </span>
          )),
  ],
  ['Run', (s) => (s.run ? <RunLink runKey={s.run.key} branch={s.run.branch} title={s.run.title} /> : null)],
];

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
      facts={change ? [CHANGE, ...FACTS] : FACTS}
      label="Sessions table"
      empty="No sessions here yet. A session shows here once its transcript is imported."
    />
  );
}
