import type { ReactNode } from 'react';
import { cn } from 'cn';
import { parseTime, type StatusResponse } from '@cwd/shared';
import { formatDayTime, NOTICE } from '../lib/format.ts';

/** A day and time as "Nov 12, 10:20" (`en-US`, 24-hour, in the reader's time zone), its ISO value in `datetime`. */
export function Time({ iso }: { iso: string }) {
  return <time dateTime={iso}>{formatDayTime(parseTime(iso))}</time>;
}

/** A notice above the page, read out when it appears. */
export function Banner({ children }: { children: ReactNode }) {
  return (
    <div role="status" className={cn('px-3 py-2', NOTICE)}>
      {children}
    </div>
  );
}

/** Says why the data may be stale: the last attempt failed (with its error), or nothing has been imported yet. */
export function StatusBanner({ status }: { status: StatusResponse }) {
  const failed = status.error !== null && status.lastImportAt !== null;
  if (!failed && status.lastGoodImportAt !== null) return null;
  return (
    <Banner>
      {failed && (
        <>
          The last import failed at <Time iso={status.lastImportAt!} />: {status.error}.{' '}
        </>
      )}
      {status.lastGoodImportAt === null ? (
        'Nothing has been imported yet.'
      ) : (
        <>
          The data is from the last good import, at <Time iso={status.lastGoodImportAt} />.
        </>
      )}
    </Banner>
  );
}
