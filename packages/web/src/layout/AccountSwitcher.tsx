import { useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import { useStatus, view } from '../api.ts';

/** Hosted mode's choice of dashboard: "Yours", then each account the caller may view, read-only; nothing while there is
 * none to view, in local mode or while the status loads. With `muted` (the rail's foot), its label takes the rail's
 * muted ink; else primary ink, on the backdrop. `className` is what a call site adds (the rail's inset). */
export function AccountSwitcher({ muted, className }: { muted?: boolean; className?: string }) {
  const account = useStatus().data?.account;
  const queryClient = useQueryClient();
  if (!account || account.viewable.length === 0) return null;

  // Every response is the chosen account's, so every page's cached data is dropped and read again, as showing mode does.
  async function choose(login: string) {
    await view(login || null);
    await queryClient.resetQueries();
  }
  return (
    <label className={cn('flex flex-col gap-1 text-sm', className)}>
      <span className={cn('text-xs font-medium', muted && 'text-muted-foreground')}>Dashboard</span>
      <select value={account.viewing ?? ''} onChange={(e) => choose(e.target.value)}>
        <option value="">Yours</option>
        {account.viewable.map((login) => (
          <option key={login} value={login}>
            {login}
          </option>
        ))}
      </select>
    </label>
  );
}
