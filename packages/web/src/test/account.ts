import type { AccountResponse } from '@cwd/shared';

// Invented answers of GET /api/account (hosted mode) for the Account page's stories.

/** A machine feeds the account; two tokens, the older never used. */
export const accountFull: AccountResponse = {
  login: 'rowan-k',
  createdAt: '2026-10-02T09:00:00.000Z',
  lastCollectAt: '2026-11-18T00:41:00.000Z',
  machine: true,
  tokens: [
    { id: 2, createdAt: '2026-11-12T09:14:00.000Z', lastUsedAt: '2026-11-18T00:41:00.000Z' },
    { id: 1, createdAt: '2026-10-30T18:02:00.000Z', lastUsedAt: null },
  ],
};

/** A new account: no collect, no machine, no tokens. */
export const accountEmpty: AccountResponse = {
  login: 'rowan-k',
  createdAt: '2026-10-02T09:00:00.000Z',
  lastCollectAt: null,
  machine: false,
  tokens: [],
};
