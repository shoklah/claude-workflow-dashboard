import { createHash } from 'node:crypto';
import type { RunEntry, SessionEntry } from './report.ts';

/** The first 16 hex characters of the text's SHA-256: a key that holds no path, for URLs and API responses. */
function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 16);
}

/** A run's key, from its record's date, project and branch (absent ones as empty); null when it has no date. */
export function runKey(run: RunEntry): string | null {
  const record = run.record;
  if (!record?.date) return null;
  return hash(`${record.date}|${record.project ?? ''}|${record.branch ?? ''}`);
}

/** A session's key, from its transcript file. */
export function sessionKey(s: SessionEntry): string {
  return hash(s.file);
}
