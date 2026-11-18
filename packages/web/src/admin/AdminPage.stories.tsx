import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { parseTime } from '@cwd/shared';
import { formatDay, formatDayTime } from '../lib/format.ts';
import { adminEmpty, adminFull, adminStatus, adminViewingStatus } from '../test/admin.ts';
import { mockApi } from '../test/mock-api.ts';
import { cells } from '../test/table.ts';
import { AdminPage } from './AdminPage.tsx';

const meta = { component: AdminPage, parameters: { path: '/admin' } } satisfies Meta<typeof AdminPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const day = (iso: string) => formatDay(parseTime(iso));
const time = (iso: string) => formatDayTime(parseTime(iso));
const NO_INVITES = 'No invites: only you can sign in.';

/** Full: the invites, one not signed in yet, with a Remove each and the field to invite a login; the accounts, the
 * admin's marked "(you)" with no Delete, one that never collected. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminStatus, '/api/admin': adminFull });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Admin' })).toBeVisible();
    const invites = within(await canvas.findByRole('region', { name: 'Invites' }));
    const inviteRows = within(invites.getByRole('table', { name: 'Invites' })).getAllByRole('row');
    await expect(inviteRows).toHaveLength(5);
    await expect(cells(inviteRows[1])).toEqual(['mika-ito', day('2026-10-02T09:00:00.000Z'), 'Yes', 'Remove']);
    await expect(cells(inviteRows[4])).toEqual(['sam-okafor', day('2026-11-17T09:00:00.000Z'), 'Not yet', 'Remove']);
    await expect(within(inviteRows[4]).getByText('Not yet')).toHaveClass('text-muted-foreground');
    await expect(invites.getByRole('textbox', { name: 'GitHub login' })).toBeVisible();
    await expect(invites.getByRole('button', { name: 'Invite' })).toBeVisible();

    const accounts = within(canvas.getByRole('region', { name: 'Accounts' }));
    const accountRows = within(accounts.getByRole('table', { name: 'Accounts' })).getAllByRole('row');
    await expect(accountRows).toHaveLength(5);
    await expect(cells(accountRows[1])).toEqual([
      'rowan-k (you)',
      day('2026-10-01T09:00:00.000Z'),
      time('2026-11-18T00:41:00.000Z'),
      '',
    ]);
    await expect(within(accountRows[1]).getByText('(you)')).toHaveClass('text-muted-foreground');
    await expect(cells(accountRows[3])).toEqual(['dee-ward', day('2026-10-09T09:00:00.000Z'), 'Never', 'Delete']);
    await expect(within(accountRows[3]).getByText('Never')).toHaveClass('text-muted-foreground');
    await expect(accounts.getAllByRole('button', { name: 'Delete' })).toHaveLength(3);
  },
};

/** Empty: no invites, so only the admin signs in; the admin's account alone, with nothing to delete. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminStatus, '/api/admin': adminEmpty });
  },
  play: async ({ canvas }) => {
    const invites = within(await canvas.findByRole('region', { name: 'Invites' }));
    await expect(invites.getByText(NO_INVITES)).toBeVisible();
    await expect(invites.queryByRole('button', { name: 'Remove' })).toBeNull();
    await expect(invites.getByRole('button', { name: 'Invite' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Delete' })).toBeNull();
  },
};

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminStatus, '/api/admin': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the admin settings…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminStatus, '/api/admin': 500 });
  },
  play: async ({ canvas }) => {
    const text = "Couldn't load the admin settings. Reload the page to try again.";
    await expect(await canvas.findByText(text)).toBeVisible();
    await expect(canvas.queryByRole('region', { name: 'Invites' })).toBeNull();
  },
};

/** Anyone but the admin gets a 404, so the page is the router's not-found page. */
export const NotAdmin: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': { ...adminStatus, account: { ...adminStatus.account!, admin: false } }, '/api/admin': 404 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: 'Admin' })).toBeNull();
  },
};

