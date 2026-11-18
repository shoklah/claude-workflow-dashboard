import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { Text } from './Num.tsx';
import { LINK } from './Panel.tsx';

/** A run's name: its title, else its branch; null without either. */
export function runName(title: string | null | undefined, branch: string | null | undefined): string | null {
  return title || branch || null;
}

/** What a run's link reads without a title or a branch. */
const NO_BRANCH = 'no branch';

/** A run's name as a label (a list row's name), `runName` else what its link reads without one. */
export function runLabel(title: string | null | undefined, branch: string | null | undefined): string {
  return runName(title, branch) ?? NO_BRANCH;
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
      <Text value={runName(title, branch)} unknown={NO_BRANCH} />
    </Link>
  );
}
