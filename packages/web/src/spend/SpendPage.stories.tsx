import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { spendEmpty, spendFull, spendUncounted, spendUnpriced } from '../test/spend.ts';
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
const TITLE = 'Estimated cost by week, by phase group ($)';
const cells = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent);

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the spend…')).toBeVisible();
    await expect(canvas.getByText('Loading the spend…').closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the spend.")).toBeVisible();
    await expect(canvas.getByText("Couldn't load the spend.").closest('.glass')).not.toBeNull();
  },
};

/** Empty: no group has a phase; the empty state on its panel, no table and no NaN. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: spendEmpty });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText('No spend by phase in this period.')).toBeVisible();
    await expect(canvas.getByText('No spend by phase in this period.').closest('.glass')).not.toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Spend by phase' })).toBeNull();
    await expect(canvasElement.textContent).not.toContain('NaN');
  },
};

/** Empty, with uncounted units: the empty state says what wasn't counted. */
export const EmptyUncounted: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: spendUncounted });
  },
  play: async ({ canvas }) => {
    const line = await canvas.findByText(/No spend by phase in this period\./);
    await expect(line).toHaveTextContent(
      'No spend by phase in this period. Not counted: 2 units with no spend by phase (2 runs, 0 sessions).',
    );
  },
};

/** Every spend on an unpriced model: total 0.00, every share and model cell a dash, the table and the unpriced note. */
export const Unpriced: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, [ALL]: spendUnpriced });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(await canvas.findByText('How spend is counted'));
    await expect(canvas.getByText(/List-price estimates/)).toHaveTextContent(
      "Spend on a model with no price isn't counted.",
    );
    const spend = within(canvas.getByRole('region', { name: 'Spend by phase' }));
    await expect(spend.getByRole('columnheader', { name: 'Nova 1' })).toBeVisible();
    const rows = spend.getAllByRole('row').slice(2);
    for (const [i, row] of rows.entries()) {
      const [, cost, share, model] = cells(row);
      await expect(model).toBe('–not known');
      await expect(cost).toBe('0.00');
      // An unknown share is ShareBar's dash; the "All phases" row, first, has no share.
      await expect(share).toBe(i === 0 ? '' : '–');
    }
    await expect(canvasElement.textContent).not.toContain('NaN');
  },
};

/**
 * Full: the stacked chart, its table view, the table, the closed "How spend is counted" after it, and the Count switch
 * asking for sessions only.
 */
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

    await userEvent.click(canvas.getByText('The chart as a table'));
    const weekly = within(within(canvasElement).getByRole('region', { name: 'Weekly spend' }));
    const headers = weekly.getAllByRole('columnheader').map((header) => header.textContent);
    await expect(headers.slice(-2)).toEqual(['Total ($)', 'Runs and sessions not counted']);
    const first = weekly.getAllByRole('row')[1];
    await expect(cells(first)).toEqual(['14.00', '31.00', '12.00', '9.00', '6.00', '72.00', '3']);
    for (const row of weekly.getAllByRole('row')) {
      for (const cell of within(row).queryAllByRole('cell')) await expect(cell.textContent).not.toContain(' · ');
    }

    const table = canvas.getByRole('region', { name: 'Spend by phase' });
    await expect(table).toBeVisible();
    const how = canvas.getByText('How spend is counted');
    await expect(how.tagName).toBe('SUMMARY');
    await expect(how.closest('details')).not.toHaveAttribute('open');
    await expect(table.compareDocumentPosition(how) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(how);
    const note = canvas.getByText(/List-price estimates/);
    await expect(note).toHaveTextContent("Spend on a model with no price isn't counted.");
    await expect(
      canvas.getByText('Not counted: 4 units with no spend by phase (3 runs, 1 session); every week from Oct 4 is fully counted.'),
    ).toBeVisible();

    const group = canvas.getByRole('group', { name: 'Count' });
    await expect(group).toHaveTextContent(/^Count/);
    const switcher = within(group);
    await expect(switcher.getAllByRole('button').map((b) => b.textContent)).toEqual(['All', 'Runs', 'Sessions']);
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
    const switcher = within(canvas.getByRole('group', { name: 'Count' }));
    await expect(switcher.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
    await expect(switcher.getByRole('button', { name: 'All' })).toBeDisabled();
    await expect(switcher.getByRole('button', { name: 'Sessions' })).toBeDisabled();
    const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map(([url]) => String(url));
    await expect(calls.some((url) => url.includes('units=sessions'))).toBe(false);
  },
};
