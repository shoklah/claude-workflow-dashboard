import { cn } from 'cn';
import type { WorkSessionRow } from '@cwd/shared';
import { ChangeLink } from '../components/ChangeLink.tsx';
import { EmptyRow, NUM, Num, TITLE, Text, Unknown, WRAP } from '../components/Num.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { SessionLink } from '../components/SessionLink.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { STAGE_LABELS, formatDollars, formatLength, modelLabel, sessionName } from '../lib/format.ts';

/** The table's columns, with the Change column. */
const COLUMN_COUNT = 9;

/** Who started a session: the starter's title, "Another session" when showing mode hides it or it isn't stored, else the dash read
 * "started by you". */
function StartedBy({ by }: { by: WorkSessionRow['startedBy'] }) {
  if (!by) return <Unknown label="started by you" />;
  return <>{by.key === null ? 'Another session' : sessionName(by.title)}</>;
}

/** A change's or goal's Sessions table, as the API orders them: each title linking to the session in the Sessions
 * view, (with `change`) its change, its step, start, starter, length, models, held run and cost. */
export function SessionsByWork({ sessions, change }: { sessions: WorkSessionRow[]; change: boolean }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Sessions table' }}>
      <TableHeader>
        <TableRow>
          <TableHead>Session</TableHead>
          {change && <TableHead>Change</TableHead>}
          <TableHead>Step</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Started by</TableHead>
          <TableHead className={NUM}>Length</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Run</TableHead>
          <TableHead className={cn(NUM, WRAP)}>Est. cost ($)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.length === 0 && (
          <EmptyRow columns={change ? COLUMN_COUNT : COLUMN_COUNT - 1}>
            No sessions here yet. A session shows here once its transcript is imported.
          </EmptyRow>
        )}
        {sessions.map((session) => (
          <TableRow key={session.key}>
            <TableCell className={cn(TITLE, 'font-medium')}>
              <SessionLink sessionKey={session.key} title={session.title} />
            </TableCell>
            {change && (
              <TableCell className={TITLE}>
                {session.change ? (
                  <ChangeLink changeKey={session.change.key} title={session.change.title} />
                ) : (
                  <Unknown label="no change" />
                )}
              </TableCell>
            )}
            <TableCell className="text-muted-foreground">{STAGE_LABELS[session.step]}</TableCell>
            <TableCell className={cn(WRAP, 'text-muted-foreground tabular-nums')}>
              <Time iso={session.start} />
            </TableCell>
            <TableCell className={cn(WRAP, 'text-muted-foreground')}>
              <StartedBy by={session.startedBy} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={session.minutes} format={formatLength} />
            </TableCell>
            <TableCell className={WRAP}>
              {session.models.length === 0 && <Unknown />}
              {session.models.map(({ model }) => (
                <span key={model} className="block">
                  <Text value={modelLabel(model)} />
                </span>
              ))}
            </TableCell>
            <TableCell className={TITLE}>
              {session.run ? (
                <RunLink runKey={session.run.key} branch={session.run.branch} title={session.run.title} />
              ) : (
                <Unknown label="no run" />
              )}
            </TableCell>
            <TableCell className={NUM}>
              <Num value={session.cost} format={formatDollars} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
