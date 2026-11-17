import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { Text } from './Num.tsx';
import { LINK } from './Panel.tsx';

/** A run's link to its page, named by its title, else its branch ("no branch" read out without either). */
export function RunLink({
  runKey,
  branch,
  title,
  className,
}: {
  runKey: string;
  branch: string | null | undefined;
  title?: string | null;
  className?: string;
}) {
  return (
    <Link to="/runs/$key" params={{ key: runKey }} className={cn(LINK, className)}>
      <Text value={title || branch} unknown="no branch" />
    </Link>
  );
}
