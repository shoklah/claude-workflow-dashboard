import type { ReactNode } from 'react';
import type { StatusResponse } from '@cwd/shared';

/** A time in the reader's locale and time zone, its ISO value in `datetime`. */
export function Time({ iso }: { iso: string }) {
  return <time dateTime={iso}>{new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>;
}

/** A notice above the page, read out when it appears. */
export function Banner({ children }: { children: ReactNode }) {
  return (
    <div role="status" className="rounded-md border border-amber-600/50 bg-amber-50 px-3 py-2 text-sm text-amber-950">
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
