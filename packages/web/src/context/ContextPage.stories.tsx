import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
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
const TITLES = [
  'Mean context per call (tokens)',
  'Largest context (tokens)',
  'Runs and sessions over the cap',
  'Read share of tool results',
  'Sweeps',
];
/** A palette slot's colour as the theme resolves it, lower case. */
const slot = (n: number) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--series-${n}`).trim().toLowerCase();
/** The fill colours drawn in a chart, lower case. */
const fills = (chart: HTMLElement) =>
  new Set([...chart.querySelectorAll('[fill]')].map((mark) => mark.getAttribute('fill')!.toLowerCase()));

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the context…')).toBeVisible();
    await expect(canvas.getByText('Loading the context…').closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the context.")).toBeVisible();
    await expect(canvas.getByText("Couldn't load the context.").closest('.glass')).not.toBeNull();
  },
};

/** The "All" fetch fails: the error line, and the Show switch still there to go back over the cap. */
export const AllFailed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: contextFull, [ALL]: 500 });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Refactor the sync queue')).toBeVisible();
    const show = () => within(canvas.getByRole('group', { name: 'Show' }));
    await userEvent.click(show().getByRole('button', { name: 'All' }));
    await expect(await canvas.findByText("Couldn't load the context.")).toBeVisible();
    await userEvent.click(show().getByRole('button', { name: 'Over the cap' }));
    await expect(await canvas.findByText('Refactor the sync queue')).toBeVisible();
  },
};

/** Empty: twelve weeks of nothing; the list's empty line, the uncounted line, and every unknown figure a dash. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: contextEmpty });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findByText('No runs or sessions past the cap in this period.')).toBeVisible();
    await userEvent.click(canvas.getByText('How context is counted'));
    await expect(canvas.getByText('Not counted: 1 run and 0 sessions with no context facts.')).toBeVisible();
    await userEvent.click(canvas.getByText('The charts as a table'));
    const rows = weekly(canvasElement).getAllByRole('row');
    await expect(rows).toHaveLength(14);
    const newest = cells(rows[2]);
    await expect([newest[2], newest[3], newest[12]]).toEqual(['–not known', '–not known', '–not known']);
    await expect(canvasElement.textContent).not.toContain('NaN');
  },
};

/**
 * Full: the last 12 weeks, over the cap by default; five charts, the cap drawn on two, the weekly table newest first,
 * the units with the most calls past the cap first, and the "Show" switch's "All" asking for every unit.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [OVER]: contextFull, [ALL]: contextAll });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findAllByRole('img')).toHaveLength(5);
    await expect(canvas.getAllByRole('heading', { level: 2 }).slice(0, 5).map((h) => h.textContent)).toEqual(TITLES);
    for (const title of TITLES) await expect(canvas.getByRole('img', { name: new RegExp(`^${title.replace(/[()]/g, '\\$&')}:`) })).toBeVisible();
    await waitFor(() => expect(canvas.getAllByText('cap 300K')).toHaveLength(2));
    const sweeps = canvas.getByRole('img', { name: /^Sweeps:/ });
    await waitFor(() => expect(fills(sweeps)).toContain(slot(1)));
    await expect(fills(sweeps)).toContain(slot(3));
    await expect(fills(sweeps)).not.toContain(slot(2));
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('12');

    for (const summary of ['The charts as a table', 'How context is counted']) {
      await expect(canvas.getByText(summary).tagName).toBe('SUMMARY');
    }
    await userEvent.click(canvas.getByText('How context is counted'));
    await expect(
      canvas.getByText(
        "Context is a main call's input plus cache tokens, as the reporter counts it. A week sums its runs, by finish, and its sessions, by start. The dashed line is the context cap, 300K: the app's default until the reporter exports its own.",
      ),
    ).toBeVisible();
    await expect(canvas.getByText('Not counted: 3 runs and 0 sessions with no context facts.')).toBeVisible();

    await userEvent.click(canvas.getByText('The charts as a table'));
    const rows = weekly(canvasElement).getAllByRole('row');
    await expect(weekly(canvasElement).getByText('Tool results (characters)')).toBeInTheDocument();
    await expect(weekly(canvasElement).getByText('Context (tokens)')).toBeInTheDocument();
    await expect(within(rows[2]).getByRole('rowheader')).toHaveTextContent('Nov 8');
    await expect(cells(rows[2])).toEqual([
      '19', '1,580', '247.0K', '744.0K', '11', '706.0K', '497.0K', '221.0K', '166.0K', '88.0K', '99.0K', '33.0K', '39', '18', '9',
    ]);
    for (const row of rows) {
      for (const cell of within(row).queryAllByRole('cell')) await expect(cell.textContent).not.toContain(' · ');
    }

    const units = within(canvas.getByRole('region', { name: 'Runs and sessions' })).getAllByRole('row');
    await expect(units[2]).toHaveTextContent('Refactor the sync queue');

    const group = canvas.getByRole('group', { name: 'Show' });
    await expect(group).toHaveTextContent(/^Show/);
    const switcher = within(group);
    await expect(switcher.getAllByRole('button').map((b) => b.textContent)).toEqual(['Over the cap', 'All']);
    await expect(switcher.getByRole('button', { name: 'Over the cap' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(switcher.getByRole('button', { name: 'All' }));
    await expect(fetch).toHaveBeenCalledWith(ALL);
    await expect(
      await within(canvas.getByRole('region', { name: 'Runs and sessions' })).findAllByRole('row'),
    ).toHaveLength(6);
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
