import { createHash } from 'node:crypto';
import type { RunEntry, SessionEntry } from '@cwd/shared';

/** The first 16 hex characters of the text's SHA-256: a key that holds no path, for URLs and API responses. */
export function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/**
 * A run's key, from its record's date, project and branch (absent ones as empty); null when it has no date. The recipe
 * is pinned to the reporter's `key`, since an incremental export's `removed` keys are matched against stored keys.
 */
export function runKey(run: RunEntry): string | null {
  const record = run.record;
  if (!record?.date) return null;
  return hash(`${record.date}|${record.project ?? ''}|${record.branch ?? ''}`);
}

/** A session's key, from its transcript file; the recipe is pinned to the reporter's `key`, as `runKey`'s is. */
export function sessionKey(s: SessionEntry): string {
  return hash(s.file);
}

/** A project's key, from its root. */
export function projectKey(root: string): string {
  return hash(root);
}
