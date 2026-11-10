import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { findingsEmpty, findingsFull, findingsHidden, findingsWorkflow } from '../test/findings.ts';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { FindingsPage } from './FindingsPage.tsx';

const meta = { component: FindingsPage } satisfies Meta<typeof FindingsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/findings?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the findings…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/findings?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the findings.")).toBeVisible();
  },
};

/** Empty: a grid of zeros, a line saying the period has no findings, and the labeller off. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/findings?weeks=4': findingsEmpty });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No findings in this period.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Tests, week of Nov 8: 0' })).toBeVisible();
    await expect(canvas.getByText('Labeller off: no API key')).toBeVisible();
  },
};

/**
 * Full: the last 4 weeks' implementation findings by default, counted as raised, with the line that every label is the
 * app's. Selecting the Tests cell of Nov 8 lists its two findings below the grid, each linking to its run.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/findings?weeks=4': findingsFull });
  },
  play: async ({ canvas, userEvent }) => {
    const cell = await canvas.findByRole('button', { name: 'Tests, week of Nov 8: 2' });
    await expect(canvas.getByText(/Every label here is the app's/)).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    await expect(canvas.getByRole('button', { name: 'Raised' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Implementation' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() =>
      expect(
        [...canvas.getByRole('combobox', { name: 'Project' }).querySelectorAll('option')].map((o) => o.textContent),
      ).toEqual(['All', 'atlas', 'harbor', 'quarry']),
    );
    await expect(canvas.getByText('Select a cell to list its findings.')).toBeVisible();

    await userEvent.click(cell);
    await expect(canvas.getByRole('heading', { name: 'Tests · week of Nov 8 · 2 findings' })).toBeVisible();
    const list = within(canvas.getByRole('region', { name: 'Findings' }));
    await expect(list.getAllByRole('row')).toHaveLength(3);
    await expect(list.getByText('The retry path has no test')).toBeVisible();
    await expect(list.getByText('Story for the error state is missing')).toBeVisible();
    await expect(list.getAllByRole('link', { name: 'atlas · feat/search' })[0]).toHaveAttribute(
      'href',
      '/runs/a1b2c3d4e5f60718',
    );
    await expect(canvas.queryByText(/in other projects/)).toBeNull();
  },
};

/**
 * After CR10, "App differs" counts the findings the app labels differently from the workflow, and the line that every
 * label is the app's is gone.
 */
export const AppDiffers: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/findings?weeks=4': findingsWorkflow });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('button', { name: 'Tests, week of Nov 8: 2 · 1 by the app' });
    await expect(canvas.queryByText(/Every label here is the app's/)).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'App differs' }));
    await expect(canvas.getByRole('button', { name: 'App differs' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Correctness, week of Oct 18: 1' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Tests, week of Nov 8: 0' })).toBeVisible();
  },
};

/** "Strengths" counts the reviewers' strengths under each category. */
export const Strengths: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/findings?weeks=4': findingsWorkflow });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Strengths' }));
    await expect(canvas.getByRole('button', { name: 'Reuse and duplication, week of Nov 1: 2' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Tests, week of Nov 8: 1' })).toBeVisible();
  },
};

/** The switches: a share measure writes percents, another area shows its own categories and drops the selection. */
export const Switches: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/findings?weeks=4': findingsFull });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Tests, week of Nov 8: 2' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Share acted on' }));
    await expect(canvas.getByRole('button', { name: 'Tests, week of Nov 8: 50%' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Plan' }));
    await expect(canvas.getByRole('rowheader', { name: 'Scope' })).toBeVisible();
    await expect(canvas.queryByRole('rowheader', { name: 'Tests' })).toBeNull();
    await expect(canvas.getByText('Select a cell to list its findings.')).toBeVisible();
  },
};

/** The path, project and period filters go to the API as query params. */
export const Filters: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      ...projects,
      '/api/findings?weeks=4': findingsFull,
      '/api/findings?path=full&weeks=4': findingsFull,
      '/api/findings?path=full&project=1a2b3c4d5e6f7081&weeks=4': findingsFull,
      '/api/findings?path=full&project=1a2b3c4d5e6f7081&weeks=12': findingsFull,
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('button', { name: 'Tests, week of Nov 8: 2' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await waitFor(() =>
      expect(canvas.getByRole('combobox', { name: 'Project' }).querySelectorAll('option')).toHaveLength(4),
    );
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Project' }), 'atlas');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '12');
    await expect(fetch).toHaveBeenCalledWith('/api/findings?path=full&project=1a2b3c4d5e6f7081&weeks=12');
  },
};

/** Showing mode on: other projects' findings are only counted, in a line under the list. */
export const HiddenFindings: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/findings?weeks=4': findingsHidden });
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('button', { name: 'Tests, week of Nov 8: 2' });
    await expect(canvas.getByText('+ 3 findings in other projects, counted in totals and charts only')).toBeVisible();
  },
};
