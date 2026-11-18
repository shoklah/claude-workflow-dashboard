import type { AccountResponse, ShowingResponse, StatusResponse } from '@cwd/shared';

// Invented answers of GET /api/account (hosted mode) for the Account page's stories, and of the status and showing
// mode for a caller who may view another account.

/** A machine feeds the account; two tokens, the older never used; two viewers; a key set. */
export const accountFull: AccountResponse = {
  login: 'rowan-k',
  createdAt: '2026-10-02T09:00:00.000Z',
  lastCollectAt: '2026-11-18T00:41:00.000Z',
  machine: true,
  tokens: [
    { id: 2, createdAt: '2026-11-12T09:14:00.000Z', lastUsedAt: '2026-11-18T00:41:00.000Z' },
    { id: 1, createdAt: '2026-10-30T18:02:00.000Z', lastUsedAt: null },
  ],
  viewers: ['jules-b', 'sam-okafor'],
  labeller: { keySet: true, model: 'claude-haiku-5-5', dailyMax: 500 },
};

/** A new account: no collect, no machine, no tokens, no viewers, no key. */
export const accountEmpty: AccountResponse = {
  login: 'rowan-k',
  createdAt: '2026-10-02T09:00:00.000Z',
  lastCollectAt: null,
  machine: false,
  tokens: [],
  viewers: [],
  labeller: { keySet: false, model: 'claude-haiku-5-5', dailyMax: 500 },
};

const AT = '2026-11-12T10:00:00.000Z';

/** Signed in as rowan-k, who may view mika-ito's account, on their own. */
export const ownStatus: StatusResponse = {
  lastImportAt: AT,
  lastGoodImportAt: AT,
  error: null,
  importing: false,
  account: { login: 'rowan-k', viewing: null, viewable: ['mika-ito'], admin: false },
};

/** The same caller viewing mika-ito's account. */
export const viewingStatus: StatusResponse = {
  ...ownStatus,
  account: { login: 'rowan-k', viewing: 'mika-ito', viewable: ['mika-ito'], admin: false },
};

/** `/api/showing` while viewing mika-ito's account: her kept list, on. */
export const viewedShowing: ShowingResponse = {
  on: true,
  projects: [{ key: '1a2b3c4d5e6f7081', name: 'lantern-notes', picked: true }],
};

/** `/api/showing` on the caller's own dashboard, showing mode off: two projects, both kept as shown. */
export const ownShowing: ShowingResponse = {
  on: false,
  projects: [
    { key: '1a2b3c4d5e6f7081', name: 'lantern-notes', picked: true },
    { key: '2b3c4d5e6f708192', name: 'tidepool-api', picked: true },
  ],
};

/** The same, with none kept. */
export const ownShowingNone: ShowingResponse = {
  on: false,
  projects: ownShowing.projects.map((project) => ({ ...project, picked: false })),
};
