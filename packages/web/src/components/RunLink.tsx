import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { Text } from './Num.tsx';
import { LINK } from './Panel.tsx';

/** A run's link to its page, named by its branch ("no branch" read out without one). */
export function RunLink({ runKey, branch, className }: { runKey: string; branch: string | null | undefined; className?: string }) {
  return (
    <Link to="/runs/$key" params={{ key: runKey }} className={cn(LINK, className)}>
      <Text value={branch} unknown="no branch" />
    </Link>
  );
}
