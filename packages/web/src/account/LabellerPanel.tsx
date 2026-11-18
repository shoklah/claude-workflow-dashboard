import { useId, useState } from 'react';
import {
  LABELLER_MAX_DAILY,
  LABELLER_MODELS,
  type AccountResponse,
  type LabellerModel,
  type LabellerRequest,
} from '@cwd/shared';
import { saveLabeller } from '../api.ts';
import { Line, Panel, State } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { modelLabel } from '../lib/format.ts';
import { useSend } from './send.ts';

const LABEL = 'text-muted-foreground';

/**
 * The account's labeller: its Anthropic key, shown only as "Set" with Replace and Remove, or a password field when none
 * is set (or while replacing); its model and daily max; Save. A typed key lives only in this panel's state and leaves
 * it, the field's value included, as soon as Save sends it, trimmed (one of only spaces isn't sent). Remove sends the
 * saved model and daily max, never the form's unsaved ones.
 */
export function LabellerPanel({ account }: { account: AccountResponse }) {
  const { labeller } = account;
  const [key, setKey] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [model, setModel] = useState(labeller.model);
  const [dailyMax, setDailyMax] = useState(String(labeller.dailyMax));
  const { pending, failed, send } = useSend();
  const keyId = useId();
  const modelId = useId();
  const maxId = useId();

  function save(request: LabellerRequest) {
    setKey('');
    setReplacing(false);
    send(() => saveLabeller(request), "Couldn't save the labeller. Try again.");
  }

  return (
    <Panel title="Labeller">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          save({ key: key.trim() || undefined, model, dailyMax: Number(dailyMax) });
        }}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center justify-items-start gap-x-4 gap-y-3 text-sm">
          {labeller.keySet && !replacing ? (
            <>
              <span className={LABEL}>Anthropic key</span>
              <div className="flex flex-wrap items-center gap-2">
                <span>Set</span>
                <Button type="button" variant="outline" size="xs" disabled={pending} onClick={() => setReplacing(true)}>
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={pending}
                  onClick={() =>
                    save({ key: null, model: labeller.model, dailyMax: labeller.dailyMax })
                  }
                >
                  Remove
                </Button>
              </div>
            </>
          ) : (
            <>
              <label htmlFor={keyId} className={LABEL}>
                Anthropic key
              </label>
              <Input
                id={keyId}
                type="password"
                autoComplete="off"
                placeholder="sk-ant-…"
                className="max-w-64"
                value={key}
                onChange={(e) => setKey(e.target.value)}
              />
            </>
          )}
          <label htmlFor={modelId} className={LABEL}>
            Model
          </label>
          <select id={modelId} value={model} onChange={(e) => setModel(e.target.value as LabellerModel)}>
            {LABELLER_MODELS.map((id) => (
              <option key={id} value={id}>
                {modelLabel(id)}
              </option>
            ))}
          </select>
          <label htmlFor={maxId} className={LABEL}>
            Daily max (findings)
          </label>
          <Input
            id={maxId}
            type="number"
            required
            min={1}
            max={LABELLER_MAX_DAILY}
            step={1}
            className="w-28 text-right tabular-nums"
            value={dailyMax}
            onChange={(e) => setDailyMax(e.target.value)}
          />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </div>
      </form>
      {!labeller.keySet && <Line muted>No key: findings stay unlabelled.</Line>}
      {failed && <State error>{failed}</State>}
    </Panel>
  );
}
