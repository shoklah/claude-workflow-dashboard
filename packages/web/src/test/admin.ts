import type { AdminResponse, StatusResponse } from '@cwd/shared';

// Invented answers of GET /api/admin (hosted mode, the admin only) for the Admin page's stories, and of the status for
// the admin, rowan-k, on their own dashboard and viewing mika-ito's.

/** Four invites, one not signed in yet; four accounts, the admin's first, one that never collected. */
export const adminFull: AdminResponse = {
  invites: [
    { login: 'mika-ito', addedAt: '2026-10-02T09:00:00.000Z', signedIn: true },
    { login: 'dee-ward', addedAt: '2026-10-09T09:00:00.000Z', signedIn: true },
    { login: 'jules-b', addedAt: '2026-11-14T09:00:00.000Z', signedIn: true },
    { login: 'sam-okafor', addedAt: '2026-11-17T09:00:00.000Z', signedIn: false },
  ],
  accounts: [
    { id: 1, login: 'rowan-k', createdAt: '2026-10-01T09:00:00.000Z', lastCollectAt: '2026-11-18T00:41:00.000Z' },
    { id: 2, login: 'mika-ito', createdAt: '2026-10-03T09:00:00.000Z', lastCollectAt: '2026-11-17T21:10:00.000Z' },
    { id: 3, login: 'dee-ward', createdAt: '2026-10-09T09:00:00.000Z', lastCollectAt: null },
    { id: 4, login: 'jules-b', createdAt: '2026-11-14T09:00:00.000Z', lastCollectAt: '2026-11-16T08:55:00.000Z' },
  ],
};

/** No invites: only the admin's account. */
export const adminEmpty: AdminResponse = { invites: [], accounts: adminFull.accounts.slice(0, 1) };

const AT = '2026-11-12T10:00:00.000Z';

/** Signed in as rowan-k, the admin, on their own dashboard. */
export const adminStatus: StatusResponse = {
  lastImportAt: AT,
  lastGoodImportAt: AT,
  error: null,
  importing: false,
  account: { login: 'rowan-k', viewing: null, viewable: ['mika-ito'], admin: true },
};

/** The admin viewing mika-ito's dashboard. */
export const adminViewingStatus: StatusResponse = {
  ...adminStatus,
  account: { login: 'rowan-k', viewing: 'mika-ito', viewable: ['mika-ito'], admin: true },
};
