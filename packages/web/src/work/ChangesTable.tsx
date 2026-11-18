import { useMemo } from 'react';
import { parseTime, type ChangeRow } from '@cwd/shared';
import { ChangeLink } from '../components/ChangeLink.tsx';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Num, Unknown } from '../components/Num.tsx';
import { Term } from '../components/Panel.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import {
  STAGE_LABELS,
  formatDollars,
  otherCountLabel,
  otherProjectsLabel,
  pathLabel,
  projectLabel,
} from '../lib/format.ts';

/** The minimum widths lists line up by, the one above the other: a goal's page's Changes and Sessions (Stage over Step,
 * Last activity over Started, Findings over Length; the cost columns already match), and Work's goal sections' Changes
 * (Project too, its cell wrapping a longer name and its "+N"). */
export const ALIGNED = { project: 'min-w-36', stage: 'min-w-29', time: 'min-w-28', count: 'min-w-22' };

const COLUMNS: ListColumn<ChangeRow>[] = [
  {
    id: 'change',
    header: 'Change',
    wide: true,
    names: true,
    value: (c) => c.title || null,
    cell: (c) => <ChangeLink changeKey={c.key} title={c.title} />,
  },
  {
    id: 'project',
    header: 'Project',
    fold: true,
    width: ALIGNED.project,
    value: (c) => projectLabel(c.project),
    // Wraps, so a long name keeps the column at its aligned width.
    cell: (c) => (
      <span className="whitespace-normal wrap-anywhere">
        {projectLabel(c.project)}
        {c.otherCount > 0 && (
          <Term tip={otherProjectsLabel(c.otherProjects, c.otherCount)} className="ml-2">
            {otherCountLabel(c.otherCount)}
          </Term>
        )}
      </span>
    ),
  },
  { id: 'path', header: 'Path', fold: true, value: (c) => pathLabel(c.path), cell: (c) => pathLabel(c.path) },
  { id: 'stage', header: 'Stage', width: ALIGNED.stage, value: (c) => STAGE_LABELS[c.stage], cell: (c) => STAGE_LABELS[c.stage] },
  {
    id: 'activity',
    header: 'Last activity',
    fold: true,
    width: ALIGNED.time,
    value: (c) => (c.lastActivity === null ? null : parseTime(c.lastActivity).getTime()),
    cell: (c) => (c.lastActivity ? <Time iso={c.lastActivity} /> : <Unknown />),
  },
  { id: 'findings', header: 'Findings', num: true, width: ALIGNED.count, value: (c) => c.findings, cell: (c) => <Num value={c.findings} /> },
  {
    id: 'cost',
    header: 'Est. cost ($)',
    num: true,
    fold: true,
    value: (c) => c.cost,
    cell: (c) => <Num value={c.cost} format={formatDollars} />,
  },
];

const FACTS: ListFact<ChangeRow>[] = [
  ['Runs', (c) => <Num value={c.runs} />],
  ['Sessions', (c) => <Num value={c.sessions} />],
];

/** A list of changes, as the API orders them, in a region named `label`: each title linking to its change's page, then
 * (with `project`) its home project with "+N" for its other projects, its path, stage, last activity, findings and cost,
 * a row opening to its runs and sessions; every number a whole change's. */
export function ChangesTable({ rows, project, label }: { rows: ChangeRow[]; project: boolean; label: string }) {
  const columns = useMemo(() => (project ? COLUMNS : COLUMNS.filter((c) => c.id !== 'project')), [project]);
  return (
    <DataList
      rows={rows}
      rowKey={(c) => c.key}
      name={(c) => c.title || 'no branch'}
      columns={columns}
      facts={FACTS}
      label={label}
      empty="No changes in this period."
    />
  );
}
