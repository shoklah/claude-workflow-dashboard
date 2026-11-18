import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { accountEmpty, accountFull } from '../test/account.ts';
import { mockApi } from '../test/mock-api.ts';
import { cells } from '../test/table.ts';
import { ViewersPanel } from './ViewersPanel.tsx';

const meta = { component: ViewersPanel, args: { account: accountFull } } satisfies Meta<typeof ViewersPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const LINE = 'Viewers see the projects you show. Totals and charts count every project, without its name.';

/** Full: what viewers see, two logins with a Remove each, and the field to add one. */
export const Full: Story = {
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Viewers' }));
    await expect(panel.getByText(LINE)).toHaveClass('text-muted-foreground');
    const rows = within(panel.getByRole('table', { name: 'Viewers' })).getAllByRole('row');
    await expect(rows).toHaveLength(3);
    await expect(cells(rows[1])).toEqual(['jules-b', 'Remove']);
    await expect(cells(rows[2])).toEqual(['sam-okafor', 'Remove']);
    await expect(panel.getByRole('textbox', { name: 'GitHub login' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Add viewer' })).toBeVisible();
  },
};

/** Empty: no viewers yet. */
export const Empty: Story = {
  args: { account: accountEmpty },
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Viewers' }));
    await expect(panel.getByText('No viewers.')).toBeVisible();
    await expect(panel.queryByRole('button', { name: 'Remove' })).toBeNull();
  },
};

/** Adding posts the login typed and empties the field; Remove posts its login. */
export const AddAndRemove: Story = {
  beforeEach: () => {
    mockApi({ '/api/account/viewers': 204, '/api/account/viewers/jules-b/remove': 204 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Viewers' }));
    const login = panel.getByRole('textbox', { name: 'GitHub login' });
    await userEvent.type(login, 'kai-n');
    await userEvent.click(panel.getByRole('button', { name: 'Add viewer' }));
    await expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/account/viewers',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ login: 'kai-n' }) }),
    );
    await expect(login).toHaveValue('');
    await userEvent.click(panel.getAllByRole('button', { name: 'Remove' })[0]);
    await expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/account/viewers/jules-b/remove',
      expect.objectContaining({ method: 'POST' }),
    );
  },
};

/** A login the server refuses says so, in fixed words, and keeps what was typed. */
export const AddFails: Story = {
  beforeEach: () => {
    mockApi({ '/api/account/viewers': 400 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Viewers' }));
    await userEvent.type(panel.getByRole('textbox', { name: 'GitHub login' }), 'not a login');
    await userEvent.click(panel.getByRole('button', { name: 'Add viewer' }));
    await expect(await panel.findByText("Couldn't add the viewer. Check the login and try again.")).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'GitHub login' })).toHaveValue('not a login');
  },
};

/** While a call runs, the panel's actions are disabled. */
export const Pending: Story = {
  beforeEach: () => {
    mockApi({ '/api/account/viewers/jules-b/remove': 'pending' });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Viewers' }));
    await userEvent.click(panel.getAllByRole('button', { name: 'Remove' })[0]);
    for (const remove of panel.getAllByRole('button', { name: 'Remove' })) await expect(remove).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Add viewer' })).toBeDisabled();
  },
};
