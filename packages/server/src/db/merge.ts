function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type Whole = { [key: string]: true | Whole };

// The reporter's sparse count maps, a unit's and its advisor's: a key a new version lacks no longer counts (its rows
// moved to another unit), so a non-null map replaces the stored one whole.
const COUNT_MAPS: Whole = {
  refusals: true,
  models: true,
  efforts: true,
  notes: true,
  advisor: { tokens: true, by_role: true, failed: true, weeks: true },
};

/**
 * The known facts after a new export: a null or missing value in `next` keeps the value in `prev`, since the
 * reporter's null means it couldn't read the fact, not that the fact changed. Objects merge key by key, but the
 * count maps in `COUNT_MAPS` and any other non-null value in `next`, arrays included, replace.
 */
export function mergeKnown(prev: unknown, next: unknown): unknown {
  return merge(prev, next, COUNT_MAPS);
}

function merge(prev: unknown, next: unknown, whole: Whole | true): unknown {
  if (next === null || next === undefined) return prev ?? next;
  if (whole === true || !isObject(prev) || !isObject(next)) return next;
  const out: Record<string, unknown> = { ...prev };
  for (const [key, value] of Object.entries(next)) out[key] = merge(prev[key], value, whole[key] ?? {});
  return out;
}
