import { cn } from 'cn';
import { parseTime, type SessionRow } from '@cwd/shared';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Num, Text, Unknown } from '../components/Num.tsx';
import { ColumnHead, ScrollTable } from '../components/Panel.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { SessionChip } from '../components/SessionChip.tsx';
import { CHANGE_FACTS } from '../runs/RunsTable.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import {
  UNNAMED,
  WARNING_INK,
  formatDayTime,
  formatDollars,
  formatLength,
  modelLabel,
  pathLabel,
  projectLabel,
  sessionName,
  timelineTimes,
  usageName,
} from '../lib/format.ts';

const KINDS: Record<SessionRow['timeline'][number]['kind'], string> = {
  skill: 'Skill loaded',
  command: 'Command typed',
  run: 'Run started',
};

/** A session's skill loads, commands and held runs' window starts, in the API's time order: a small table, one value
 * per cell, named by its session's name and start, so two sessions of one name open with regions of their own. */
function Timeline({ session, name }: { session: SessionRow; name: string }) {
  if (session.timeline.length === 0) {
    return <p className="text-muted-foreground">No skill loads, commands or runs in this session.</p>;
  }
  const times = timelineTimes(session.timeline.map((item) => item.at));
  return (
    <ScrollTable label={`Timeline of ${name}, ${formatDayTime(parseTime(session.start))}`}>
      <thead>
        <tr>
          <ColumnHead>Time</ColumnHead>
          <ColumnHead>What</ColumnHead>
          <ColumnHead>Name</ColumnHead>
          <ColumnHead>Outcome</ColumnHead>
        </tr>
      </thead>
      <tbody>
        {session.timeline.map((item, i) => {
          const hold = session.holds.find((h) => h.runKey === item.runKey);
          return (
            <tr key={i}>
              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground tabular-nums">
                <time dateTime={item.at}>{times[i]}</time>
              </td>
              <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{KINDS[item.kind]}</td>
              <td className="px-2 py-1.5 font-medium">
                {item.kind === 'run' && hold ? (
                  <RunLink runKey={hold.runKey} branch={hold.branch} title={hold.headline} />
                ) : (
                  usageName({ name: item.name, kind: item.kind === 'command' ? 'command' : 'skill' })
                )}
              </td>
              <td className={cn('px-2 py-1.5', item.neverLoaded && WARNING_INK)}>
                {item.kind === 'skill' && <Text value={item.outcome} unknown="no outcome" />}
                {item.kind === 'command' && (item.neverLoaded ? 'Its skill never loaded' : <Unknown label="no outcome" />)}
                {item.kind === 'run' &&
                  (hold ? (
                    <span className="text-muted-foreground">
                      <span className="block">
                        <Text value={hold.project} />
                      </span>
                      <span className="block">
                        <Text value={hold.path && `${pathLabel(hold.path)} path`} />
                      </span>
                    </span>
                  ) : (
                    <Unknown />
                  ))}
              </td>
            </tr>
          );
        })}
      </tbody>
    </ScrollTable>
  );
}

const count = (s: SessionRow, kind: string) => new Set(s.timeline.filter((t) => t.kind === kind).map((t) => t.name)).size;
const neverLoaded = (s: SessionRow) => new Set(s.timeline.filter((t) => t.neverLoaded).map((t) => t.name)).size;

const COLUMNS: ListColumn<SessionRow>[] = [
  {
    id: 'session',
    header: 'Session',
    wide: true,
    names: true,
    value: (s) => s.title,
    cell: (s) => sessionName(s.title),
    text: (s) => sessionName(s.title),
    textClass: (s) => !s.title && UNNAMED,
  },
  { id: 'project', header: 'Project', fold: true, value: (s) => projectLabel(s.project), cell: (s) => projectLabel(s.project) },
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
  {
    id: 'warnings',
    header: 'Warnings',
    num: true,
    value: (s) => s.warnings,
    cell: (s) => (
      <span className={cn(s.warnings > 0 && WARNING_INK)}>
        <Num value={s.warnings} />
      </span>
    ),
  },
];

/** A session's models, one a line, left out with none: the Sessions list's and a change's or goal's sessions' alike. */
export const MODEL_FACT: ListFact<Pick<SessionRow, 'models'>> = [
  'Model',
  (s) =>
    s.models.length === 0
      ? null
      : s.models.map(({ model }) => (
          <span key={model} className="block">
            <Text value={modelLabel(model)} />
          </span>
        )),
];

const FACTS: ListFact<SessionRow>[] = [
  ...CHANGE_FACTS,
  ['ID', (s) => (s.sessionId === null ? null : <SessionChip id={s.sessionId} />)],
  MODEL_FACT,
  [
    'Effort',
    (s) =>
      s.models.length === 0
        ? null
        : s.models.map(({ model, effort }) => (
            <span key={model} className="block">
              <Text value={effort} />
            </span>
          )),
  ],
  ['Skills', (s) => <Num value={count(s, 'skill')} />],
  ['Commands typed', (s) => <Num value={count(s, 'command')} />],
  [
    'Never loaded',
    (s) => (
      <span className={cn(neverLoaded(s) > 0 && WARNING_INK)}>
        <Num value={neverLoaded(s)} />
      </span>
    ),
  ],
  ['Runs', (s) => <Num value={s.holds.length} />],
  ['Startup', (s) => (s.startup === null ? null : <span className={cn(!s.startup && WARNING_INK)}>{s.startup ? 'Loaded' : 'Missing'}</span>)],
];

/** The Sessions list: a row per session, newest start first as the API gives them; a row's title opens its facts, then
 * its timeline, and with `open` every row starts open. */
export function SessionsTable({ sessions, open = false }: { sessions: SessionRow[]; open?: boolean }) {
  return (
    <DataList
      rows={sessions}
      rowKey={(s) => s.key}
      name={(s) => sessionName(s.title)}
      columns={COLUMNS}
      facts={FACTS}
      extra={(s) => <Timeline session={s} name={sessionName(s.title)} />}
      label="Sessions"
      open={open}
      empty="No sessions in this period. A session shows here once the reporter reads its transcript."
    />
  );
}
