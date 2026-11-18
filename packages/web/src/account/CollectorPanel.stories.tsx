import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import { parseTime } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { accountEmpty, accountFull } from '../test/account.ts';
import { mockApi } from '../test/mock-api.ts';
import { cells } from '../test/table.ts';
import { CollectorPanel } from './CollectorPanel.tsx';

const meta = { component: CollectorPanel, args: { account: accountFull } } satisfies Meta<typeof CollectorPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const time = (iso: string) => formatDayTime(parseTime(iso));
const EMPTY = 'No tokens. Create one for your collector.';

/** Full: a machine feeds the account, two tokens (the older never used), and the collector can be reset. */
export const Full: Story = {
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Collector' }));
    await expect(panel.getByText('Last collect').nextElementSibling).toHaveTextContent(time(accountFull.lastCollectAt!));
    await expect(panel.getByText('Machine').nextElementSibling).toHaveTextContent('Set by the first collect');
    const rows = within(panel.getByRole('table', { name: 'Collector tokens' })).getAllByRole('row');
    await expect(rows).toHaveLength(3);
    await expect(cells(rows[1])).toEqual([time('2026-11-12T09:14:00.000Z'), time('2026-11-18T00:41:00.000Z'), 'Revoke']);
    await expect(cells(rows[2])).toEqual([time('2026-10-30T18:02:00.000Z'), 'Never', 'Revoke']);
    await expect(within(rows[2]).getByText('Never')).toHaveClass('text-muted-foreground');
    await expect(panel.getByRole('button', { name: 'Create token' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Reset collector' })).toBeVisible();
  },
};

/** Empty: no collect yet, no machine, no tokens, and nothing to reset. */
export const Empty: Story = {
  args: { account: accountEmpty },
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Collector' }));
    await expect(panel.getByText('Last collect').nextElementSibling).toHaveTextContent('Never');
    await expect(panel.getByText('Machine').nextElementSibling).toHaveTextContent('None yet');
    await expect(panel.getByText(EMPTY)).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Create token' })).toBeVisible();
    await expect(panel.queryByRole('button', { name: 'Reset collector' })).toBeNull();
  },
};

/** Creating a token shows it once, in a dialog, as the collector's `.env` line; once closed, it is gone from the page. */
export const CreateToken: Story = {
  args: { account: accountEmpty },
  beforeEach: () => {
    mockApi({ '/api/account/tokens': { token: 'ed_test' } });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Create token' }));
    await expect(globalThis.fetch).toHaveBeenCalledWith('/api/account/tokens', expect.objectContaining({ method: 'POST' }));
    const body = within(document.body);
    const dialog = await body.findByRole('dialog', { name: 'Collector token' });
    await expect(dialog).toHaveAccessibleDescription("Copy it now: it isn't shown again. Put it in the collector's .env.");
    // The dialog fades in.
    await waitFor(() => expect(within(dialog).getByText('EDWARD_TOKEN=ed_test')).toBeVisible());
    await expect(within(dialog).getByRole('button', { name: 'Copy' })).toBeVisible();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
    await expect(document.body.textContent).not.toContain('ed_test');
  },
};

/** Revoking a token posts its id; resetting the collector posts the reset. */
export const RevokeAndReset: Story = {
  beforeEach: () => {
    mockApi({ '/api/account/tokens/2/revoke': 200, '/api/account/reset-collector': 200 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Collector' }));
    await userEvent.click(panel.getAllByRole('button', { name: 'Revoke' })[0]);
    await expect(globalThis.fetch).toHaveBeenCalledWith('/api/account/tokens/2/revoke', expect.objectContaining({ method: 'POST' }));
    await userEvent.click(panel.getByRole('button', { name: 'Reset collector' }));
    await expect(globalThis.fetch).toHaveBeenCalledWith('/api/account/reset-collector', expect.objectContaining({ method: 'POST' }));
  },
};
