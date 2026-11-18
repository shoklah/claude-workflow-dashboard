import { useState } from 'react';
import type { AccountResponse } from '@cwd/shared';
import { addViewer, removeViewer } from '../api.ts';
import { EmptyRow } from '../components/Num.tsx';
import { ColumnHead, Line, Panel, ScrollTable, State } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { useSend } from './send.ts';

const COLUMN_COUNT = 2;

/**
 * Who may view the account: what a viewer sees, the GitHub logins granted with a Remove each, and a login field with
 * "Add viewer". While a call runs every action is disabled, and a failed one says so in fixed words.
 */
export function ViewersPanel({ account }: { account: AccountResponse }) {
  const [login, setLogin] = useState('');
  const { pending, failed, send } = useSend();

  async function add() {
    if (await send(() => addViewer(login.trim()), "Couldn't add the viewer. Check the login and try again.")) setLogin('');
  }

  return (
    <Panel title="Viewers">
      <Line muted>Viewers see the projects you show. Totals and charts count every project, without its name.</Line>
      <ScrollTable label="Viewers">
        <thead>
          <tr>
            <ColumnHead>GitHub login</ColumnHead>
            <ColumnHead>
              <span className="sr-only">Remove</span>
            </ColumnHead>
          </tr>
        </thead>
        <tbody>
          {account.viewers.length === 0 ? (
            <EmptyRow columns={COLUMN_COUNT}>No viewers.</EmptyRow>
          ) : (
            account.viewers.map((viewer) => (
              <tr key={viewer} className="border-t hover:bg-muted/50">
                <td className="px-2 py-1.5">{viewer}</td>
                <td className="px-2 py-1.5 text-right">
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={pending}
                    onClick={() => send(() => removeViewer(viewer), "Couldn't remove the viewer. Try again.")}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </ScrollTable>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input
          aria-label="GitHub login"
          placeholder="GitHub login"
          autoComplete="off"
          required
          className="w-48"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />
        <Button type="submit" disabled={pending}>
          Add viewer
        </Button>
      </form>
      {failed && <State error>{failed}</State>}
    </Panel>
  );
}
