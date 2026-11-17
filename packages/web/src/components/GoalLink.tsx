import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { LINK } from './Panel.tsx';

/** A goal's link to its page, named by its name. */
export function GoalLink({ goalKey, name, className }: { goalKey: string; name: string; className?: string }) {
  return (
    <Link to="/work/goals/$key" params={{ key: goalKey }} className={cn(LINK, className)}>
      {name}
    </Link>
  );
}
