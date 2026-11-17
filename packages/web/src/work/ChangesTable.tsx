import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import type { ChangeRow } from '@cwd/shared';
import { EmptyRow, NUM, Num, Unknown } from '../components/Num.tsx';
import { LINK, Term } from '../components/Panel.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import {
  STAGE_LABELS,
  formatDollars,
  otherCountLabel,
  otherProjectsLabel,
  pathLabel,
  projectLabel,
} from '../lib/format.ts';

/** The table's columns, with the Project column. */
const COLUMN_COUNT = 9;

/** A list of changes, as the API orders them, in a region named `label`: each title linking to its change's page, then
 * (with `project`) its home project with "+N" for its other projects, its path, stage, last activity and whole totals. */
export function ChangesTable({ rows, project, label }: { rows: ChangeRow[]; project: boolean; label: string }) {
  return (
    <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': label }}>
      <TableHeader>
        <TableRow>
          <TableHead>Change</TableHead>
          {project && <TableHead>Project</TableHead>}
          <TableHead>Path</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead>Last activity</TableHead>
          <TableHead className={NUM}>Runs</TableHead>
          <TableHead className={NUM}>Sessions</TableHead>
          <TableHead className={NUM}>Findings</TableHead>
          <TableHead className={NUM}>Est. cost ($)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <EmptyRow columns={project ? COLUMN_COUNT : COLUMN_COUNT - 1}>No changes in this period.</EmptyRow>
        )}
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-medium">
              {/* As wide as its title up to the column's maximum, so it wraps only past it, never down to a word. */}
              <Link
                to="/work/changes/$key"
                params={{ key: row.key }}
                className={cn(LINK, 'inline-block w-max max-w-80 whitespace-normal')}
              >
                {row.title}
              </Link>
            </TableCell>
            {project && (
              <TableCell className="text-muted-foreground">
                {projectLabel(row.project)}
                {row.otherCount > 0 && (
                  <Term tip={otherProjectsLabel(row.otherProjects, row.otherCount)} className="ml-2">
                    {otherCountLabel(row.otherCount)}
                  </Term>
                )}
              </TableCell>
            )}
            <TableCell className="text-muted-foreground">{pathLabel(row.path)}</TableCell>
            <TableCell className="text-muted-foreground">{STAGE_LABELS[row.stage]}</TableCell>
            <TableCell className="text-muted-foreground tabular-nums">
              {row.lastActivity ? <Time iso={row.lastActivity} /> : <Unknown />}
            </TableCell>
            <TableCell className={NUM}>
              <Num value={row.runs} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={row.sessions} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={row.findings} />
            </TableCell>
            <TableCell className={NUM}>
              <Num value={row.cost} format={formatDollars} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
