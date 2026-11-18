import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { ownShowing, ownShowingNone, ownStatus } from '../test/account.ts';
import { mockApi } from '../test/mock-api.ts';
import { ShownProjectsPanel } from './ShownProjectsPanel.tsx';

const meta = { component: ShownProjectsPanel } satisfies Meta<typeof ShownProjectsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Full: showing mode's projects, ticked from the kept list, and Save. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus, '/api/showing': ownShowing });
  },
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Shown projects' }));
    await expect(await panel.findByRole('checkbox', { name: 'lantern-notes' })).toBeChecked();
    await expect(panel.getByRole('checkbox', { name: 'tidepool-api' })).toBeChecked();
    await expect(panel.getByRole('button', { name: 'Save' })).toBeVisible();
  },
};

/** Empty: nothing kept, every project unticked. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus, '/api/showing': ownShowingNone });
  },
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Shown projects' }));
    await expect(await panel.findByRole('checkbox', { name: 'lantern-notes' })).not.toBeChecked();
    await expect(panel.getByRole('checkbox', { name: 'tidepool-api' })).not.toBeChecked();
  },
};

/** No projects stored yet: a muted line, and nothing to save. */
export const NoProjects: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus, '/api/showing': { on: false, projects: [] } });
  },
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Shown projects' }));
    await expect(await panel.findByText('No projects yet.')).toHaveClass('text-muted-foreground');
    await expect(panel.queryByRole('button', { name: 'Save' })).toBeNull();
  },
};

/** Save posts the ticked keys as the kept list. */
export const Save: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus, '/api/showing': ownShowing, '/api/showing/projects': 204 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Shown projects' }));
    await userEvent.click(await panel.findByRole('checkbox', { name: 'tidepool-api' }));
    await userEvent.click(panel.getByRole('button', { name: 'Save' }));
    await expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/showing/projects',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ projects: ['1a2b3c4d5e6f7081'] }) }),
    );
  },
};

/** A failed save says so, in fixed words, and Save comes back. */
export const SaveFails: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus, '/api/showing': ownShowing, '/api/showing/projects': 500 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Shown projects' }));
    await userEvent.click(await panel.findByRole('button', { name: 'Save' }));
    await expect(await panel.findByText("Couldn't save the shown projects. Try again.")).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Save' })).toBeEnabled();
  },
};

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus, '/api/showing': 'pending' });
  },
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Shown projects' }));
    await expect(await panel.findByText('Loading your projects…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': ownStatus, '/api/showing': 500 });
  },
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Shown projects' }));
    await expect(await panel.findByText("Couldn't load your projects. Reload the page to try again.")).toBeVisible();
  },
};
