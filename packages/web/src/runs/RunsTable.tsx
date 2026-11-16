import { cn } from 'cn';
import type { RunRow } from '@cwd/shared';
import { EmptyRow, GroupHead, NUM, Num, SUB, Text } from '../components/Num.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { closedFindings, formatDollars, foundFindings, pathLabel } from '../lib/format.ts';

const COLUMN_COUNT = 12;

/** The Runs list: one row per run, newest first as the API gives them, its branch linking to its page; one value per
 * cell, the unit in the header. */
export function RunsTable({ runs }: { runs: RunRow[] }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Runs table' }}>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Branch</TableHead>
          <TableHead rowSpan={2}>Project</TableHead>
          <TableHead rowSpan={2}>Path</TableHead>
          <TableHead rowSpan={2}>Finished</TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Time (min)
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Tasks
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Waves
          </TableHead>
          <GroupHead span={2}>Findings</GroupHead>
          <TableHead rowSpan={2} className={NUM}>
            Stops
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Est. cost ($)
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Warnings
          </TableHead>
        </TableRow>
        <TableRow>
          <TableHead className={cn(SUB, NUM)}>Found</TableHead>
          <TableHead className={cn(SUB, NUM)}>Closed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.length === 0 && (
          <EmptyRow columns={COLUMN_COUNT}>
            No runs in this period. A run shows here once its record is written and imported.
          </EmptyRow>
        )}
        {runs.map((run) => (
          <TableRow key={run.key}>
            <TableCell className="font-medium">
              <RunLink runKey={run.key} branch={run.branch} />
              {run.beforeSteps && <span className="ml-2 text-xs font-normal text-muted-foreground">before steps</span>}
            </TableCell>
            <TableCell className="text-muted-foreground">
              <Text value={run.project} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              <Text value={pathLabel(run.path)} />
            </TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {run.finishedAt === null ? <Text value={null} /> : <Time iso={run.finishedAt} />}
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.minutes} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.tasks} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.tasks === null ? null : run.waves} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={foundFindings(run)} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={closedFindings(run)} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.stops} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.cost} format={formatDollars} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.warnings} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
