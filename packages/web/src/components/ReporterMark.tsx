import { reporterMark } from '../lib/format.ts';
import { Badge } from './ui/badge.tsx';

/** The dashed mark on a figure from the latest export's totals, not summed over the period. */
export function ReporterMark() {
  return (
    <Badge variant="outline" className="ml-2 border-dashed font-normal" title={reporterMark.tooltip}>
      {reporterMark.text}
    </Badge>
  );
}
