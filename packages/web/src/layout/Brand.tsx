import { Link } from '@tanstack/react-router';
import { cn } from 'cn';

const LOOK = 'flex items-center gap-2.5 px-3 pt-1 pb-2';

/** The app's name and mark: an outline eye in the current ink, its pupil two of the backdrop's orbs (docs/design/2026-11-17-menu/mark.svg).
 * With `home` (the rail, the Menu dialog), it is one link to Home, `onNavigate` called on a click; the sign-in page draws it plain. */
export function Brand({ home, onNavigate }: { home?: boolean; onNavigate?: () => void }) {
  const mark = (
    <>
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <path
          d="M2 12c2.6-4.6 6-7 10-7s7.4 2.4 10 7c-2.6 4.6-6 7-10 7s-7.4-2.4-10-7z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="10.6" cy="11" r="3.6" className="fill-mark-pink" />
        <circle cx="13.4" cy="13" r="3.6" className="fill-mark-teal" opacity=".9" />
      </svg>
      <span className="text-xl font-light tracking-tight">
        ed<b className="font-bold">ward</b>
      </span>
    </>
  );
  if (!home) return <div className={LOOK}>{mark}</div>;
  return (
    <Link to="/" aria-label="edward, Home" onClick={onNavigate} className={cn(LOOK, 'self-start rounded-control')}>
      {mark}
    </Link>
  );
}
