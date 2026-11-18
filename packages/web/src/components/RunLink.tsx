import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { Unknown } from './Num.tsx';
import { LINK } from './Panel.tsx';

/** A run's name by its branch, "no branch" without one, as its link reads. */
export const runName = (branch: string | null | undefined): string => branch ?? 'no branch';

/** A run's link to its page, named by `runName` (without a branch, the muted dash read out as "no branch"). */
export function RunLink({ runKey, branch, className }: { runKey: string; branch: string | null | undefined; className?: string }) {
  const name = runName(branch);
  return (
    <Link to="/runs/$key" params={{ key: runKey }} className={cn(LINK, className)}>
      {branch ? name : <Unknown label={name} />}
    </Link>
  );
}
