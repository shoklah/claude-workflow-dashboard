import { Link } from '@tanstack/react-router';
import { cn } from 'cn';
import { sessionName } from '../lib/format.ts';
import { LINK } from './Panel.tsx';

/** A session's link, to it alone in the Sessions view, named by its title ("no title", muted, without one). */
export function SessionLink({ sessionKey, title, className }: { sessionKey: string; title: string | null; className?: string }) {
  return (
    <Link
      to="/work"
      search={{ view: 'sessions', session: sessionKey }}
      className={cn(LINK, !title && 'font-normal text-muted-foreground', className)}
    >
      {sessionName(title)}
    </Link>
  );
}
