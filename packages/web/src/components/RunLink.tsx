import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { Text } from './Num.tsx';
import { LINK } from './Panel.tsx';

/** A run's name: its title, else its branch; null without either. */
export function runName(title: string | null | undefined, branch: string | null | undefined): string | null {
  return title || branch || null;
}

/** A run's link to its page, named by `runName` ("no branch" read out without a name). */
export function RunLink({
  runKey,
  branch,
  title,
  className,
}: {
  runKey: string;
  branch: string | null | undefined;
  title: string | null;
  className?: string;
}) {
  return (
    <Link to="/runs/$key" params={{ key: runKey }} className={cn(LINK, className)}>
      <Text value={runName(title, branch)} unknown="no branch" />
    </Link>
  );
}
