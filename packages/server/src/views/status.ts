import type { StatusResponse } from '@cwd/shared';
import { trimPaths } from '../text.ts';
import { maskText, type Scope } from './scope.ts';

/** The import's status: the last import's error with its paths trimmed, and with a scope masked (maskText), and the
 * caller's account (null in local mode). */
export function statusView(
  last: { at: Date; error: string | null } | null,
  lastGood: { at: Date } | null,
  importing: boolean,
  scope: Scope | null,
  account: StatusResponse['account'],
): StatusResponse {
  return {
    lastImportAt: last?.at.toISOString() ?? null,
    lastGoodImportAt: lastGood?.at.toISOString() ?? null,
    error: last?.error ? (scope ? maskText(scope, last.error) : trimPaths(last.error)) : null,
    importing,
    account,
  };
}
