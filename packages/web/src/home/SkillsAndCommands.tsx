import { useState } from 'react';
import type { HomeResponse } from '@cwd/shared';
import { EmptyRow, NUM, Num } from '../components/Num.tsx';
import { Section } from '../components/Panel.tsx';
import { ShareBar } from '../components/ShareBar.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Option, Options } from '../components/Option.tsx';
import { cn } from 'cn';
import { WARNING_INK, plural, usageName } from '../lib/format.ts';

type Usage = HomeResponse['usage'];

const PERIODS: { period: keyof Usage; label: string }[] = [
  { period: 'thisWeek', label: 'This week' },
  { period: 'lastFourWeeks', label: 'Last 4 weeks' },
];

// The approved mockup's columns, its counts right-aligned in tabular figures.
const COLUMNS = ['Skill or command', 'Share of sessions', 'Sessions', 'Runs', 'Typed', 'Typed, never loaded'];
const isCount = (column: string) => COLUMNS.indexOf(column) >= 2;

/**
 * Home's skills and commands: per skill and slash command, the share of the period's sessions that loaded or typed it
 * as a one-hue bar with its number beside it, the sessions and runs that did, how often it was typed, and how often a
 * skill was typed but never loaded, this week or over the last four weeks.
 */
export function SkillsAndCommands({ usage }: { usage: Usage }) {
  const [period, setPeriod] = useState<keyof Usage>('thisWeek');
  const shown = usage[period];
  return (
    <Section
      title="Skills and commands"
      aside={
        <>
          <Options label="Period">
            {PERIODS.map((option) => (
              <Option key={option.period} pressed={period === option.period} onClick={() => setPeriod(option.period)}>
                {option.label}
              </Option>
            ))}
          </Options>
          <span className="text-sm">
            {plural(shown.sessions, 'session')} and {plural(shown.runs, 'run')}
          </span>
        </>
      }
    >
      <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Skills and commands table' }}>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column} className={cn(isCount(column) && NUM)}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.rows.length === 0 && (
            <EmptyRow columns={COLUMNS.length}>
              No skill loaded and no command typed in this period.
            </EmptyRow>
          )}
          {shown.rows.map((row) => {
            const share = shown.sessions === 0 ? 0 : Math.round((100 * row.sessions) / shown.sessions);
            return (
              <TableRow key={`${row.kind} ${row.name}`}>
                <TableCell>{usageName(row)}</TableCell>
                <TableCell>
                  <ShareBar share={share} />
                </TableCell>
                <TableCell className={NUM}>
                  <Num value={row.sessions} />
                </TableCell>
                <TableCell className={NUM}>
                  <Num value={row.runs} />
                </TableCell>
                <TableCell className={NUM}>
                  <Num value={row.typed} />
                </TableCell>
                <TableCell className={cn(NUM, !!row.typedNeverLoaded && WARNING_INK)}>
                  <Num value={row.typedNeverLoaded} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Section>
  );
}
