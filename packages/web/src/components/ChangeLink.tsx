import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { Text } from './Num.tsx';
import { LINK } from './Panel.tsx';

/** A change's link to its page, named by its title ("no branch" read out without one, as RunLink's). */
export function ChangeLink({ changeKey, title, className }: { changeKey: string; title: string; className?: string }) {
  return (
    <Link to="/work/changes/$key" params={{ key: changeKey }} className={cn(LINK, className)}>
      <Text value={title} unknown="no branch" />
    </Link>
  );
}
