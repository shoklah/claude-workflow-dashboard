import { useState } from 'react';
import { cn } from 'cn';
import type { SessionRow } from '@cwd/shared';
import { EmptyRow, GroupHead, NUM, Num, SUB, TITLE, Text, Unknown, WRAP } from '../components/Num.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { RowToggle } from '../components/RowToggle.tsx';
import { SessionChip } from '../components/SessionChip.tsx';
import { ChangeCells } from '../runs/RunsTable.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import {
  WARNING_INK,
  formatDollars,
  formatLength,
  modelLabel,
  pathLabel,
  projectLabel,
  sessionName,
  timelineTimes,
  usageName,
} from '../lib/format.ts';

const COLUMN_COUNT = 16;
const KINDS: Record<SessionRow['timeline'][number]['kind'], string> = {
  skill: 'Skill loaded',
  command: 'Command typed',
  run: 'Run started',
};

/** A session's skill loads, commands and held runs' window starts, in the API's time order: a small table, one value
 * per cell. */
function Timeline({ session, name }: { session: SessionRow; name: string }) {
  if (session.timeline.length === 0) {
    return <p className="text-muted-foreground">No skill loads, commands or runs in this session.</p>;
  }
  const times = timelineTimes(session.timeline.map((item) => item.at));
  return (
    <table aria-label={`Timeline of ${name}`} className="text-sm">
      <thead>
        <tr className="text-left text-muted-foreground">
          {['Time', 'What', 'Name', 'Outcome'].map((column) => (
            <th key={column} scope="col" className="py-1 pr-6 font-medium">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {session.timeline.map((item, i) => {
          const hold = session.holds.find((h) => h.runKey === item.runKey);
          return (
            <tr key={i}>
              <td className="py-1 pr-6 whitespace-nowrap text-muted-foreground tabular-nums">
                <time dateTime={item.at}>{times[i]}</time>
              </td>
              <td className="py-1 pr-6 whitespace-nowrap text-muted-foreground">{KINDS[item.kind]}</td>
              <td className="py-1 pr-6 font-medium">
                {item.kind === 'run' && hold ? (
                  <RunLink runKey={hold.runKey} branch={hold.branch} />
                ) : (
                  usageName({ name: item.name, kind: item.kind === 'command' ? 'command' : 'skill' })
                )}
              </td>
              <td className={cn('py-1', item.neverLoaded && WARNING_INK)}>
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
    </table>
  );
}

/** A session's row of counts and, when open (at first with `initial`), its timeline's row below it. */
function SessionRows({ session, initial }: { session: SessionRow; initial: boolean }) {
  const [open, setOpen] = useState(initial);
  const name = sessionName(session.title);
  const count = (kind: string) => new Set(session.timeline.filter((t) => t.kind === kind).map((t) => t.name)).size;
  const neverLoaded = new Set(session.timeline.filter((t) => t.neverLoaded).map((t) => t.name)).size;
  return (
    <>
      <TableRow className={open ? 'border-b-0' : undefined}>
        <TableCell className={cn(TITLE, 'align-top font-medium')}>
          <RowToggle
            open={open}
            onToggle={() => setOpen(!open)}
            className={cn(!session.title && 'font-normal text-muted-foreground')}
          >
            {name}
          </RowToggle>
        </TableCell>
        <TableCell className="align-top text-muted-foreground">
          {session.sessionId === null ? <Unknown label="hidden while showing" /> : <SessionChip id={session.sessionId} />}
        </TableCell>
        <TableCell className={cn(WRAP, 'align-top text-muted-foreground')}>{projectLabel(session.project)}</TableCell>
        <ChangeCells change={session.change} goal={session.goal} className="align-top" />
        <TableCell className={cn(WRAP, 'align-top text-muted-foreground tabular-nums')}>
          <Time iso={session.start} />
        </TableCell>
        <TableCell className={cn(NUM, 'align-top')}>
          <Num value={session.minutes} format={formatLength} />
        </TableCell>
        <TableCell className={cn(WRAP, 'align-top')}>
          {session.models.length === 0 && <Unknown />}
          {session.models.map(({ model }) => (
            <span key={model} className="block">
              <Text value={modelLabel(model)} />
            </span>
          ))}
        </TableCell>
        <TableCell className="align-top text-muted-foreground">
          {session.models.length === 0 && <Unknown />}
          {session.models.map(({ model, effort }) => (
            <span key={model} className="block">
              <Text value={effort} />
            </span>
          ))}
        </TableCell>
        <TableCell className={cn(NUM, 'align-top')}>
          <Num value={session.cost} format={formatDollars} />
        </TableCell>
        <TableCell className={cn(NUM, 'align-top')}>
          <Num value={count('skill')} />
        </TableCell>
        <TableCell className={cn(NUM, 'align-top')}>
          <Num value={count('command')} />
        </TableCell>
        <TableCell className={cn(NUM, 'align-top', neverLoaded > 0 && WARNING_INK)}>
          <Num value={neverLoaded} />
        </TableCell>
        <TableCell className={cn(NUM, 'align-top')}>
          <Num value={session.holds.length} />
        </TableCell>
        <TableCell className={cn('align-top', session.startup === false ? WARNING_INK : 'text-muted-foreground')}>
          {session.startup === null ? <Unknown /> : session.startup ? 'Loaded' : 'Missing'}
        </TableCell>
        <TableCell className={cn(NUM, 'align-top', session.warnings > 0 && WARNING_INK)}>
          <Num value={session.warnings} />
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={COLUMN_COUNT} className="pt-0 pb-4 pl-9">
            <Timeline session={session} name={name} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** The Sessions list: a row per session, newest start first as the API gives them; a row's name opens its timeline,
 * and with `open` every row starts open. */
export function SessionsTable({ sessions, open = false }: { sessions: SessionRow[]; open?: boolean }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Sessions' }}>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Session</TableHead>
          <TableHead rowSpan={2}>ID</TableHead>
          <TableHead rowSpan={2}>Project</TableHead>
          <TableHead rowSpan={2}>Change</TableHead>
          <TableHead rowSpan={2}>Goal</TableHead>
          <TableHead rowSpan={2}>Started</TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Length
          </TableHead>
          <TableHead rowSpan={2}>Model</TableHead>
          <TableHead rowSpan={2}>Effort</TableHead>
          <TableHead rowSpan={2} className={cn(NUM, WRAP)}>
            Est. cost ($)
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Skills
          </TableHead>
          <GroupHead span={2}>Commands</GroupHead>
          <TableHead rowSpan={2} className={NUM}>
            Runs
          </TableHead>
          <TableHead rowSpan={2}>Startup</TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Warnings
          </TableHead>
        </TableRow>
        <TableRow>
          <TableHead className={cn(SUB, NUM)}>Typed</TableHead>
          <TableHead className={cn(SUB, NUM, WRAP)}>Never loaded</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.length === 0 && (
          <EmptyRow columns={COLUMN_COUNT}>
            No sessions in this period. A session shows here once the reporter reads its transcript.
          </EmptyRow>
        )}
        {sessions.map((session) => (
          <SessionRows key={session.key} session={session} initial={open} />
        ))}
      </TableBody>
    </Table>
  );
}
