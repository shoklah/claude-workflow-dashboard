import { useState } from 'react';
import { cn } from 'cn';
import type { FindingsQuery, SkillsResponse } from '@cwd/shared';
import { useLiveQuery } from '../api.ts';
import { GroupHead, NUM, Num, SUB, Unknown } from '../components/Num.tsx';
import { Details, PageTitle, State } from '../components/Panel.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { NONE, capitalize } from '../lib/format.ts';
import { ListFilters, listPath, useProjects } from '../runs/RunsPage.tsx';

const COLUMN_COUNT = 6;

/** The Skills page: the period's skill loads in runs and sessions, by skill, one line per outcome with the skill's
 * cells spanning them. */
export function SkillsPage() {
  const [query, setQuery] = useState<FindingsQuery>({ weeks: 4 });
  const skills = useLiveQuery<SkillsResponse>(listPath('/api/skills', query));
  const projects = useProjects();
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Skills</PageTitle>
      <ListFilters query={query} projects={projects} onChange={(change) => setQuery({ ...query, ...change })} />
      {skills.isPending && <State>Loading the skills…</State>}
      {skills.isError && (
        <State error>Couldn't load the skills. Check that the dashboard server is running, then refresh.</State>
      )}
      {skills.data && (
        <Table containerProps={{ tabIndex: 0, role: 'region', 'aria-label': 'Skills' }}>
          <TableHeader>
            <TableRow>
              <TableHead rowSpan={2}>Skill</TableHead>
              <TableHead rowSpan={2} className={NUM}>
                Runs and sessions
              </TableHead>
              <TableHead rowSpan={2} className={NUM}>
                Required but missing
              </TableHead>
              <TableHead rowSpan={2}>Last loaded</TableHead>
              <GroupHead span={2}>Loads, by outcome</GroupHead>
            </TableRow>
            <TableRow>
              <TableHead className={SUB}>Outcome</TableHead>
              <TableHead className={cn(SUB, NUM)}>Loads</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skills.data.skills.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="text-muted-foreground">
                  No skill loads in this period. A skill shows here once a run or session loads it.
                </TableCell>
              </TableRow>
            )}
            {skills.data.skills.flatMap((skill) => {
              const outcomes = Object.entries(skill.outcomes);
              const lines = Math.max(1, outcomes.length);
              return Array.from({ length: lines }, (_, i) => (
                <TableRow key={`${skill.name} ${i}`} className={cn(i < lines - 1 && 'border-b-0')}>
                  {i === 0 && (
                    <>
                      <TableHead scope="row" rowSpan={lines} className="h-auto py-2 align-top">
                        {skill.name}
                      </TableHead>
                      <TableCell rowSpan={lines} className={cn(NUM, 'align-top')}>
                        <Num value={skill.runs} />
                      </TableCell>
                      <TableCell rowSpan={lines} className={cn(NUM, 'align-top')}>
                        <Num value={skill.missing} />
                      </TableCell>
                      <TableCell rowSpan={lines} className="align-top text-muted-foreground tabular-nums">
                        {skill.last === null ? <Unknown label="never loaded" /> : <Time iso={skill.last} />}
                      </TableCell>
                    </>
                  )}
                  {outcomes[i] ? (
                    <>
                      <TableCell>
                        {outcomes[i][0] === NONE ? <Unknown label="no outcome recorded" /> : capitalize(outcomes[i][0])}
                      </TableCell>
                      <TableCell className={NUM}>
                        <Num value={outcomes[i][1]} />
                      </TableCell>
                    </>
                  ) : (
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No loads
                    </TableCell>
                  )}
                </TableRow>
              ));
            })}
          </TableBody>
        </Table>
      )}
      <Details summary="How skills are counted">
        <p className="max-w-prose">
          The path and project filters choose the runs; every session's loads count. "Runs and sessions" counts those
          that loaded the skill. "Required but missing" counts the runs that finished and the sessions that started in
          the period, a path filter leaving the sessions out.
        </p>
      </Details>
    </div>
  );
}
