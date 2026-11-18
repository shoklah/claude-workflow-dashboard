import type { AccountResponse } from '@cwd/shared';

/** The caller's account: its login and times, whether a machine (a stored cursor) feeds it, its collector tokens' ids
 * and times, never a token or its hash, and its viewers' logins. */
export function accountView(
  account: { login: string; createdAt: Date; lastCollectAt: Date | null },
  tokens: { id: number; createdAt: Date; lastUsedAt: Date | null }[],
  machine: boolean,
  viewers: string[],
): AccountResponse {
  return {
    login: account.login,
    createdAt: account.createdAt.toISOString(),
    lastCollectAt: account.lastCollectAt?.toISOString() ?? null,
    machine,
    tokens: tokens.map((token) => ({
      id: token.id,
      createdAt: token.createdAt.toISOString(),
      lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    })),
    viewers,
  };
}
