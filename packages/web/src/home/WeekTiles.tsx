import type { ReactNode } from 'react';
import { cn } from 'cn';
import type { WeekNumbers } from '@cwd/shared';
import { NUM, Num } from '../components/Num.tsx';
import { Panel } from '../components/Panel.tsx';
import { PATH_LABELS, formatDollars } from '../lib/format.ts';

// runs: the week's runs on every path, the sum of WeekNumbers.runs.
const runCount = (week: WeekNumbers) => week.runs.small + week.runs.full + week.runs.plan;

type Row = [string, ReactNode, ReactNode];

/** One measure's small table, named by its title: its parts as rows (the first the whole, the others indented), this
 * week beside last week. */
function Group({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <table aria-label={title} className="w-full text-sm">
      <thead>
        <tr className="border-b">
          <th scope="col" className="py-1 text-left font-semibold whitespace-nowrap">
            {title}
          </th>
          <th scope="col" className={cn('py-1 pl-3 font-medium whitespace-nowrap text-muted-foreground', NUM)}>
            This week
          </th>
          <th scope="col" className={cn('py-1 pl-3 font-medium whitespace-nowrap text-muted-foreground', NUM)}>
            Last week
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([name, now, before], i) => (
          <tr key={name}>
            <th scope="row" className={cn('py-0.5 text-left font-normal whitespace-nowrap', i > 0 && 'pl-3 text-muted-foreground')}>
              {name}
            </th>
            <td className={cn('py-0.5 pl-3', NUM, i === 0 && 'font-semibold')}>{now}</td>
            <td className={cn('py-0.5 pl-3', NUM)}>{before}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** This week's numbers against last week's: one panel, a small table per measure, one value per cell. */
export function WeekTiles({ thisWeek: a, lastWeek: b }: { thisWeek: WeekNumbers; lastWeek: WeekNumbers }) {
  const n = (value: number | null) => <Num value={value} />;
  const d = (value: number | null) => <Num value={value} format={formatDollars} />;
  return (
    <Panel title="This week">
      <div className="grid items-start gap-x-10 gap-y-5 sm:grid-cols-2 2xl:grid-cols-4">
        <Group
          title="Runs"
          rows={[
            ['All paths', n(runCount(a)), n(runCount(b))],
            [PATH_LABELS.small, n(a.runs.small), n(b.runs.small)],
            [PATH_LABELS.full, n(a.runs.full), n(b.runs.full)],
            [PATH_LABELS.plan, n(a.runs.plan), n(b.runs.plan)],
          ]}
        />
        <Group
          title="Findings"
          rows={[
            ['Found', n(a.findings.total), n(b.findings.total)],
            ['Acted on', n(a.findings.actedOn), n(b.findings.actedOn)],
            ['Open', n(a.findings.open), n(b.findings.open)],
          ]}
        />
        <Group
          title="Est. cost ($)"
          rows={[
            ['All runs', d(a.cost), d(b.cost)],
            ['A run', d(a.costPerRun), d(b.costPerRun)],
          ]}
        />
        <Group
          title="Warnings"
          rows={[
            ['Current', n(a.warnings), n(b.warnings)],
            ['New', n(a.newWarnings), n(b.newWarnings)],
          ]}
        />
      </div>
    </Panel>
  );
}
