import type { ReactNode } from 'react';
import { cn } from 'cn';
import type { FindingRow, RunPageResponse } from '@cwd/shared';
import { Text } from '../components/Num.tsx';
import { Panel, TERM } from '../components/Panel.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { LATER_FIXES_TERM, outcomeLabel, outcomeWarns, WARNING_INK } from '../lib/format.ts';

// The outcomes a finding is left for later with: not fixed or applied, and not closed by a decision (ruled, declined).
const LEFT_FOR_LATER = new Set<string | null>(['deferred', 'to_owner', 'open', null]);

/** The later fixes' term: its words with a dotted underline, its tooltip saying what the reporter counts. */
export function LaterFixesTerm({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn('rounded-sm', TERM)}>
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{LATER_FIXES_TERM}</TooltipContent>
    </Tooltip>
  );
}

/**
 * What the run, or the selected `step`, left for later: its deferred, to-owner, open and no-outcome findings, each with
 * its reason and the unit it came from (`from`, null when none holds it), in a region that scrolls sideways; with no step selected, the run's later fixes under them.
 */
export function LeftForLater({
  findings,
  from,
  laterFixes,
  step,
  beforeSteps,
}: {
  findings: FindingRow[];
  from: (finding: FindingRow) => string | null;
  laterFixes: RunPageResponse['laterFixes'];
  step: string | null;
  beforeSteps: boolean;
}) {
  const title = step ? `Left for later in ${step}` : 'Left for later';
  const left = findings.filter((f) => LEFT_FOR_LATER.has(f.outcome));
  return (
    <Panel title={title}>
      {beforeSteps ? (
        <p className="text-sm text-muted-foreground">Recorded before findings were logged: this run has none to list.</p>
      ) : left.length === 0 ? (
        <p className="text-sm text-muted-foreground">{step ? `${step} left nothing for later.` : 'Nothing left: every finding was closed in this run.'}</p>
      ) : (
        <div data-scroll-cue className="overflow-x-auto" tabIndex={0} role="region" aria-label={`${title} table`}>
          <table aria-label={title} className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                {['Outcome', 'Finding', 'From'].map((column) => (
                  <th key={column} scope="col" className="px-2 py-1.5 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {left.map((f, i) => (
                <tr key={i} className="border-t align-top hover:bg-muted/50">
                  <td className={cn('px-2 py-1.5 whitespace-nowrap', outcomeWarns(f.outcome) && WARNING_INK)}>{outcomeLabel(f.outcome)}</td>
                  <td className="px-2 py-1.5">
                    <span className="flex flex-col gap-0.5">
                      <Text value={f.summary} />
                      {f.reason && <span className="text-muted-foreground">{f.reason}</span>}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <Text value={from(f)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!step && laterFixes.length > 0 && (
        <div className="flex flex-col gap-1.5 text-sm">
          <h3 className="font-semibold">
            <LaterFixesTerm>Later fixes</LaterFixesTerm>
          </h3>
          <ul className="flex flex-col gap-1">
            {laterFixes.map((fix, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-x-4">
                <span className="min-w-0 break-words">{fix.subject}</span>
                {fix.date && (
                  <span className="text-muted-foreground tabular-nums">
                    <Time iso={fix.date} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
