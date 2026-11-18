/** `GET /api/admin` (hosted, the admin only): the invited GitHub logins, lower-case, each with whether an account holds
 * it, and every account with its ISO times, never anything of its tokens or sessions. */
export type AdminResponse = {
  invites: { login: string; addedAt: string; signedIn: boolean }[];
  accounts: { id: number; login: string; createdAt: string; lastCollectAt: string | null }[];
};
