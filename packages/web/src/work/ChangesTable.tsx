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

const COLUMNS: ListColumn<ChangeRow>[] = [
  {
    id: 'change',
    header: 'Change',
    wide: true,
    names: true,
    value: (c) => c.title,
    // A title of one long word (a branch) breaks inside it rather than widen a narrow list.
    cell: (c) => <ChangeLink changeKey={c.key} title={c.title} className="wrap-anywhere" />,
  },
  {
    id: 'project',
    header: 'Project',
    fold: true,
    value: (c) => projectLabel(c.project),
    cell: (c) => (
      <>
        {projectLabel(c.project)}
        {c.otherCount > 0 && (
          <Term tip={otherProjectsLabel(c.otherProjects, c.otherCount)} className="ml-2">
            {otherCountLabel(c.otherCount)}
          </Term>
        )}
      </>
    ),
  },
  { id: 'path', header: 'Path', fold: true, value: (c) => pathLabel(c.path), cell: (c) => pathLabel(c.path) },
  { id: 'stage', header: 'Stage', value: (c) => STAGE_LABELS[c.stage], cell: (c) => STAGE_LABELS[c.stage] },
  {
    id: 'activity',
    header: 'Last activity',
    fold: true,
    value: (c) => (c.lastActivity === null ? null : parseTime(c.lastActivity).getTime()),
    cell: (c) => (c.lastActivity ? <Time iso={c.lastActivity} /> : <Unknown />),
  },
  { id: 'findings', header: 'Findings', num: true, value: (c) => c.findings, cell: (c) => <Num value={c.findings} /> },
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
      name={(c) => c.title}
      columns={columns}
      facts={FACTS}
      label={label}
      empty="No changes in this period."
    />
  );
}
