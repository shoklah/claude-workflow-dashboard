import { cn } from 'cn';
import { SHARE_FILL, SHARE_TRACK, formatShare } from '../lib/format.ts';

/** A share as a one-hue meter, its whole percent written beside it; an unknown share an empty bar and a dash. */
export function ShareBar({ share }: { share: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden className={cn('h-2 w-32', SHARE_TRACK)}>
        <div className={cn('h-2 rounded-r', SHARE_FILL)} style={{ width: `${share ?? 0}%` }} />
      </div>
      <span>{formatShare(share)}</span>
    </div>
  );
}
