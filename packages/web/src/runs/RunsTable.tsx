import { cn } from 'cn';
import type { RunFacts, RunRow } from '@cwd/shared';
import { ChangeLink } from '../components/ChangeLink.tsx';
import { EmptyRow, GroupHead, NUM, Num, SUB, TITLE, Text, Unknown, WRAP } from '../components/Num.tsx';
import { RunLink } from '../components/RunLink.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { closedFindings, formatDollars, foundFindings, pathLabel } from '../lib/format.ts';

const COLUMN_COUNT = 15;

/** A unit's Change and Goal cells, the Runs and Sessions lists' alike: its change linking to the change's page (the
 * dash, read "no design", without one) and its goal's name (the dash, read "no goal"). */
export function ChangeCells({
  change,
  goal,
  className,
}: {
  change: RunRow['change'];
  goal: RunRow['goal'];
  className?: string;
}) {
  return (
    <>
      <TableCell className={cn(TITLE, className)}>
        {change ? (
          <ChangeLink changeKey={change.key} title={change.title} />
        ) : (
          <Unknown label="no design" />
        )}
      </TableCell>
      <TableCell className={cn(WRAP, 'text-muted-foreground', className)}>
        <Text value={goal?.name} unknown="no goal" />
      </TableCell>
    </>
  );
}

/** The Runs list: one row per run, newest first as the API gives them, its title (else its branch) linking to its
 * page, then its change and goal; one value per cell, the unit in the header. With `of`, the runs of one change (a
 * change's page): no Change, Goal, Waves, Stops or Warnings column, and Project and Path only as `of` asks (several
 * projects, a plan record). */
export function RunsTable({
  runs,
  of,
}: {
  runs: (RunFacts & Partial<Pick<RunRow, 'change' | 'goal'>>)[];
  of?: { project: boolean; path: boolean };
}) {
  const all = !of;
  const project = of?.project ?? true;
  const path = of?.path ?? true;
  const columns = all ? COLUMN_COUNT : COLUMN_COUNT - 5 - Number(!project) - Number(!path);
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Runs table' }}>
      <TableHeader>
        <TableRow>
          <TableHead rowSpan={2}>Run</TableHead>
          {all && <TableHead rowSpan={2}>Change</TableHead>}
          {all && <TableHead rowSpan={2}>Goal</TableHead>}
          <TableHead rowSpan={2}>Branch</TableHead>
          {project && <TableHead rowSpan={2}>Project</TableHead>}
          {path && <TableHead rowSpan={2}>Path</TableHead>}
          <TableHead rowSpan={2}>Finished</TableHead>
          <TableHead rowSpan={2} className={cn(NUM, WRAP)}>
            Time (min)
          </TableHead>
          <TableHead rowSpan={2} className={NUM}>
            Tasks
          </TableHead>
          {all && (
            <TableHead rowSpan={2} className={NUM}>
              Waves
            </TableHead>
          )}
          <GroupHead span={2}>Findings</GroupHead>
          {all && (
            <TableHead rowSpan={2} className={NUM}>
              Stops
            </TableHead>
          )}
          <TableHead rowSpan={2} className={cn(NUM, WRAP)}>
            Est. cost ($)
          </TableHead>
          {all && (
            <TableHead rowSpan={2} className={NUM}>
              Warnings
            </TableHead>
          )}
        </TableRow>
        <TableRow>
          <TableHead className={cn(SUB, NUM)}>Found</TableHead>
          <TableHead className={cn(SUB, NUM)}>Closed</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.length === 0 && (
          <EmptyRow columns={columns}>
            {all
              ? 'No runs in this period. A run shows here once its record is written and imported.'
              : 'No runs yet. A run shows here once its record is written and imported.'}
          </EmptyRow>
        )}
        {runs.map((run) => (
          <TableRow key={run.key}>
            <TableCell className={cn(TITLE, 'font-medium')}>
              <RunLink runKey={run.key} branch={run.branch} title={run.headline} />
              {run.beforeSteps && <span className="ml-2 text-xs font-normal text-muted-foreground">before steps</span>}
            </TableCell>
            {all && <ChangeCells change={run.change ?? null} goal={run.goal ?? null} />}
            <TableCell className={cn(WRAP, 'text-muted-foreground')}>
              <Text value={run.branch} unknown="no branch" />
            </TableCell>
            {project && (
              <TableCell className={cn(WRAP, 'text-muted-foreground')}>
                <Text value={run.project} />
              </TableCell>
            )}
            {path && (
              <TableCell className="text-muted-foreground">
                <Text value={pathLabel(run.path)} />
              </TableCell>
            )}
            <TableCell className={cn(WRAP, 'text-muted-foreground tabular-nums')}>
              {run.finishedAt === null ? <Text value={null} /> : <Time iso={run.finishedAt} />}
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.minutes} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={run.tasks} />
            </TableCell>
            {all && (
              <TableCell className={NUM}>
                <Num value={run.tasks === null ? null : run.waves} />
              </TableCell>
            )}
            <TableCell className={NUM}>
              <Num value={foundFindings(run)} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={closedFindings(run)} />
            </TableCell>
            {all && (
              <TableCell className={NUM}>
                <Num value={run.stops} />
              </TableCell>
            )}
            <TableCell className={NUM}>
              <Num value={run.cost} format={formatDollars} />
            </TableCell>
            {all && (
              <TableCell className={NUM}>
                <Num value={run.warnings} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
