import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import type { AccountResponse } from '@cwd/shared';
import { createToken, resetCollector, revokeToken } from '../api.ts';
import { EmptyRow } from '../components/Num.tsx';
import { ColumnHead, Pairs, Panel, ScrollTable, State } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx';
import { Time } from '../layout/StatusBanner.tsx';

const COLUMN_COUNT = 3;

/**
 * The collector's facts (its last collect, whether a machine feeds the account), its tokens with a Revoke each, Create
 * token and, while a machine is set, Reset collector. A new token shows once, in a dialog, as the collector's `.env`
 * line; it leaves the page when the dialog closes. While a call runs every action is disabled, and a failed one says so
 * in fixed words.
 */
export function CollectorPanel({ account }: { account: AccountResponse }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // Each POST changes the account, so its data is read again; its failure shows as `failure`, never the error's text.
  async function send(post: () => Promise<void>, failure: string) {
    setPending(true);
    setFailed(null);
    try {
      await post();
      await queryClient.invalidateQueries({ queryKey: ['/api/account'] });
    } catch {
      setFailed(failure);
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel title="Collector">
      <Pairs
        pairs={[
          ['Last collect', account.lastCollectAt ? <Time iso={account.lastCollectAt} /> : 'Never'],
          ['Machine', account.machine ? 'Set by the first collect' : 'None yet'],
        ]}
      />
      <ScrollTable label="Collector tokens">
        <thead>
          <tr>
            <ColumnHead>Created</ColumnHead>
            <ColumnHead>Last used</ColumnHead>
            <ColumnHead>
              <span className="sr-only">Revoke</span>
            </ColumnHead>
          </tr>
        </thead>
        <tbody>
          {account.tokens.length === 0 ? (
            <EmptyRow columns={COLUMN_COUNT}>No tokens. Create one for your collector.</EmptyRow>
          ) : (
            account.tokens.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/50">
                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">
                  <Time iso={t.createdAt} />
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap tabular-nums">
                  {t.lastUsedAt ? <Time iso={t.lastUsedAt} /> : <span className="text-muted-foreground">Never</span>}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <Button
                    variant="outline"
                    size="xs"
                    disabled={pending}
                    onClick={() => send(() => revokeToken(t.id), "Couldn't revoke the token. Try again.")}
                  >
                    Revoke
                  </Button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </ScrollTable>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() =>
            send(async () => setToken((await createToken()).token), "Couldn't create a token. Try again.")
          }
        >
          Create token
        </Button>
        {account.machine && (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => send(resetCollector, "Couldn't reset the collector. Try again.")}
          >
            Reset collector
          </Button>
        )}
      </div>
      {failed && <State error>{failed}</State>}
      <Dialog open={token !== null} onOpenChange={(open) => !open && setToken(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collector token</DialogTitle>
            <DialogDescription>Copy it now: it isn't shown again. Put it in the collector's .env.</DialogDescription>
          </DialogHeader>
          {token && <code className="rounded-md border bg-muted px-3 py-2 text-sm break-all">EDWARD_TOKEN={token}</code>}
          <DialogFooter>
            <Button variant="outline" onClick={() => navigator.clipboard.writeText(`EDWARD_TOKEN=${token}`)}>
              <Copy aria-hidden />
              Copy
            </Button>
            <DialogClose asChild>
              <Button>Done</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Panel>
  );
}
