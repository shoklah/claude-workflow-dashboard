import type { AdminResponse } from '@cwd/shared';

/** The admin page: the invites, each with whether an account holds its login, and every account with its times, never
 * anything of its tokens or sessions. */
export function adminView(
  invites: { login: string; addedAt: Date; signedIn: boolean }[],
  accounts: { id: number; login: string; createdAt: Date; lastCollectAt: Date | null }[],
): AdminResponse {
  return {
    invites: invites.map((invite) => ({
      login: invite.login,
      addedAt: invite.addedAt.toISOString(),
      signedIn: invite.signedIn,
    })),
    accounts: accounts.map((account) => ({
      id: account.id,
      login: account.login,
      createdAt: account.createdAt.toISOString(),
      lastCollectAt: account.lastCollectAt?.toISOString() ?? null,
    })),
  };
}
