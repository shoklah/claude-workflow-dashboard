import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor } from 'storybook/test';
import type { ShowingResponse, StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { Shell } from './Shell.tsx';

const meta = { component: Shell, args: { children: <p>The page</p> } } satisfies Meta<typeof Shell>;
export default meta;
type Story = StoryObj<typeof meta>;

const LAST_GOOD = '2026-11-12T10:00:00.000Z';
const ok: StatusResponse = { lastImportAt: LAST_GOOD, lastGoodImportAt: LAST_GOOD, error: null, importing: false };
const showingOff: ShowingResponse = { on: false, projects: [{ key: '1a2b3c4d5e6f7081', name: 'atlas', picked: false }] };

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': 'pending', '/api/showing': showingOff });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('navigation')).toBeVisible();
    await expect(canvas.getByText('The page')).toBeVisible();
    await expect(canvas.queryByRole('status')).toBeNull();
  },
};

export const ServerUnreachable: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': 500, '/api/showing': showingOff });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('status')).toHaveTextContent(/can't reach the dashboard server/i);
  },
};

/** Empty: nothing imported yet, the first import running. */
export const NeverImported: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': { lastImportAt: null, lastGoodImportAt: null, error: null, importing: true },
      '/api/showing': showingOff,
    });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('status')).toHaveTextContent(/nothing has been imported yet/i);
    await expect(canvas.getByRole('button', { name: /importing/i })).toBeDisabled();
  },
};

/** Full: data imported, no failure, so no banner and the refresh button ready. */
export const Imported: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/showing': showingOff });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('button', { name: 'Refresh' })).toBeEnabled();
    await waitFor(() => expect(canvas.getByRole('switch', { name: 'Showing mode' })).toBeEnabled());
    await expect(canvas.queryByRole('status')).toBeNull();
    await expect(canvas.queryByText("Couldn't read showing mode.")).toBeNull();
  },
};
