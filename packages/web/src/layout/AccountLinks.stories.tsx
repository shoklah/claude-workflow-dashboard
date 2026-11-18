import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { AccountLinks } from './AccountLinks.tsx';

const meta = { component: AccountLinks, args: { onNavigate: fn() } } satisfies Meta<typeof AccountLinks>;
export default meta;
type Story = StoryObj<typeof meta>;

const LAST_GOOD = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: LAST_GOOD, lastGoodImportAt: LAST_GOOD, error: null, importing: false };

/** Hosted mode, signed in: the login alone, linking to the Account page, in the menu entry's look. */
export const SignedIn: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': { ...status, account: { login: 'rowan-k', admin: false } } });
  },
  play: async ({ canvas, args, userEvent }) => {
    const link = await canvas.findByRole('link', { name: 'rowan-k' });
    await expect(canvas.getAllByRole('link')).toHaveLength(1);
    await expect(link).toHaveAttribute('href', '/account');
    await expect(link.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(link);
    await expect(args.onNavigate).toHaveBeenCalledTimes(1);
  },
};

/** The admin: the login, then Admin, linking to the Admin page, with its key icon. */
export const Admin: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': { ...status, account: { login: 'rowan-k', admin: true } } });
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('link', { name: 'rowan-k' });
    const links = canvas.getAllByRole('link');
    await expect(links.map((link) => link.textContent)).toEqual(['rowan-k', 'Admin']);
    await expect(links[1]).toHaveAttribute('href', '/admin');
    await expect(links[1].querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  },
};

/** On the Account page, its link is the current one. */
export const OnAccount: Story = {
  parameters: { path: '/account' },
  beforeEach: () => {
    mockApi({ '/api/status': { ...status, account: { login: 'rowan-k' } } });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'rowan-k' })).toHaveAttribute('aria-current', 'page');
  },
};

/** Empty: local mode has no account, so there is nothing to draw. */
export const Local: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': { ...status, account: null } });
  },
  play: async ({ canvas }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(canvas.queryByRole('link')).toBeNull();
  },
};

/** Loading and error: nothing until the status says who is signed in. */
export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link')).toBeNull();
  },
};

export const Error: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': 500 });
  },
  play: async ({ canvas }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(canvas.queryByRole('link')).toBeNull();
  },
};
