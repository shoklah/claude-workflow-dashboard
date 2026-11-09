import { Link } from '@tanstack/react-router';
import type { RunRow } from '@cwd/shared';
import { Badge } from '../components/ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { NONE, dollars, duration, findingsLabel, runName } from './format.ts';

const COLUMNS = ['Finished', 'Project · branch', 'Path', 'Time', 'Tasks', 'Findings', 'Stops', 'Est. cost', 'Warnings'];

function tasksLabel(run: RunRow): string {
  if (run.tasks === null) return NONE;
  return run.waves > 0 ? `${run.tasks} in ${run.waves} waves` : String(run.tasks);
}

/** The Runs list: one row per run, newest first as the API gives them, each linking to its page. */
export function RunsTable({ runs }: { runs: RunRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {COLUMNS.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.length === 0 && (
          <TableRow>
            <TableCell colSpan={COLUMNS.length} className="text-muted-foreground">
              No runs in this period.
            </TableCell>
          </TableRow>
        )}
        {runs.map((run) => (
          <TableRow key={run.key}>
            <TableCell>{run.finishedAt === null ? NONE : <Time iso={run.finishedAt} />}</TableCell>
            <TableCell>
              <Link to="/runs/$key" params={{ key: run.key }} className="underline-offset-2 hover:underline">
                {runName(run)}
              </Link>
              {run.beforeSteps && (
                <Badge variant="outline" className="ml-2">
                  before steps
                </Badge>
              )}
            </TableCell>
            <TableCell>{run.path ?? NONE}</TableCell>
            <TableCell>{duration(run.minutes)}</TableCell>
            <TableCell>{tasksLabel(run)}</TableCell>
            <TableCell>{findingsLabel(run)}</TableCell>
            <TableCell>{run.stops ?? NONE}</TableCell>
            <TableCell>{dollars(run.cost)}</TableCell>
            <TableCell>{run.warnings}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
