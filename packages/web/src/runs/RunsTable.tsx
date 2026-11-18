import { parseTime, type RunRow } from '@cwd/shared';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Num, Text } from '../components/Num.tsx';
import { RunLink, runName } from '../components/RunLink.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { closedFindings, formatDollars, foundFindings, pathLabel } from '../lib/format.ts';

const COLUMNS: ListColumn<RunRow>[] = [
  {
    id: 'branch',
    header: 'Branch',
    wide: true,
    names: true,
    value: (r) => r.branch,
    cell: (r) => (
      <>
        <RunLink runKey={r.key} branch={r.branch} />
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

const FACTS: ListFact<RunRow>[] = [
  ['Time (min)', (r) => known(r.minutes)],
  ['Tasks', (r) => known(r.tasks)],
  ['Waves', (r) => known(r.tasks === null ? null : r.waves)],
  ['Closed findings', (r) => known(closedFindings(r))],
  ['Stops', (r) => known(r.stops)],
];

/** The Runs list: newest first as the API gives them, its branch linking to its page, a row opening to its other
 * counts; one value per cell, the unit in the header. */
export function RunsTable({ runs }: { runs: RunRow[] }) {
  return (
    <DataList
      rows={runs}
      rowKey={(r) => r.key}
      name={(r) => runName(r.branch)}
      columns={COLUMNS}
      facts={FACTS}
      label="Runs table"
      empty="No runs in this period. A run shows here once its record is written and imported."
    />
  );
}
