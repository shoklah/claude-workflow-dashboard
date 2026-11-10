import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { weeksEmpty, weeksFull } from '../test/weeks.ts';
import { WeeksPage } from './WeeksPage.tsx';

const meta = { component: WeeksPage } satisfies Meta<typeof WeeksPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };
const CHARTS = ['Runs', 'Final review findings', 'Estimated dollars', 'Minutes per run'];

const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent);

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/weeks?weeks=12': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the weeks…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/weeks?weeks=12': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the weeks.")).toBeVisible();
  },
};

/** Empty: twelve weeks of nothing, a line saying so, every unknown sum a dash, and no coverage note. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/weeks?weeks=12': weeksEmpty });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No runs in this period.')).toBeVisible();
    const weeks = within(canvas.getByRole('table', { name: 'Weeks' }));
    await expect(weeks.getAllByRole('row')).toHaveLength(13);
    await expect(cells(weeks.getAllByRole('row')[1])).toEqual(['none', '0', 'none', '0', '0', '–', '–', '–', '–', '0']);
    const runTime = within(canvas.getByRole('table', { name: 'Full runs' }));
    await expect(cells(runTime.getAllByRole('row')[1])).toEqual(['0', '0', '–']);
    await expect(canvas.queryByText(/the reporter can no longer read them/)).toBeNull();
  },
};

/**
 * Full: the last 12 weeks by default, four small multiples (one measure each), the week table as their table view,
 * newest first with the static page's columns, the Full runs' run time, and the coverage note.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/weeks?weeks=12': weeksFull });
  },
  play: async ({ canvas }) => {
    const weeks = within(await canvas.findByRole('table', { name: 'Weeks' }));
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('12');
    for (const title of CHARTS) await expect(canvas.getByRole('heading', { name: title })).toBeVisible();
    await expect(canvas.getAllByRole('img')).toHaveLength(4);

    await expect(weeks.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Week', 'Runs', 'Tasks', 'Findings', 'Fix rounds', 'Stops', 'Fable points', 'All points', 'Estimated dollars',
      'Minutes per run', 'Later fix commits',
    ]);
    const [, newest, previous] = weeks.getAllByRole('row');
    await expect(within(newest).getByRole('rowheader')).toHaveTextContent('Nov 8');
    await expect(cells(newest)).toEqual([
      'small 4 · full 2 · plan 1', '12', 'important 3 · minor 8', '8', '0', '14', '7', '$38.40', '2 h 20', '1',
    ]);
    await expect(cells(previous).at(-2)).toBe('2 h 46');

    const runTime = within(canvas.getByRole('table', { name: 'Full runs' }));
    await expect(runTime.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Full runs', 'Runs', 'With a run time', 'Median minutes',
    ]);
    await expect(runTime.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual([
      'with waves332 h 30',
      'without waves433 h 05',
    ]);
    await expect(canvas.getByText(/the reporter can no longer read them/)).toHaveTextContent(
      'Weeks before Oct 13, 2026 show what was stored; the reporter can no longer read them.',
    );
    await expect(canvas.queryByText('No runs in this period.')).toBeNull();
  },
};

/** The path, project and period filters go to the API as query params. */
export const Filters: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      ...projects,
      '/api/weeks?weeks=12': weeksFull,
      '/api/weeks?path=full&weeks=12': weeksFull,
      '/api/weeks?path=full&weeks=4': weeksFull,
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('table', { name: 'Weeks' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '4');
    await expect(fetch).toHaveBeenCalledWith('/api/weeks?path=full&weeks=4');
  },
};
