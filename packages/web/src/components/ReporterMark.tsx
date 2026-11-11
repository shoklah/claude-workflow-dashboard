import { reporterMark } from '../lib/format.ts';
import { Badge } from './ui/badge.tsx';

/** The dashed mark on a figure from the latest export's totals, not summed over the period; `mark` gives its text and
 * tooltip, `reporterMark` by default. */
export function ReporterMark({ mark = reporterMark }: { mark?: { text: string; tooltip: string } }) {
  return (
    <Badge variant="outline" className="ml-2 border-dashed font-normal" title={mark.tooltip}>
      {mark.text}
    </Badge>
  );
}
