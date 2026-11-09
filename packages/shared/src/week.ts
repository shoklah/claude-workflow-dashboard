const HOUR = 60 * 60 * 1000;

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
