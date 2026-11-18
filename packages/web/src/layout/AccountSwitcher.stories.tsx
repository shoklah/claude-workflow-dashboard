import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import { ownStatus, viewingStatus } from '../test/account.ts';
import { mockApi } from '../test/mock-api.ts';
import { AccountSwitcher } from './AccountSwitcher.tsx';

const meta = { component: AccountSwitcher } satisfies Meta<typeof AccountSwitcher>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The GETs of `/api/status` so far: the stubbed `fetch`'s calls with no init. */
function statusReads(): number {
  return (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
    (call) => call[0] === '/api/status' && call.length === 1,
  ).length;
}

/** Empty: no account to view but one's own, so there is nothing to switch. */
export const NoViewable: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': { ...ownStatus, account: { ...ownStatus.account!, viewable: [] } } });
  },
  play: async ({ canvas }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(canvas.queryByRole('combobox')).toBeNull();
  },
};

/** Full: "Yours", then each account the caller may view; choosing one posts it and reads every query again. */
export const Own: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus, '/api/view': 204 });
  },
  play: async ({ canvas, userEvent }) => {
    const select = await canvas.findByRole('combobox', { name: 'Dashboard' });
    await expect([...(select as HTMLSelectElement).options].map((option) => option.text)).toEqual(['Yours', 'mika-ito']);
    await expect(select).toHaveDisplayValue('Yours');
    await userEvent.selectOptions(select, 'mika-ito');
    await expect(fetch).toHaveBeenCalledWith('/api/view', {
      method: 'POST',
      headers: { 'X-Dashboard-Refresh': '1', 'Content-Type': 'application/json' },
      body: '{"login":"mika-ito"}',
    });
    await waitFor(() => expect(statusReads()).toBeGreaterThanOrEqual(2));
  },
};

/** Viewing mika-ito's account: she is chosen, and "Yours" posts null to come back. */
export const Viewing: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': viewingStatus, '/api/view': 204 });
  },
  play: async ({ canvas, userEvent }) => {
    const select = await canvas.findByRole('combobox', { name: 'Dashboard' });
    await expect(select).toHaveDisplayValue('mika-ito');
    await userEvent.selectOptions(select, 'Yours');
    await expect(fetch).toHaveBeenCalledWith('/api/view', {
      method: 'POST',
      headers: { 'X-Dashboard-Refresh': '1', 'Content-Type': 'application/json' },
      body: '{"login":null}',
    });
  },
};

/** At the rail's foot, its label in the rail's muted ink. */
export const Muted: Story = {
  args: { muted: true },
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus });
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('combobox', { name: 'Dashboard' });
    await expect(canvas.getByText('Dashboard')).toHaveClass('text-muted-foreground');
  },
};

/** Loading and error: nothing until the status says what the caller may view. */
export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('combobox')).toBeNull();
  },
};

export const Error: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': 500 });
  },
  play: async ({ canvas }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(canvas.queryByRole('combobox')).toBeNull();
  },
};
