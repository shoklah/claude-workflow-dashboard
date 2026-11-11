import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { contextAll, contextEmpty, contextFull, contextHidden } from '../test/context.ts';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { ContextPage } from './ContextPage.tsx';

const meta = { component: ContextPage } satisfies Meta<typeof ContextPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };
const OVER = '/api/context?weeks=12&over=1';
const ALL = '/api/context?weeks=12';

const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent);
const weekly = (canvas: HTMLElement) => within(within(canvas).getByRole('region', { name: 'Weekly context' }));

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the context…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the context.")).toBeVisible();
  },
};

/** Empty: twelve weeks of nothing; the list's empty line, the uncounted line, and every unknown figure a dash. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: contextEmpty });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findByText('No runs or sessions past the cap in this period.')).toBeVisible();
    await userEvent.click(canvas.getByText('The charts as a table'));
    await expect(canvas.getByText(/Not counted: 1 run and 0 sessions with no context facts\./)).toBeVisible();
    const rows = weekly(canvasElement).getAllByRole('row');
    await expect(rows).toHaveLength(14);
    const newest = cells(rows[2]);
    await expect([newest[2], newest[3], newest[12]]).toEqual(['–', '–', '–']);
    await expect(canvasElement.textContent).not.toContain('NaN');
  },
};

/**
 * Full: the last 12 weeks, over the cap by default; five charts, the cap drawn on two, the weekly table newest first,
 * the units with the most calls past the cap first, and "All" asking for every unit.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: contextFull, [ALL]: contextAll });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findAllByRole('img')).toHaveLength(5);
    await expect(canvas.getAllByText('cap 300K')).toHaveLength(2);
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('12');
    await expect(
      canvas.getByText(
        "Context is a main call's input plus cache tokens, as the reporter counts it. A week sums its runs, by finish, and its sessions, by start. Not counted: 3 runs and 0 sessions with no context facts. The dashed line is the context cap, 300K: the app's default until the reporter exports its own.",
      ),
    ).toBeVisible();

    await userEvent.click(canvas.getByText('The charts as a table'));
    const rows = weekly(canvasElement).getAllByRole('row');
    await expect(weekly(canvasElement).getByText('Tool-result characters')).toBeInTheDocument();
    await expect(within(rows[2]).getByRole('rowheader')).toHaveTextContent('Nov 8');
    await expect(cells(rows[2])).toEqual([
      '19', '1580', '247K', '744K', '11', '706K', '497K', '221K', '166K', '88K', '99K', '33K', '39%', '18', '9',
    ]);

    const units = within(canvas.getByRole('region', { name: 'Runs and sessions' })).getAllByRole('row');
    await expect(units[1]).toHaveTextContent('Refactor the sync queue');

    await userEvent.click(within(canvas.getByRole('group', { name: 'Units' })).getByRole('button', { name: 'All' }));
    await expect(fetch).toHaveBeenCalledWith(ALL);
    await expect(
      await within(canvas.getByRole('region', { name: 'Runs and sessions' })).findAllByRole('row'),
    ).toHaveLength(5);
  },
};

/** Showing mode on: no session ID, and the units of other projects only counted, under the list. */
export const Showing: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: contextHidden });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Refactor the sync queue')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Copy session ID' })).toBeNull();
    await expect(canvas.getByText('+ 2 rows in other projects, counted in totals and charts only')).toBeVisible();
  },
};
