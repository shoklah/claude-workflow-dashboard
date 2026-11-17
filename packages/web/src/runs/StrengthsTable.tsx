import type { StrengthRow } from '@cwd/shared';
import { Text } from '../components/Num.tsx';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table.tsx';
import { STEP_LABELS, STRENGTHS_SIDE, categoryLabel, taskLabel } from '../lib/format.ts';

/**
 * The reviewers' strengths, numbered by the run page: each one's step, task, category (named by `categoryLabels`) and
 * summary, the reporter's only facts about a strength. The container carries the strengths' green side.
 */
export function StrengthsTable({
  strengths,
  categoryLabels,
}: {
  strengths: (StrengthRow & { id: string })[];
  categoryLabels: Record<string, string>;
}) {
  return (
    // It scrolls sideways on a narrow screen, so its container is a named tab stop.
    <Table
      containerProps={{
        tabIndex: 0,
        role: 'region',
        'aria-label': 'Strengths table',
        className: STRENGTHS_SIDE,
      }}
    >
      <TableHeader>
        <TableRow>
          {/* The short columns take their content's width (cells don't wrap), so Summary takes the room. */}
          <TableHead className="w-0">#</TableHead>
          <TableHead className="w-0">Step</TableHead>
          <TableHead className="w-0">Task</TableHead>
          <TableHead className="w-0">Category</TableHead>
          <TableHead>Summary</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {strengths.map((strength) => (
          <TableRow key={strength.id}>
            <TableCell className="align-top">{strength.id}</TableCell>
            <TableCell className="align-top">{STEP_LABELS[strength.step]}</TableCell>
            <TableCell className="align-top">
              <Text value={taskLabel(strength)} unknown="no task" />
            </TableCell>
            <TableCell className="align-top">{categoryLabel(strength.category, categoryLabels)}</TableCell>
            <TableCell className="min-w-64 align-top whitespace-normal">
              <Text value={strength.summary} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
