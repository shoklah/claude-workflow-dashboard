/** `GET /api/account` (hosted): the caller's account, ISO times, whether a machine feeds it (a cursor is stored), its
 * collector tokens, never a token or its hash, the GitHub logins it granted a view, lower-case, and its labeller:
 * whether an Anthropic key is set, never the key, its model and daily max. */
export type AccountResponse = {
  login: string;
  createdAt: string;
  lastCollectAt: string | null;
  machine: boolean;
  tokens: { id: number; createdAt: string; lastUsedAt: string | null }[];
  viewers: string[];
  labeller: { keySet: boolean; model: string; dailyMax: number };
};

/** The models an account's labeller may use. */
export const LABELLER_MODELS = ['claude-haiku-5-5', 'claude-sonnet-5-5'] as const;

/** The labeller's model and daily max when none is set, in local and hosted mode alike. */
export const LABELLER_DEFAULTS = { model: LABELLER_MODELS[0], dailyMax: 500 };

/** `POST /api/account/labeller` (hosted): the labeller's model and daily max (1 to 10000), and its key: absent keeps the
 * stored one, null removes it. */
export type LabellerRequest = { key?: string | null; model: (typeof LABELLER_MODELS)[number]; dailyMax: number };

/** `POST /api/account/tokens` (hosted): the new collector token, raw, shown this once. */
export type TokenResponse = { token: string };
