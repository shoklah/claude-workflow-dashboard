import type { FindingsResponse } from '@cwd/shared';
import { labellerLabel } from '../lib/format.ts';

const SIGNALS: [keyof FindingsResponse['signals'], string][] = [
  ['laterFixes', 'fix commits within 14 days after a run'],
  ['finalAfterClean', 'final-review findings on runs whose task reviews came back clean'],
  ['notProportionate', 'fix-check verdicts of "fixed, not proportionate"'],
  ['declinedOrRuled', 'findings declined or ruled'],
];

/** The period's relevance signals, each a sum over the stored runs, and the labeller's line. */
export function SignalsPanel({
  signals,
  labeller,
}: Pick<FindingsResponse, 'signals' | 'labeller'>) {
  return (
    <section aria-label="Relevance signals" className="flex flex-col gap-2 text-sm">
      <h2 className="font-semibold">Relevance signals</h2>
      {SIGNALS.map(([key, label]) => (
        <div key={key} role="group" aria-label={label} className="rounded-lg border bg-card px-3 py-2">
          <div className="text-lg font-semibold">{signals[key]}</div>
          {label}
        </div>
      ))}
      <p className="text-muted-foreground">{labellerLabel(labeller)}</p>
    </section>
  );
}
