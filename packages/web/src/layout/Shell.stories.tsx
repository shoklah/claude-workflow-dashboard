import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { ShowingResponse, StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { Shell } from './Shell.tsx';

const meta = { component: Shell, args: { children: <p>The page</p> } } satisfies Meta<typeof Shell>;
export default meta;
type Story = StoryObj<typeof meta>;

const LAST_GOOD = '2026-11-12T10:00:00.000Z';
const ok: StatusResponse = { lastImportAt: LAST_GOOD, lastGoodImportAt: LAST_GOOD, error: null, importing: false };
const showingOff: ShowingResponse = { on: false, projects: [{ key: '1a2b3c4d5e6f7081', name: 'atlas', picked: false }] };

// Stories run at 1200 px, so the rail shows and the top row is hidden; e2e/shell.spec.ts checks 375 px.
const rail = (canvasElement: HTMLElement) => canvasElement.querySelector('aside')!;

/** Loading: the status pending, so no Refresh yet, which hosted mode never shows. */
export const StatusLoading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': 'pending', '/api/showing': showingOff });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('navigation')).toBeVisible();
    // From 768 px the rail holds the menu, so the Menu button is hidden.
    await expect(canvas.queryByRole('button', { name: 'Menu' })).toBeNull();
    await expect(canvas.getByText('The page')).toBeVisible();
    await expect(canvas.queryByRole('status')).toBeNull();
    await expect(rail(canvasElement).textContent).toContain('edward');
    await expect(canvas.queryByRole('button', { name: 'Refresh' })).toBeNull();
    await expect(rail(canvasElement).querySelector('time')).toBeNull();
  },
};

export const ServerUnreachable: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': 500, '/api/showing': showingOff });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('status')).toHaveTextContent(/can't reach the dashboard server/i);
    await expect(canvas.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(rail(canvasElement).querySelector('time')).toBeNull();
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
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('status')).toHaveTextContent(/nothing has been imported yet/i);
    await expect(canvas.getByRole('button', { name: /importing/i })).toBeDisabled();
    await expect(rail(canvasElement).querySelector('time')).toBeNull();
  },
};

/** Full: data imported, no failure, so no banner, the refresh button ready and the import's time in the rail. */
export const Imported: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ok, '/api/showing': showingOff });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('button', { name: 'Refresh' })).toBeEnabled();
    await waitFor(() => expect(canvas.getByRole('switch', { name: 'Showing mode' })).toBeEnabled());
    await expect(canvas.queryByRole('status')).toBeNull();
    await expect(canvas.queryByText("Couldn't read showing mode.")).toBeNull();
    const aside = rail(canvasElement);
    const time = aside.querySelector('time')!;
    await expect(time).toHaveAttribute('datetime', LAST_GOOD);
    await expect(time.parentElement!.textContent).toMatch(/^Imported /);
    await expect(within(aside).getByRole('button', { name: 'Refresh' })).toBeVisible();
  },
};

/** The last import failed: the banner says so, and the rail still shows the last good import's time. */
export const FailedImport: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': { lastImportAt: '2026-11-12T11:00:00.000Z', lastGoodImportAt: LAST_GOOD, error: 'reporter exited 1', importing: false },
      '/api/showing': showingOff,
    });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('status')).toHaveTextContent(/The last import failed/);
    await expect(rail(canvasElement).querySelector('time')).toHaveAttribute('datetime', LAST_GOOD);
  },
};

/** Showing mode on: the bar sits at the rail's foot, with no switch there. */
export const ShowingOn: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': ok,
      '/api/showing': { on: true, projects: [{ key: '1a2b3c4d5e6f7081', name: 'atlas', picked: true }] },
    });
  },
  play: async ({ canvasElement }) => {
    const aside = within(rail(canvasElement));
    await expect(await aside.findByRole('button', { name: 'Stop showing' })).toBeVisible();
    await expect(aside.queryByRole('switch')).toBeNull();
  },
};

/** Hosted mode (the status names the account): the rail's foot holds showing mode, the login linking to the Account
 * page and the import's time, with no Refresh. */
export const Hosted: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': { ...ok, account: { login: 'rowan-k' } }, '/api/showing': showingOff });
  },
  play: async ({ canvas, canvasElement }) => {
    const aside = within(rail(canvasElement));
    await expect(await aside.findByRole('link', { name: 'rowan-k' })).toHaveAttribute('href', '/account');
    await expect(aside.getByRole('switch', { name: 'Showing mode' })).toBeVisible();
    await expect(rail(canvasElement).querySelector('time')).toHaveAttribute('datetime', LAST_GOOD);
    await expect(canvas.queryByRole('button', { name: 'Refresh' })).toBeNull();
  },
};
