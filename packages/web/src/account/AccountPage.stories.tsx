import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { accountEmpty, accountFull } from '../test/account.ts';
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
  account: { login: 'rowan-k', viewing: null, viewable: [] },
};

/** Full: the Collector panel, then who is signed in, since when, and Sign out. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': accountFull });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
    await expect(await canvas.findByRole('region', { name: 'Collector' })).toBeVisible();
    const yours = within(canvas.getByRole('region', { name: 'Your account' }));
    await expect(yours.getByText('Signed in as').nextElementSibling).toHaveTextContent('rowan-k');
    await expect(yours.getByText('Account since').nextElementSibling).toHaveTextContent('Oct 2');
    await expect(yours.getByRole('button', { name: 'Sign out' })).toBeVisible();
  },
};

/** Empty: a new account, with no tokens. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/account': accountEmpty });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No tokens. Create one for your collector.')).toBeVisible();
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
