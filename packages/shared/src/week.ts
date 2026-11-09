const HOUR = 60 * 60 * 1000;
// An ISO time's zone at its end: Z or an offset.
const ZONE = /(Z|[+-]\d{2}(:?\d{2})?)$/i;

/** A reporter time: an ISO time with no zone is UTC, as in the reporter's parse_time (`new Date` takes it as local). */
export function parseTime(iso: string): Date {
  return new Date(iso.includes('T') && !ZONE.test(iso) ? `${iso}Z` : iso);
}

/** The start of the week holding t: weeks run from Sunday 07:00 UTC, as in the reporter's week_start. */
export function weekStart(t: Date): Date {
  const shifted = new Date(t.getTime() - 7 * HOUR);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - shifted.getUTCDay(), 7),
  );
}

/** A time's week, named by the date its week starts, as the reporter's totals.weeks[].week. */
export function weekOf(t: Date): string {
  return weekStart(t).toISOString().slice(0, 10);
}
