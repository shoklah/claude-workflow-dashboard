import { Link } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useStatus } from '../api.ts';
import { CURRENT, ENTRY } from '../lib/format.ts';

/** Hosted mode's signed-in login, a link to the Account page in the menu entry's look; nothing in local mode or while
 * the status loads. `onNavigate` runs when it is followed. */
export function AccountLinks({ onNavigate }: { onNavigate?: () => void }) {
  const account = useStatus().data?.account;
  if (!account) return null;
  return (
    <nav aria-label="Account" className="flex flex-col gap-1">
      <Link to="/account" onClick={onNavigate} className={ENTRY} activeProps={{ className: CURRENT }}>
        <UserRound className="size-4 flex-none" aria-hidden />
        {account.login}
      </Link>
    </nav>
  );
}