/** Inviting posts the login typed and empties the field; Remove posts its login. */
export const InviteAndRemove: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': adminStatus,
      '/api/admin': adminFull,
      '/api/admin/invites': 204,
      '/api/admin/invites/mika-ito/remove': 204,
    });
  },
  play: async ({ canvas, userEvent }) => {
    const invites = within(await canvas.findByRole('region', { name: 'Invites' }));
    const login = invites.getByRole('textbox', { name: 'GitHub login' });
    await userEvent.type(login, 'kai-n');
    await userEvent.click(invites.getByRole('button', { name: 'Invite' }));
    await expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/invites',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ login: 'kai-n' }) }),
    );
    await expect(login).toHaveValue('');
    await userEvent.click(invites.getAllByRole('button', { name: 'Remove' })[0]);
    await expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/invites/mika-ito/remove',
      expect.objectContaining({ method: 'POST' }),
    );
  },
};

/** A login the server refuses says so, in fixed words, and keeps what was typed. */
export const InviteFails: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminStatus, '/api/admin': adminFull, '/api/admin/invites': 400 });
  },
  play: async ({ canvas, userEvent }) => {
    const invites = within(await canvas.findByRole('region', { name: 'Invites' }));
    await userEvent.type(invites.getByRole('textbox', { name: 'GitHub login' }), 'not a login');
    await userEvent.click(invites.getByRole('button', { name: 'Invite' }));
    await expect(await invites.findByText("Couldn't invite the login. Check it and try again.")).toBeVisible();
    await expect(invites.getByRole('textbox', { name: 'GitHub login' })).toHaveValue('not a login');
  },
};

/** While a call runs, the panel's actions are disabled. */
export const Pending: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminStatus, '/api/admin': adminFull, '/api/admin/invites/mika-ito/remove': 'pending' });
  },
  play: async ({ canvas, userEvent }) => {
    const invites = within(await canvas.findByRole('region', { name: 'Invites' }));
    await userEvent.click(invites.getAllByRole('button', { name: 'Remove' })[0]);
    for (const remove of invites.getAllByRole('button', { name: 'Remove' })) await expect(remove).toBeDisabled();
    await expect(invites.getByRole('button', { name: 'Invite' })).toBeDisabled();
  },
};

/** Delete asks first, naming the login; Cancel closes the dialog and posts nothing. */
export const DeleteCancelled: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminStatus, '/api/admin': adminFull });
  },
  play: async ({ canvas, userEvent }) => {
    const accounts = within(await canvas.findByRole('region', { name: 'Accounts' }));
    await userEvent.click(accounts.getAllByRole('button', { name: 'Delete' })[0]);
    const body = within(document.body);
    const dialog = await body.findByRole('dialog', { name: "Delete mika-ito's account?" });
    await expect(dialog).toHaveAccessibleDescription(
      "Its dashboard's data, collector tokens, viewers and Anthropic key are deleted. It can't be undone.",
    );
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
    await expect(globalThis.fetch).not.toHaveBeenCalledWith('/api/admin/accounts/2/delete', expect.anything());
  },
};

/** Confirming posts the account's deletion by id; a failure says so in the panel, in fixed words. */
export const DeleteFails: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminStatus, '/api/admin': adminFull, '/api/admin/accounts/2/delete': 500 });
  },
  play: async ({ canvas, userEvent }) => {
    const accounts = within(await canvas.findByRole('region', { name: 'Accounts' }));
    await userEvent.click(accounts.getAllByRole('button', { name: 'Delete' })[0]);
    const dialog = await within(document.body).findByRole('dialog', { name: "Delete mika-ito's account?" });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete account' }));
    await expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/admin/accounts/2/delete',
      expect.objectContaining({ method: 'POST' }),
    );
    await expect(await accounts.findByText("Couldn't delete the account. Try again.")).toBeVisible();
  },
};

/** Viewing another dashboard: the tables stay, and no control posts. */
export const Viewing: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': adminViewingStatus, '/api/admin': adminFull });
  },
  play: async ({ canvas }) => {
    const invites = within(await canvas.findByRole('region', { name: 'Invites' }));
    await expect(invites.getByRole('table', { name: 'Invites' })).toBeVisible();
    await expect(canvas.getByRole('table', { name: 'Accounts' })).toBeVisible();
    await expect(canvas.queryAllByRole('button')).toEqual([]);
    await expect(canvas.queryByRole('textbox')).toBeNull();
  },
};
