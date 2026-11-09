import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsEmpty, runsFull, runsHidden, runsWarned } from '../test/runs.ts';
import { RunsPage } from './RunsPage.tsx';

const meta = { component: RunsPage } satisfies Meta<typeof RunsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/runs?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the runs…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/runs?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the runs.")).toBeVisible();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/runs?weeks=4': runsEmpty });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No runs in this period.')).toBeVisible();
  },
};

/** Full: the last 4 weeks by default, with every path and project to choose from. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/runs?weeks=4': runsFull });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'atlas · feat/search' })).toBeVisible();
    await expect(canvas.getAllByRole('row')).toHaveLength(4);
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    const projects = canvas.getByRole('combobox', { name: 'Project' });
    await expect([...projects.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'All',
      'atlas',
      'harbor',
      'quarry',
    ]);
    await expect(canvas.queryByText(/in other projects/)).toBeNull();
  },
};

/** Showing mode on: the runs of other projects are only counted, in a line under the list. */
export const HiddenRuns: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/runs?weeks=4': runsHidden });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'atlas · feat/search' })).toBeVisible();
    await expect(canvas.getByText('+ 2 runs in other projects, counted in totals and charts only')).toBeVisible();
  },
};

/** "Has warnings" asks the API for the runs with warnings only, and the others leave the list. */
export const HasWarnings: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/runs?weeks=4': runsFull, '/api/runs?weeks=4&warnings=1': runsWarned });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('link', { name: /^harbor/ })).toBeVisible();
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Has warnings' }));
    await expect(fetch).toHaveBeenCalledWith('/api/runs?weeks=4&warnings=1');
    await expect(await canvas.findAllByRole('row')).toHaveLength(2);
    await expect(canvas.getByRole('link', { name: 'atlas · feat/search' })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: /^harbor/ })).toBeNull();
  },
};

/** The path, project and period filters go to the API as query params. */
export const Filters: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      '/api/runs?weeks=4': runsFull,
      '/api/runs?path=full&weeks=4': runsWarned,
      '/api/runs?path=full&project=1a2b3c4d5e6f7081&weeks=4': runsWarned,
      '/api/runs?path=full&project=1a2b3c4d5e6f7081&weeks=12': runsWarned,
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('link', { name: /^harbor/ });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Project' }), 'atlas');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '12');
    await expect(fetch).toHaveBeenCalledWith('/api/runs?path=full&project=1a2b3c4d5e6f7081&weeks=12');
  },
};
