import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { spendEmpty, spendFull } from '../test/spend.ts';
import { SpendPage } from './SpendPage.tsx';

const meta = { component: SpendPage } satisfies Meta<typeof SpendPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };
const ALL = '/api/spend?weeks=12';
const SESSIONS = '/api/spend?weeks=12&units=sessions';
const FULL_PATH = '/api/spend?path=full&weeks=12&units=runs';
const TITLE = 'Estimated cost by week, by phase group';

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the spend…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the spend.")).toBeVisible();
  },
};

/** Empty: no group has a phase; the empty line, no table and no NaN. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: spendEmpty });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText('No spend by phase in this period.')).toBeVisible();
    await expect(canvas.queryByRole('region', { name: 'Spend by phase' })).toBeNull();
    await expect(canvasElement.textContent).not.toContain('NaN');
  },
};

/** Full: the stacked chart, its note and table view, the table, and the Units switch asking for sessions only. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: spendFull, [SESSIONS]: spendFull });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findByText(TITLE)).toBeVisible();
    await expect(canvas.getByRole('img')).toHaveAttribute(
      'aria-label',
      `${TITLE}: bars by week; the numbers are in the table below.`,
    );
    const note = canvas.getByText(/List-price estimates/);
    await expect(note).toHaveTextContent('Not counted: 4 units with no spend by phase (3 runs, 1 session)');
    await expect(note).toHaveTextContent('every week from Oct 4 is fully counted');
    await expect(note).toHaveTextContent("Spend on a model with no price isn't counted.");

    await userEvent.click(canvas.getByText('The chart as a table'));
    const weekly = within(within(canvasElement).getByRole('region', { name: 'Weekly spend' }));
    await expect(weekly.getByRole('columnheader', { name: 'Units not counted' })).toBeVisible();
    const first = weekly.getAllByRole('row')[1];
    await expect(within(first).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '$14.00',
      '$31.00',
      '$12.00',
      '$9.00',
      '$6.00',
      '$72.00',
      '3',
    ]);

    await expect(canvas.getByRole('region', { name: 'Spend by phase' })).toBeVisible();
    const switcher = within(canvas.getByRole('group', { name: 'Units' }));
    await expect(switcher.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(switcher.getByRole('button', { name: 'Sessions' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(SESSIONS));
  },
};

/** A path filter: sessions have no path, so the switch shows Runs, its other options disabled. */
export const PathFilter: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: spendFull, [FULL_PATH]: spendFull });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByText(TITLE);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(FULL_PATH));
    const switcher = within(canvas.getByRole('group', { name: 'Units' }));
    await expect(switcher.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
    await expect(switcher.getByRole('button', { name: 'All' })).toBeDisabled();
    await expect(switcher.getByRole('button', { name: 'Sessions' })).toBeDisabled();
    const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(([url]) => String(url));
    await expect(calls.some((url) => url.includes('units=sessions'))).toBe(false);
  },
};
