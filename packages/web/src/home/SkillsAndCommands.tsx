import { useState } from 'react';
import type { HomeResponse } from '@cwd/shared';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Option } from '../findings/FindingsPage.tsx';
import { cn } from 'cn';
import {
  SHARE_FILL,
  SHARE_TRACK,
  WARNING_INK,
  formatCount,
  formatPercent,
  ofLabel,
  plural,
  usageName,
} from '../lib/format.ts';

type Usage = HomeResponse['usage'];

const PERIODS: { period: keyof Usage; label: string }[] = [
  { period: 'thisWeek', label: 'This week' },
  { period: 'lastFourWeeks', label: 'Last 4 weeks' },
];

// The approved mockup's columns, its counts right-aligned in tabular figures.
const COLUMNS = ['Skill or command', 'Share of sessions', 'Sessions', 'Runs', 'Typed', 'Typed, never loaded'];
const COUNT = 'text-right tabular-nums';
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
    <section aria-labelledby="skills-and-commands" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <h2 id="skills-and-commands" className="font-medium">
          Skills and commands
        </h2>
        <div role="group" aria-label="Period" className="flex gap-1">
          {PERIODS.map((option) => (
            <Option key={option.period} pressed={period === option.period} onClick={() => setPeriod(option.period)}>
              {option.label}
            </Option>
          ))}
        </div>
        <span className="text-muted-foreground">
          {plural(shown.sessions, 'session')} · {plural(shown.runs, 'run')}
        </span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((column) => (
              <TableHead key={column} className={cn(isCount(column) && COUNT)}>
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {shown.rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="text-muted-foreground">
                No skill loaded and no command typed in this period.
              </TableCell>
            </TableRow>
          )}
          {shown.rows.map((row) => {
            const share = shown.sessions === 0 ? 0 : Math.round((100 * row.sessions) / shown.sessions);
            return (
              <TableRow key={`${row.kind} ${row.name}`}>
                <TableCell className={cn(row.kind === 'command' && 'font-mono text-xs')}>{usageName(row)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div aria-hidden className={cn('h-2 w-32', SHARE_TRACK)}>
                      <div className={cn('h-2 rounded-r', SHARE_FILL)} style={{ width: `${share}%` }} />
                    </div>
                    <span>{formatPercent(share)}</span>
                  </div>
                </TableCell>
                <TableCell className={COUNT}>{ofLabel(row.sessions, shown.sessions)}</TableCell>
                <TableCell className={COUNT}>{ofLabel(row.runs, shown.runs)}</TableCell>
                <TableCell className={COUNT}>{row.typed}</TableCell>
                <TableCell className={cn(COUNT, !!row.typedNeverLoaded && WARNING_INK)}>
                  {formatCount(row.typedNeverLoaded)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
