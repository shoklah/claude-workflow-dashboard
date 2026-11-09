import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { ShowingResponse, StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { ShowingControl } from './ShowingControl.tsx';

const meta = { component: ShowingControl } satisfies Meta<typeof ShowingControl>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };

const ATLAS = '1a2b3c4d5e6f7081';
const off: ShowingResponse = {
  on: false,
  projects: [
    { key: ATLAS, name: 'atlas', picked: false },
    { key: '2b3c4d5e6f708192', name: 'harbor', picked: false },
  ],
};
const on: ShowingResponse = {
  on: true,
  projects: [
    { key: ATLAS, name: 'Search app', picked: true },
    { key: '2b3c4d5e6f708192', name: 'Harbor API', picked: true },
  ],
};

/** The GETs of `/api/showing` so far: the stubbed `fetch`'s calls with no init. */
function showingReads(): number {
  return (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter(
    (call) => call[0] === '/api/showing' && call.length === 1,
  ).length;
}

/** Off: a switch, no bar. */
export const Off: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/showing': off });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('switch', { name: 'Showing mode' })).not.toBeChecked();
    await expect(canvas.queryByText(/^Showing:/)).toBeNull();
  },
};

/** Turning the switch on opens the picker; "Start showing" waits for a pick, then POSTs the picked keys. */
export const Picker: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/showing': off });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('switch', { name: 'Showing mode' }));
    // The dialog renders in a portal, outside the story's canvas.
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', { name: 'Show which projects in full?' });
    const start = within(dialog).getByRole('button', { name: 'Start showing' });
    await expect(start).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'atlas' }));
    await expect(start).toBeEnabled();
    await userEvent.click(start);
    await expect(fetch).toHaveBeenCalledWith('/api/showing', {
      method: 'POST',
      headers: { 'X-Dashboard-Refresh': '1', 'Content-Type': 'application/json' },
      body: `{"projects":["${ATLAS}"]}`,
    });
    await waitFor(() => expect(showingReads()).toBe(2));
    await waitFor(() => expect(body.queryByRole('dialog')).toBeNull());
  },
};

/** On: the orange bar with the shown names; "Stop showing" POSTs an empty list. */
export const On: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/showing': on });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Showing: Search app, Harbor API')).toBeVisible();
    await expect(canvas.queryByRole('switch')).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Stop showing' }));
    await expect(fetch).toHaveBeenCalledWith('/api/showing', {
      method: 'POST',
      headers: { 'X-Dashboard-Refresh': '1', 'Content-Type': 'application/json' },
      body: '{"projects":[]}',
    });
    await waitFor(() => expect(showingReads()).toBe(2));
  },
};

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/showing': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('switch', { name: 'Showing mode' })).toBeDisabled();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/showing': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't read showing mode.")).toBeVisible();
    await expect(canvas.queryByRole('switch')).toBeNull();
  },
};
