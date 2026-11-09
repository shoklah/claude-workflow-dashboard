function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The known facts after a new export: a null or missing value in `next` keeps the value in `prev`, since the
 * reporter's null means it couldn't read the fact, not that the fact changed. Objects merge key by key; any other
 * non-null value in `next`, arrays included, replaces.
 */
export function mergeKnown(prev: unknown, next: unknown): unknown {
  if (next === null || next === undefined) return prev ?? next;
  if (!isObject(prev) || !isObject(next)) return next;
  const out: Record<string, unknown> = { ...prev };
  for (const [key, value] of Object.entries(next)) out[key] = mergeKnown(prev[key], value);
  return out;
}
