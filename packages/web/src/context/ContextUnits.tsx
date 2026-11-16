import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import type { ContextUnit } from '@cwd/shared';
import { EmptyRow, GroupHead, NUM, Num, SUB, Text, Unknown } from '../components/Num.tsx';
import { LINK, Line, SectionTitle } from '../components/Panel.tsx';
import { SessionChip } from '../components/SessionChip.tsx';
import { ShareBar } from '../components/ShareBar.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import {
  WARNING_INK,
  capitalize,
  formatCompactFixed,
  hiddenLabel,
  projectLabel,
  sessionName,
} from '../lib/format.ts';

const COLUMN_COUNT = 14;

/** A run's branch as its link to its page, a session's name alone (its ID stays off the row). */
function UnitName({ unit }: { unit: ContextUnit }) {
  if (unit.run) {
    return (
      <Link to="/runs/$key" params={{ key: unit.run.key }} className={LINK}>
        <Text value={unit.run.branch} unknown="no branch" />
      </Link>
    );
  }
  const title = unit.session?.title ?? null;
  return <span className={cn(!title && 'font-normal text-muted-foreground')}>{sessionName(title)}</span>;
}

/**
 * The Context page's runs and sessions, in the API's order (most calls past the cap first): over the cap only, or all
 * with a context, by the switch beside its title (`children`); a line under them counts those of other projects while
 * showing.
 */
export function ContextUnits({
  units,
  hidden,
  over,
  children,
}: {
  units: ContextUnit[];
  hidden: number;
  over: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <SectionTitle>Runs and sessions</SectionTitle>
        {children}
      </div>
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Runs and sessions' }}>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Name</TableHead>
            <TableHead rowSpan={2}>Kind</TableHead>
            <TableHead rowSpan={2}>Project</TableHead>
            <TableHead rowSpan={2}>When</TableHead>
            <TableHead rowSpan={2} className={NUM}>
              Calls
            </TableHead>
            <GroupHead span={2}>Context (tokens)</GroupHead>
            <TableHead rowSpan={2} className={NUM}>
              Calls past the cap
            </TableHead>
            <GroupHead span={3}>Handoff</GroupHead>
            <TableHead rowSpan={2}>Read share</TableHead>
            <GroupHead span={2}>Sweeps</GroupHead>
          </TableRow>
          <TableRow>
            <TableHead className={cn(SUB, NUM)}>Median per call</TableHead>
            <TableHead className={cn(SUB, NUM)}>Largest</TableHead>
            <TableHead className={SUB}>At</TableHead>
            <TableHead className={SUB}>To session</TableHead>
            <TableHead className={SUB}>ID</TableHead>
            <TableHead className={cn(SUB, NUM)}>Inline</TableHead>
            <TableHead className={cn(SUB, NUM)}>Delegated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {units.length === 0 && (
            <EmptyRow columns={COLUMN_COUNT}>
              {over
                ? 'No runs or sessions past the cap in this period.'
                : 'No runs or sessions with context in this period.'}
            </EmptyRow>
          )}
          {units.map((unit) => (
            <TableRow key={unit.key}>
              <TableCell className="font-medium">
                <UnitName unit={unit} />
              </TableCell>
              <TableCell className="text-muted-foreground">{capitalize(unit.kind)}</TableCell>
              <TableCell className="text-muted-foreground">
                {unit.run ? <Text value={unit.run.project} /> : projectLabel(unit.session?.project ?? null)}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {unit.at === null ? <Unknown /> : <Time iso={unit.at} />}
              </TableCell>
              <TableCell className={NUM}>
                <Num value={unit.calls} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={unit.medianTokens} format={formatCompactFixed} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={unit.maxTokens} format={formatCompactFixed} />
              </TableCell>
              <TableCell className={cn(NUM, unit.callsOverCap > 0 && WARNING_INK)}>
                <Num value={unit.callsOverCap} />
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {unit.handoff === null ? <Unknown label="no handoff" /> : <Time iso={unit.handoff} />}
              </TableCell>
              <TableCell>
                {unit.handedOffTo === null ? (
                  <Unknown label="no handoff" />
                ) : (
                  <span className={cn(!unit.handedOffTo.title && 'text-muted-foreground')}>
                    {sessionName(unit.handedOffTo.title)}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {unit.handedOffTo === null ? (
                  <Unknown label="no handoff" />
                ) : unit.handedOffTo.sessionId === null ? (
                  <Unknown label="hidden while showing" />
                ) : (
                  <SessionChip id={unit.handedOffTo.sessionId} />
                )}
              </TableCell>
              <TableCell>
                <ShareBar share={unit.readShare} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={unit.sweeps.inline} />
              </TableCell>
              <TableCell className={NUM}>
                <Num value={unit.sweeps.delegated} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hidden > 0 && <Line>{hiddenLabel(hidden, 'row')}</Line>}
    </div>
  );
}
