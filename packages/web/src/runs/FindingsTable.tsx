import { useMemo, useState, type ReactNode } from 'react';
import type { FindingItem, FindingRow, StepKind } from '@cwd/shared';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Text, Unknown } from '../components/Num.tsx';
import { Section, Term } from '../components/Panel.tsx';
import { RunLink, runName } from '../components/RunLink.tsx';
import { Verdict } from './StepDetail.tsx';
import {
  NONE,
  STEP_LABELS,
  appCallLabel,
  capitalize,
  categoryLabel,
  countName,
  outcomeLabel,
  taskLabel,
  verdictLabel,
} from '../lib/format.ts';

// A finding, and with `run` its run's key, project, branch and headline, as the Findings page lists them.
type Row = FindingRow & Partial<Pick<FindingItem, 'runKey' | 'project' | 'branch' | 'headline'>>;

/** The run column, on the Findings page only: it folds into the opened row while the list is narrow. */
const RUN_COLUMN: ListColumn<Row> = {
  id: 'run',
  header: 'Run',
  fold: true,
  names: true,
  value: (f) => runName(f.headline, f.branch),
  cell: (f) => <RunLink runKey={f.runKey ?? ''} branch={f.branch} title={f.headline ?? null} />,
};

/** The first glance: the finding's id (its toggle), summary, the app's call and the session's validity. */
const columnsOf = (labels: Record<string, string>): ListColumn<Row>[] => [
  { id: 'id', header: '#', value: (f) => f.id, text: (f) => f.id ?? NONE, cell: (f) => <Text value={f.id} /> },
  { id: 'summary', header: 'Summary', wide: true, value: (f) => f.summary, cell: (f) => <Text value={f.summary} /> },
  {
    id: 'app',
    header: 'App',
    value: (f) => (f.relevance === null ? null : appCallLabel(f, labels)),
    cell: (f) =>
      f.relevance === null ? (
        <Unknown label="no app label" />
      ) : (
        <Term tip={f.labelReason}>{capitalize(appCallLabel(f, labels))}</Term>
      ),
  },
  // The session's call, as the workflow records it.
  {
    id: 'validity',
    header: 'Valid',
    value: (f) => f.validity && countName(f.validity),
    cell: (f) => <Text value={f.validity && countName(f.validity)} />,
  },
];

/** The opened row's facts, one "Fix round N" per verdict of the finding with the most, then its project (the Findings page's rows only). */
const factsOf = (labels: Record<string, string>, rounds: number): ListFact<Row>[] => [
  ['Step', (f) => STEP_LABELS[f.step]],
  ['Task', taskLabel],
  ['Severity', (f) => f.severity && countName(f.severity)],
  ['Category', (f) => categoryLabel(f.category, labels)],
  ['Labelled by', (f) => (f.category === null ? null : f.judge === 'app' ? 'App' : 'Workflow')],
  ['Outcome', (f) => outcomeLabel(f.outcome)],
  ['Reason', (f) => f.reason],
  ...Array.from({ length: rounds }, (_, i): ListFact<Row> => [
    `Fix round ${i + 1}`,
    (f) => (i < f.verdicts.length ? <Verdict verdict={f.verdicts[i]}>{verdictLabel(f.verdicts[i])}</Verdict> : null),
  ]),
  ['Project', (f) => f.project ?? null],
];

// The filters: each lists the values its field holds, in order, labelled as the opened row shows them.
const FILTERS = [
  { id: 'step', label: 'Step', show: (v: string) => STEP_LABELS[v as StepKind] },
  { id: 'severity', label: 'Severity', show: countName },
  { id: 'outcome', label: 'Outcome', show: countName },
] as const;
type FilterId = (typeof FILTERS)[number]['id'];

/**
 * Every finding of the run in one list, filtered by step, severity and outcome: its id, summary, the app's call and
 * the validity at first glance, the rest in its opened row with its labels (the workflow's, which win, and the app's;
 * each category named by `categoryLabels`, the response's). With `run`, a first column links each finding to its run.
 * On the run page, `heading` is its title, starting the filter row and naming its `Section` as a region, `label` names
 * the list's region, `skip` leaves out filters and `containerClassName` adds to the container's classes (its coloured
 * side).
 */
export function FindingsTable({
  findings,
  categoryLabels,
  run,
  heading,
  label = 'Findings',
  skip = [],
  containerClassName,
}: {
  findings: Row[];
  categoryLabels: Record<string, string>;
  run?: boolean;
  heading?: ReactNode;
  label?: string;
  skip?: FilterId[];
  containerClassName?: string;
}) {
  const [chosen, setChosen] = useState<Partial<Record<FilterId, string>>>({});
  const rows = findings.filter((f) => FILTERS.every(({ id }) => !chosen[id] || f[id] === chosen[id]));
  const rounds = Math.max(0, ...findings.map((f) => f.verdicts.length));
  const columns = useMemo(() => [...(run ? [RUN_COLUMN] : []), ...columnsOf(categoryLabels)], [run, categoryLabels]);
  const filters = (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {FILTERS.filter((filter) => !skip.includes(filter.id)).map((filter) => {
        const values = [...new Set(findings.map((f) => f[filter.id]).filter((v) => v !== null))].sort();
        return (
          <label key={filter.id} className="flex items-center gap-1.5">
            {filter.label}
            <select
              value={chosen[filter.id] ?? ''}
              onChange={(e) => setChosen({ ...chosen, [filter.id]: e.target.value })}
            >
              <option value="">All</option>
              {values.map((value) => (
                <option key={value} value={value}>
                  {filter.show(value)}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
  return (
    <Section title={heading} aside={filters}>
      <DataList
        rows={rows}
        rowKey={(f) => `${f.runKey ?? ''}:${f.id ?? findings.indexOf(f)}`}
        name={(f) => f.id ?? NONE}
        columns={columns}
        facts={factsOf(categoryLabels, rounds)}
        label={label}
        empty={
          findings.length === 0 ? 'No findings.' : 'No findings match these filters. Set a filter back to All to see more.'
        }
        className={containerClassName}
      />
    </Section>
  );
}
