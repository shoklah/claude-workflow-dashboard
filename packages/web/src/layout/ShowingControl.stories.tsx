import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { ShowingResponse, StatusResponse } from '@cwd/shared';
import { viewedShowing } from '../test/account.ts';
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
    // Read again after the POST; the reset status read re-enables the query, so it can be read twice.
    await waitFor(() => expect(showingReads()).toBeGreaterThanOrEqual(2));
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
    const stop = canvas.getByRole('button', { name: 'Stop showing' });
    // Every button is a pill (DESIGN.md), through index.css's one rule.
    await expect(getComputedStyle(stop).borderTopLeftRadius).toBe('9999px');
    await userEvent.click(stop);
    await expect(fetch).toHaveBeenCalledWith('/api/showing', {
      method: 'POST',
      headers: { 'X-Dashboard-Refresh': '1', 'Content-Type': 'application/json' },
      body: '{"projects":[]}',
    });
    // Read again after the POST; the reset status read re-enables the query, so it can be read twice.
    await waitFor(() => expect(showingReads()).toBeGreaterThanOrEqual(2));
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

/** Stacked, as at the rail's foot: long names wrap inside the rail's width, "Stop showing" under them. */
export const StackedLongNames: Story = {
  render: () => (
    <div style={{ width: 176 }}>
      <ShowingControl stacked />
    </div>
  ),
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      '/api/showing': {
        on: true,
        projects: [
          { key: ATLAS, name: 'lanternnotesarchiveexport', picked: true },
          { key: '2b3c4d5e6f708192', name: 'tidepool-api-gateway', picked: true },
          { key: '3c4d5e6f70819203', name: 'quarry-field-recorder', picked: true },
        ],
      },
    });
  },
  play: async ({ canvas }) => {
    const stop = await canvas.findByRole('button', { name: 'Stop showing' });
    const bar = stop.parentElement!;
    await expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth);
    await expect(bar.getBoundingClientRect().width).toBeLessThanOrEqual(176);
    await expect(stop.getBoundingClientRect().top).toBeGreaterThan(canvas.getByText(/^Showing:/).getBoundingClientRect().bottom - 1);
  },
};

/** Viewing another account: its kept projects in the bar, read-only, with nothing that would change them. */
export const Viewing: Story = {
  args: { viewing: 'mika-ito' },
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/showing': viewedShowing });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("mika-ito's projects: lantern-notes")).toBeVisible();
    await expect(canvas.getByText('Read-only')).toBeVisible();
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvas.queryByRole('switch')).toBeNull();
  },
};

/** Viewing, while showing mode's state loads: nothing yet, never the switch. */
export const ViewingLoading: Story = {
  args: { viewing: 'mika-ito' },
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/showing': 'pending' });
  },
  play: async ({ canvas }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await expect(canvas.queryByRole('switch')).toBeNull();
    await expect(canvas.queryByText('Read-only')).toBeNull();
  },
};

/** The picker starts ticked from the kept list, so ticking another project adds to it instead of replacing it. */
export const PickerKeepsKeptList: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      '/api/showing': { on: false, projects: [off.projects[0]!, { ...off.projects[1]!, picked: true }] },
    });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByRole('switch', { name: 'Showing mode' }));
    const dialog = await within(canvasElement.ownerDocument.body).findByRole('dialog');
    await expect(within(dialog).getByRole('checkbox', { name: 'harbor' })).toBeChecked();
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'atlas' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Start showing' }));
    await expect(fetch).toHaveBeenCalledWith('/api/showing', {
      method: 'POST',
      headers: { 'X-Dashboard-Refresh': '1', 'Content-Type': 'application/json' },
      body: `{"projects":["2b3c4d5e6f708192","${ATLAS}"]}`,
    });
  },
};

/** Viewing an account whose kept list is empty: the bar says so in a word. */
export const ViewingNone: Story = {
  args: { viewing: 'mika-ito' },
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/showing': { on: true, projects: [] } });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("mika-ito's projects: none")).toBeVisible();
  },
};
