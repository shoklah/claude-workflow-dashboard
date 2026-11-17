import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { LINK } from './Panel.tsx';

/** A change's link to its page, named by its title. */
export function ChangeLink({ changeKey, title, className }: { changeKey: string; title: string; className?: string }) {
  return (
    <Link to="/work/changes/$key" params={{ key: changeKey }} className={cn(LINK, className)}>
      {title}
    </Link>
  );
}
