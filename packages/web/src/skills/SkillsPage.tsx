import { useState } from 'react';
import type { FindingsQuery, RunsResponse, SkillsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Badge } from '../components/ui/badge.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { NONE, outcomesLabel, reporterMark } from '../lib/format.ts';
import { ListFilters, listPath } from '../runs/RunsPage.tsx';

// The static page's columns; the last is the reporter's all-time figure.
const COLUMNS = ['Skill', 'Runs', 'Last', 'Outcomes'];

/** The Skills page: the period's skill loads in runs and sessions, by skill, under the static page's columns. */
export function SkillsPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const skills = useLiveQuery<SkillsResponse>(listPath('/api/skills', query));
  // The project options: every project of the longest period.
  const runs = useLiveQuery<RunsResponse>(listPath('/api/runs', { weeks: 52 }));
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Skills</h1>
      <ListFilters query={query} projects={runs.data?.projects} onChange={(change) => setQuery({ ...query, ...change })} />
      <p className="text-sm text-muted-foreground">
        The path and project filters choose the runs; every session counts. Runs counts the runs and sessions that
        loaded the skill.
      </p>
      {skills.isPending && <p className="text-sm text-muted-foreground">Loading the skills…</p>}
      {skills.isError && <p className="text-sm">Couldn't load the skills.</p>}
      {skills.data && (
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column}>{column}</TableHead>
              ))}
              <TableHead>
                Required but missing
                <Badge variant="outline" className="ml-2 border-dashed" title={reporterMark.tooltip}>
                  {reporterMark.text}
                </Badge>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.data.skills.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} className="text-muted-foreground">
                  No skill loads in this period.
                </TableCell>
              </TableRow>
            )}
            {skills.data.skills.map((skill) => (
              <TableRow key={skill.name}>
                <TableCell>{skill.name}</TableCell>
                <TableCell>{skill.runs}</TableCell>
                <TableCell>{skill.last === null ? NONE : <Time iso={skill.last} />}</TableCell>
                <TableCell>{outcomesLabel(skill.outcomes)}</TableCell>
                <TableCell>{skill.missing ?? NONE}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
