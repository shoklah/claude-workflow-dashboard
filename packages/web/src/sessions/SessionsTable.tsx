import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import type { SessionRow } from '@cwd/shared';
import { SessionChip } from '../components/SessionChip.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import {
  NONE,
  NO_NAMES,
  WARNING_BORDER,
  WARNING_INK,
  clockTime,
  formatCost,
  formatMinutes,
  joined,
  modelsLabel,
  projectLabel,
  runName,
  sessionName,
  usageName,
  yesNoLabel,
} from '../lib/format.ts';

const COLUMNS = [
  'Session',
  'Project',
  'Started',
  'Length',
  'Skills loaded',
  'Commands typed',
  'Model',
  'Est. cost',
  'Startup',
  'Warnings',
  'Holds',
];

const TAG = 'mr-1 mb-1 inline-block rounded-sm border px-1.5 text-xs whitespace-nowrap';

type Hold = SessionRow['holds'][number];

/** A held run's link to its page: "atlas · feat/search · full". */
function HoldLink({ hold }: { hold: Hold }) {
  return (
    <Link to="/runs/$key" params={{ key: hold.runKey }} className="underline-offset-2 hover:underline">
      {joined([runName(hold), hold.path])}
    </Link>
  );
}

/** A session's skill loads, commands and held runs' window starts, in the API's time order. */
function Timeline({ session, name }: { session: SessionRow; name: string }) {
  if (session.timeline.length === 0) return <p className="text-muted-foreground">No skill loads, commands or runs.</p>;
  return (
    <ol aria-label={`Timeline of ${name}`} className="flex flex-col gap-0.5">
      {session.timeline.map((item, i) => {
        const hold = session.holds.find((h) => h.runKey === item.runKey);
        return (
          <li key={i}>
            <time dateTime={item.at} className="mr-2 text-muted-foreground tabular-nums">
              {clockTime(item.at)}
            </time>
            {item.kind === 'skill' && (
              <>
                skill <b>{item.name}</b> · {item.outcome ?? NONE}
              </>
            )}
            {item.kind === 'command' && (
              <>
                command <b>{usageName({ name: item.name, kind: 'command' })}</b>
                {item.neverLoaded && <span className={WARNING_INK}> · its skill never loaded</span>}
              </>
            )}
            {item.kind === 'run' && <>run window starts · {hold ? <HoldLink hold={hold} /> : item.name}</>}
          </li>
        );
      })}
    </ol>
  );
}

/** A session's row and, when open, its timeline's row below it. */
function SessionRows({ session }: { session: SessionRow }) {
  const [open, setOpen] = useState(false);
  const name = sessionName(session.title);
  const skills = [...new Set(session.timeline.filter((t) => t.kind === 'skill').map((t) => t.name))];
  const commands = new Map<string, boolean>();
  for (const t of session.timeline.filter((t) => t.kind === 'command')) {
    commands.set(t.name, (commands.get(t.name) ?? false) || t.neverLoaded);
  }
  return (
    <>
      <TableRow>
        <TableCell>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className={cn('text-left underline-offset-2 hover:underline', !session.title && 'text-muted-foreground')}
          >
            {name}
          </button>
          {session.sessionId !== null && (
            <div>
              <SessionChip id={session.sessionId} />
            </div>
          )}
        </TableCell>
        <TableCell className={cn(session.project === null && 'text-muted-foreground')}>
          {projectLabel(session.project)}
        </TableCell>
        <TableCell>
          <Time iso={session.start} />
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatMinutes(session.minutes)}</TableCell>
        <TableCell className="whitespace-normal">
          {skills.length === 0 && <span className="text-muted-foreground">{NO_NAMES}</span>}
          {skills.map((skill) => (
            <span key={skill} className={TAG}>
              {skill}
            </span>
          ))}
        </TableCell>
        <TableCell className="whitespace-normal">
          {commands.size === 0 && <span className="text-muted-foreground">{NO_NAMES}</span>}
          {[...commands].map(([command, neverLoaded]) => (
            <span key={command} className={cn(TAG, 'font-mono', neverLoaded && [WARNING_BORDER, WARNING_INK])}>
              {usageName({ name: command, kind: 'command' })}
              {neverLoaded && ' · never loaded'}
            </span>
          ))}
        </TableCell>
        <TableCell>{modelsLabel(session.models)}</TableCell>
        <TableCell className="text-right tabular-nums">{formatCost(session.cost)}</TableCell>
        <TableCell className={cn(session.startup === false && WARNING_INK)}>{yesNoLabel(session.startup)}</TableCell>
        <TableCell className={cn('text-right tabular-nums', session.warnings > 0 && WARNING_INK)}>
          {session.warnings}
        </TableCell>
        <TableCell>
          {session.holds.length === 0 && NONE}
          {session.holds.map((hold) => (
            <div key={hold.runKey}>
              <HoldLink hold={hold} />
            </div>
          ))}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow className="bg-muted/30">
          <TableCell colSpan={COLUMNS.length} className="text-sm">
            <Timeline session={session} name={name} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/** The Sessions list: a row per session, newest start first as the API gives them; a row's name opens its timeline. */
export function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Sessions' }}>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead
              key={column}
              className={cn(['Length', 'Est. cost', 'Warnings'].includes(column) && 'text-right')}
            >
              {column}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sessions.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMNS.length} className="text-muted-foreground">
              No sessions in this period.
            </TableCell>
          </TableRow>
        )}
        {sessions.map((session) => (
          <SessionRows key={session.key} session={session} />
        ))}
      </TableBody>
    </Table>
  );
}
