import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { accountEmpty, accountFull, ownShowing, ownShowingNone, viewingStatus } from '../test/account.ts';
import { mockApi } from '../test/mock-api.ts';
import { AccountPage } from './AccountPage.tsx';

const meta = { component: AccountPage, parameters: { path: '/account' } } satisfies Meta<typeof AccountPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = {
  lastImportAt: AT,
  lastGoodImportAt: AT,
  error: null,
  importing: false,
  account: { login: 'rowan-k', viewing: null, viewable: [], admin: false },
};

const DELETE_TEXT =
  "Your dashboard's data, collector tokens, viewers and Anthropic key are deleted. It can't be undone.";

/** Full: the Collector, Labeller, Viewers and Shown projects panels, then who is signed in, since when, Sign out and
 * Delete account. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': accountFull, '/api/showing': ownShowing });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
    for (const name of ['Collector', 'Labeller', 'Viewers', 'Shown projects']) {
      await expect(await canvas.findByRole('region', { name })).toBeVisible();
    }
    const yours = within(canvas.getByRole('region', { name: 'Your account' }));
    await expect(yours.getByText('Signed in as').nextElementSibling).toHaveTextContent('rowan-k');
    await expect(yours.getByText('Account since').nextElementSibling).toHaveTextContent('Oct 2');
    await expect(yours.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(yours.getByRole('button', { name: 'Delete account' })).toBeVisible();
  },
};

/** Empty: a new account, with no tokens. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': accountEmpty, '/api/showing': ownShowingNone });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No tokens. Create one for your collector.')).toBeVisible();
    await expect(canvas.getByText('No viewers.')).toBeVisible();
    await expect(canvas.getByText('No key: findings stay unlabelled.')).toBeVisible();
    await expect(canvas.getByRole('region', { name: 'Your account' })).toBeVisible();
  },
};

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading your account…')).toBeVisible();
    await expect(canvas.getByText('Loading your account…').closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': 500 });
  },
  play: async ({ canvas }) => {
    const text = "Couldn't load your account. Reload the page to try again.";
    await expect(await canvas.findByText(text)).toBeVisible();
    await expect(canvas.queryByRole('region', { name: 'Your account' })).toBeNull();
  },
};

/** A failed sign-out says so under "Your account", in fixed words, and stays on the page. */
export const SignOutFails: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': accountFull, '/auth/signout': 500 });
  },
  play: async ({ canvas, userEvent }) => {
    const yours = within(await canvas.findByRole('region', { name: 'Your account' }));
    await userEvent.click(yours.getByRole('button', { name: 'Sign out' }));
    await expect(await yours.findByText("Couldn't sign out. Try again.")).toBeVisible();
  },
};

/** Delete account asks first; Cancel closes the dialog and posts nothing. */
export const DeleteCancelled: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': accountFull, '/api/showing': ownShowing });
  },
  play: async ({ canvas, userEvent }) => {
    const yours = within(await canvas.findByRole('region', { name: 'Your account' }));
    await userEvent.click(yours.getByRole('button', { name: 'Delete account' }));
    const body = within(document.body);
    const dialog = await body.findByRole('dialog', { name: 'Delete your account?' });
    await expect(dialog).toHaveAccessibleDescription(DELETE_TEXT);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
    await expect(globalThis.fetch).not.toHaveBeenCalledWith('/api/account/delete', expect.anything());
    await expect(canvas.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
  },
};

/** Confirming posts the deletion; a failure says so under "Your account", in fixed words, and stays on the page. */
export const DeleteFails: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': accountFull, '/api/showing': ownShowing, '/api/account/delete': 500 });
  },
  play: async ({ canvas, userEvent }) => {
    const yours = within(await canvas.findByRole('region', { name: 'Your account' }));
    await userEvent.click(yours.getByRole('button', { name: 'Delete account' }));
    const dialog = await within(document.body).findByRole('dialog', { name: 'Delete your account?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    await expect(globalThis.fetch).toHaveBeenCalledWith('/api/account/delete', expect.objectContaining({ method: 'POST' }));
    await expect(await yours.findByText("Couldn't delete your account. Try again.")).toBeVisible();
  },
};

/** Viewing another account: the caller's own settings aren't shown and no control posts; Sign out stays. */
export const Viewing: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': viewingStatus, '/api/account': accountFull, '/api/showing': ownShowing });
  },
  play: async ({ canvas }) => {
    const yours = within(await canvas.findByRole('region', { name: 'Your account' }));
    await expect(yours.getByRole('button', { name: 'Sign out' })).toBeVisible();
    await expect(canvas.getAllByRole('button').map((button) => button.textContent)).toEqual(['Sign out']);
    await expect(canvas.queryByRole('textbox')).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Collector' })).toBeNull();
  },
};
