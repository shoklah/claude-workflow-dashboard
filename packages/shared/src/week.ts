const HOUR = 60 * 60 * 1000;

/** The start of the week holding t: weeks run from Sunday 07:00 UTC, as in the reporter's week_start. */
export function weekStart(t: Date): Date {
  const shifted = new Date(t.getTime() - 7 * HOUR);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - shifted.getUTCDay(), 7),
  );
}
