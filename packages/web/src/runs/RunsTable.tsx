import { useMemo } from 'react';
import { closedFindings, foundFindings, parseTime, type RunFacts, type RunRow } from '@cwd/shared';
import { ChangeLink } from '../components/ChangeLink.tsx';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Num, Text } from '../components/Num.tsx';
import { RunLink, runName } from '../components/RunLink.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { formatDollars, pathLabel } from '../lib/format.ts';

/** A run as the Runs list takes it: a change's page gives its runs without their change and goal. */
type ListedRun = RunFacts & Partial<Pick<RunRow, 'change' | 'goal'>>;

/** A unit's Change and Goal facts, the Runs and Sessions lists' alike: its change linking to the change's page and its
 * goal's name, each left out without one. */
export const CHANGE_FACTS: ListFact<Partial<Pick<RunRow, 'change' | 'goal'>>>[] = [
  ['Change', (u) => (u.change ? <ChangeLink changeKey={u.change.key} title={u.change.title} /> : null)],
  ['Goal', (u) => u.goal?.name ?? null],
];

const COLUMNS: ListColumn<ListedRun>[] = [
  {
    id: 'run',
    header: 'Run',
    wide: true,
    names: true,
    value: (r) => runName(r.headline, r.branch),
    cell: (r) => (
      <>
        <RunLink runKey={r.key} branch={r.branch} title={r.headline} />
        {r.beforeSteps && <span className="ml-2 text-xs font-normal text-muted-foreground">before steps</span>}
      </>
    ),
  },
  { id: 'project', header: 'Project', fold: true, value: (r) => r.project, cell: (r) => <Text value={r.project} /> },
  { id: 'path', header: 'Path', fold: true, value: (r) => pathLabel(r.path), cell: (r) => <Text value={pathLabel(r.path)} /> },
  {
    id: 'finished',
    header: 'Finished',
    fold: true,
    value: (r) => (r.finishedAt === null ? null : parseTime(r.finishedAt).getTime()),
    cell: (r) => (r.finishedAt === null ? <Text value={null} /> : <Time iso={r.finishedAt} />),
  },
  { id: 'found', header: 'Found', num: true, value: foundFindings, cell: (r) => <Num value={foundFindings(r)} /> },
  {
    id: 'cost',
    header: 'Est. cost ($)',
    num: true,
    fold: true,
    value: (r) => r.cost,
    cell: (r) => <Num value={r.cost} format={formatDollars} />,
  },
  { id: 'warnings', header: 'Warnings', num: true, value: (r) => r.warnings, cell: (r) => <Num value={r.warnings} /> },
];

/** A count of the opened row, left out when not known. */
const known = (value: number | null) => (value === null ? null : <Num value={value} />);

const BRANCH: ListFact<ListedRun> = ['Branch', (r) => r.branch];
const COUNTS: ListFact<ListedRun>[] = [
  ['Time (min)', (r) => known(r.minutes)],
  ['Tasks', (r) => known(r.tasks)],
];
const CLOSED: ListFact<ListedRun> = ['Closed findings', (r) => known(closedFindings(r))];

const FACTS: ListFact<ListedRun>[] = [
  ...CHANGE_FACTS,
  BRANCH,
  ...COUNTS,
  ['Waves', (r) => known(r.tasks === null ? null : r.waves)],
  CLOSED,
  ['Stops', (r) => known(r.stops)],
];
/** A change's runs: no change, goal, waves or stops. */
const CHANGE_RUN_FACTS: ListFact<ListedRun>[] = [BRANCH, ...COUNTS, CLOSED];

/** The Runs list: newest first as the API gives them, its title (else its branch) linking to its page, a row opening
 * to its change, goal, branch and other counts; one value per cell, the unit in the header. With `of`, the runs of one
 * change (a change's page): no Warnings column, no change, goal, waves or stops, and Project and Path only as `of` asks
 * (several projects, a plan record). */
export function RunsTable({ runs, of }: { runs: ListedRun[]; of?: { project: boolean; path: boolean } }) {
  const all = !of;
  const project = of?.project ?? true;
  const path = of?.path ?? true;
  const columns = useMemo(
    () =>
      COLUMNS.filter(
        (c) => (c.id !== 'project' || project) && (c.id !== 'path' || path) && (c.id !== 'warnings' || all),
      ),
    [project, path, all],
  );
  return (
    <DataList
      rows={runs}
      rowKey={(r) => r.key}
      name={(r) => runName(r.headline, r.branch) ?? 'no branch'}
      columns={columns}
      facts={all ? FACTS : CHANGE_RUN_FACTS}
      label="Runs table"
      empty={
        all
          ? 'No runs in this period. A run shows here once its record is written and imported.'
          : 'No runs yet. A run shows here once its record is written and imported.'
      }
    />
  );
}
