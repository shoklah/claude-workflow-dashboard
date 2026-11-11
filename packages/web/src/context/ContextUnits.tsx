import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import type { ContextUnit } from '@cwd/shared';
import { SessionChip } from '../components/SessionChip.tsx';
import { ShareBar } from '../components/ShareBar.tsx';
import { Badge } from '../components/ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { NONE, formatCompact, hiddenLabel, projectLabel, runWhere, sessionName } from '../lib/format.ts';

// The approved mockup's columns, its counts right-aligned in tabular figures; the first names the unit's kind.
const COLUMNS = [
  { label: 'Kind', count: false },
  { label: 'Unit', count: false },
  { label: 'When', count: false },
  { label: 'Calls', count: true },
  { label: 'Median per call', count: true },
  { label: 'Largest', count: true },
  { label: 'Past the cap', count: true },
  { label: 'Handoff', count: false },
  { label: 'Handed off to', count: false },
  { label: 'Read share', count: false },
  { label: 'Sweeps inline · delegated', count: true },
];
const COUNT = 'text-right tabular-nums';

/** A session's name, with its ID's chip when it has one. */
function SessionName({ title, sessionId }: { title: string | null; sessionId: string | null }) {
  return (
    <>
      <span className={cn(!title && 'text-muted-foreground')}>{sessionName(title)}</span>
      {sessionId !== null && (
        <div>
          <SessionChip id={sessionId} />
        </div>
      )}
    </>
  );
}

/** A run as its link to its page, a session as its name, chip and project. */
function UnitName({ unit }: { unit: ContextUnit }) {
  if (unit.run) {
    return (
      <Link to="/runs/$key" params={{ key: unit.run.key }} className="underline-offset-2 hover:underline">
        {runWhere(unit.run)}
      </Link>
    );
  }
  const session = unit.session!;
  return (
    <>
      <SessionName title={session.title} sessionId={session.sessionId} />
      <div className="text-muted-foreground">{projectLabel(session.project)}</div>
    </>
  );
}

/**
 * The Context page's runs and sessions, in the API's order (most calls past the cap first): over the cap only, or all
 * with a context, by the page's "Units" switch; a line under them counts those of other projects while showing.
 */
export function ContextUnits({
  units,
  hidden,
  over,
}: {
  units: ContextUnit[];
  hidden: number;
  over: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">Runs and sessions</h2>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Runs and sessions' }}>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column.label} className={cn(column.count && COUNT)}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="text-muted-foreground">
                {over
                  ? 'No runs or sessions past the cap in this period.'
                  : 'No runs or sessions with context in this period.'}
              </TableCell>
            </TableRow>
          )}
          {units.map((unit) => (
            <TableRow key={unit.key}>
              <TableCell>
                <Badge variant="outline">{unit.kind}</Badge>
              </TableCell>
              <TableCell>
                <UnitName unit={unit} />
              </TableCell>
              <TableCell>{unit.at === null ? NONE : <Time iso={unit.at} />}</TableCell>
              <TableCell className={COUNT}>{unit.calls}</TableCell>
              <TableCell className={COUNT}>{formatCompact(unit.medianTokens)}</TableCell>
              <TableCell className={COUNT}>{formatCompact(unit.maxTokens)}</TableCell>
              <TableCell className={COUNT}>{unit.callsOverCap}</TableCell>
              <TableCell>{unit.handoff === null ? NONE : <Time iso={unit.handoff} />}</TableCell>
              <TableCell>
                {unit.handedOffTo === null ? (
                  NONE
                ) : (
                  <SessionName title={unit.handedOffTo.title} sessionId={unit.handedOffTo.sessionId} />
                )}
              </TableCell>
              <TableCell>
                <ShareBar share={unit.readShare} />
              </TableCell>
              <TableCell className={COUNT}>{`${unit.sweeps.inline} · ${unit.sweeps.delegated}`}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hidden > 0 && <p className="text-sm text-muted-foreground">{hiddenLabel(hidden, 'row')}</p>}
    </div>
  );
}
