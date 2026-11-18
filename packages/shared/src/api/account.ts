/** `GET /api/account` (hosted): the caller's account, ISO times, whether a machine feeds it (a cursor is stored), its
 * collector tokens, never a token or its hash, and the GitHub logins it granted a view, lower-case. */
export type AccountResponse = {
  login: string;
  createdAt: string;
  lastCollectAt: string | null;
  machine: boolean;
  tokens: { id: number; createdAt: string; lastUsedAt: string | null }[];
  viewers: string[];
};

/** `POST /api/account/tokens` (hosted): the new collector token, raw, shown this once. */
export type TokenResponse = { token: string };
