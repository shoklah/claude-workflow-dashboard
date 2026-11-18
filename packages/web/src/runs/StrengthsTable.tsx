import { useMemo } from 'react';
import type { StrengthRow } from '@cwd/shared';
import { DataList, type ListColumn, type ListFact } from '../components/DataList.tsx';
import { Text } from '../components/Num.tsx';
import { STEP_LABELS, STRENGTHS_SIDE, categoryLabel, taskLabel } from '../lib/format.ts';

type Row = StrengthRow & { id: string };

const FACTS: ListFact<Row>[] = [
  ['Step', (s) => STEP_LABELS[s.step]],
  ['Task', taskLabel],
];

const columnsOf = (categoryLabels: Record<string, string>): ListColumn<Row>[] => [
  { id: 'id', header: '#', value: (s) => s.id, text: (s) => s.id, cell: (s) => s.id },
  { id: 'summary', header: 'Summary', wide: true, value: (s) => s.summary, cell: (s) => <Text value={s.summary} /> },
  {
    id: 'category',
    header: 'Category',
    value: (s) => categoryLabel(s.category, categoryLabels),
    cell: (s) => categoryLabel(s.category, categoryLabels),
  },
];

/**
 * The reviewers' strengths, numbered by the run page: each one's id (its toggle), summary and category (named by
 * `categoryLabels`) at first glance, its step and task in its opened row, the reporter's only facts about a strength,
 * or one row saying there is none. The container carries the strengths' green side.
 */
export function StrengthsTable({
  strengths,
  categoryLabels,
}: {
  strengths: Row[];
  categoryLabels: Record<string, string>;
}) {
  const columns = useMemo(() => columnsOf(categoryLabels), [categoryLabels]);
  return (
    <DataList
      rows={strengths}
      rowKey={(s) => s.id}
      name={(s) => s.id}
      columns={columns}
      facts={FACTS}
      label="Strengths table"
      empty="No strengths."
      className={STRENGTHS_SIDE}
    />
  );
}
