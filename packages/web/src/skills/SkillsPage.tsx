import { useState } from 'react';
import type { FindingsQuery, SkillsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { NONE, formatCount, outcomesLabel } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';

// The static page's columns.
const COLUMNS = ['Skill', 'Runs', 'Last', 'Outcomes', 'Required but missing'];

/** The Skills page: the period's skill loads in runs and sessions, by skill, under the static page's columns. */
export function SkillsPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const skills = useLiveQuery<SkillsResponse>(listPath('/api/skills', query));
  const projects = useProjects();
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold">Skills</h1>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })} />
      <p className="text-sm text-muted-foreground">
        The path and project filters choose the runs; every session's loads count. Runs counts the runs and sessions
        that loaded the skill. Required but missing counts the runs that finished and the sessions that started in the
        period, a path filter leaving the sessions out.
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.data.skills.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} className="text-muted-foreground">
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
                <TableCell>{formatCount(skill.missing)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
