import { reporterMark } from '../lib/format.ts';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip.tsx';

/** The mark on a figure from the latest export's totals, not summed over the period: muted small text with a dotted
 * underline, titled by its tooltip on hover and focus; `mark` gives its text and tooltip, `reporterMark` by default. */
export function ReporterMark({ mark = reporterMark }: { mark?: { text: string; tooltip: string } }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="ml-2 rounded-sm text-xs text-muted-foreground underline decoration-dotted underline-offset-4">
          {mark.text}
        </span>
      </TooltipTrigger>
      <TooltipContent>{mark.tooltip}</TooltipContent>
    </Tooltip>
  );
}
