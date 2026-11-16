import type { FindingsResponse } from '@cwd/shared';
import { Num } from '../components/Num.tsx';
import { Pairs, Panel } from '../components/Panel.tsx';

/** The period's relevance signals, each a sum over the stored runs, as labelled pairs; then the labeller's facts, or
 * the line that it is off. */
export function SignalsPanel({ signals, labeller }: Pick<FindingsResponse, 'signals' | 'labeller'>) {
  return (
    <Panel title="Relevance signals">
      <Pairs
        pairs={[
          ['Fix commits within 14 days after a run', <Num value={signals.laterFixes} />],
          ['Final review findings on runs whose task reviews came back clean', <Num value={signals.finalAfterClean} />],
          ['Fix-check verdicts of "fixed, not proportionate"', <Num value={signals.notProportionate} />],
          ['Findings declined or ruled', <Num value={signals.declinedOrRuled} />],
          ['Findings the session judged invalid', <Num value={signals.judgedInvalid} />],
        ]}
      />
      <div className="border-t pt-3">
        {labeller.on ? (
          <Pairs
            pairs={[
              ['Labelled by the app', <Num value={labeller.labelled} />],
              ['Waiting', <Num value={labeller.waiting} />],
              ['Labeller tokens this week', <Num value={labeller.tokensThisWeek.input + labeller.tokensThisWeek.output} />],
            ]}
          />
        ) : (
          <p className="text-sm text-muted-foreground">The labeller is off: the data folder's .env holds no API key.</p>
        )}
      </div>
    </Panel>
  );
}
