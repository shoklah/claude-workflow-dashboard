import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { stepsEmpty, stepsFull, stepsOldReporter } from '../test/steps.ts';
import { StepsPage } from './StepsPage.tsx';
import { cells, expectNoJoined } from '../test/table.ts';

const meta = { component: StepsPage } satisfies Meta<typeof StepsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };
const ERROR = "Couldn't load the steps and rules. Check that the dashboard server is running, then refresh.";
// An unknown value's text: the muted dash and its spoken words.
const DASH = '–not known';

/** The table named `name`, inside its scrolling region. */
const table = async (canvasElement: HTMLElement, name: string) =>
  within(await within(canvasElement).findByRole('region', { name }));

/** A step's or rule's rows: the row its header heads, then the lines its header spans. */
function rowsOf(header: HTMLElement): HTMLElement[] {
  const first = header.closest('tr')!;
  const rows: HTMLElement[] = [first];
  for (let i = 1; i < (header as HTMLTableCellElement).rowSpan; i++) rows.push(rows[i - 1].nextElementSibling as HTMLElement);
  return rows;
}

/** A step's or rule's count lines, each its name and number: the first line's after Ran and Found something. */
const linesOf = (header: HTMLElement) => rowsOf(header).map((row, i) => (i === 0 ? cells(row).slice(2, 4) : cells(row)));

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the steps and rules…')).toBeVisible();
    await expect(canvas.getByText('Loading the steps and rules…').closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(ERROR)).toBeVisible();
    await expect(canvas.getByText(ERROR).closest('.glass')).not.toBeNull();
  },
};

/** Empty: every step kind with nothing run, no offers, refusals, sessions or advisor calls. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': stepsEmpty });
  },
  play: async ({ canvas, canvasElement }) => {
    const steps = await table(canvasElement, 'Steps table');
    const rules = await table(canvasElement, 'Rules table');
    const review = await steps.findByRole('rowheader', { name: 'Task review' });
    await expect(rowsOf(review)).toHaveLength(1);
    await expect(cells(review.closest('tr')!)).toEqual(['0', '0', 'No counts', '0', '0', '0', '0', '0.0', DASH]);
    // Simplify's spend isn't known.
    await expect(cells(steps.getByRole('rowheader', { name: 'Simplify' }).closest('tr')!).slice(-2)).toEqual([DASH, DASH]);
    await expect(rules.queryByRole('rowheader', { name: /^Offer/ })).toBeNull();
    const startup = rules.getByRole('rowheader', { name: 'Startup guidelines' });
    await expect(cells(startup.closest('tr')!).slice(0, 2)).toEqual(['0', DASH]);
    await expect(linesOf(startup)).toEqual([
      ['Sessions with them', '0'],
      ['Sessions without', '0'],
    ]);
    const guard = rules.getByRole('rowheader', { name: 'Dispatch guard' });
    await expect(cells(guard.closest('tr')!)).toEqual([DASH, '0', 'No counts', DASH]);
    await expectNoJoined(canvasElement);
    await expect(canvas.queryByText('reporter, all time')).toBeNull();
  },
};

/** Full: two tables, Steps then Rules, each count on its own line; every figure is the period's sum. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': stepsFull });
  },
  play: async ({ canvas, canvasElement }) => {
    const steps = await table(canvasElement, 'Steps table');
    const rules = await table(canvasElement, 'Rules table');
    const review = await steps.findByRole('rowheader', { name: 'Task review' });
    // Each table sits in a section, a region named by its title.
    for (const name of ['Steps', 'Rules']) {
      const section = within(canvas.getByRole('region', { name }));
      await expect(section.getByRole('heading', { name, level: 2 })).toBeVisible();
      await expect(section.getByRole('region', { name: `${name} table` })).toBeVisible();
    }
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    await expect(steps.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Step',
      'Ran',
      'Found something',
      'Counts',
      'Findings, by outcome',
      'Tokens',
      'Est. cost ($)',
      'Count',
      'Number',
      'Fixed or applied',
      'Declined',
      'Deferred',
      'Open or to owner',
    ]);
    await expect(rules.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Rule',
      'Ran',
      'Found something',
      'Counts',
      'Est. cost ($)',
      'Count',
      'Number',
    ]);

    // Three counts, three lines, each a name and a number; the row's other cells span them.
    await expect(linesOf(review)).toEqual([
      ['Critical', '1'],
      ['Important', '18'],
      ['Minor', '47'],
    ]);
    await expect(cells(review.closest('tr')!)).toEqual(['31', '22', 'Critical', '1', '24', '3', '38', '1', '9.8M', '21.40']);
    const step = (name: string) => steps.getByRole('rowheader', { name });
    await expect(cells(step('Plan review').closest('tr')!).at(-2)).toBe('2.0M');
    await expect(cells(step('Final fix-check').closest('tr')!).at(-2)).toBe('431.0K');
    await expect(linesOf(step('Final review')).at(-1)).toEqual(['Not required', '6']);
    // Simplify's model has no price: a dash, not 0.00.
    await expect(cells(step('Simplify').closest('tr')!).slice(-2)).toEqual([DASH, DASH]);

    const rule = (name: string) => rules.getByRole('rowheader', { name });
    await expect(cells(rule('Failing-test check').closest('tr')!)).toEqual(['27', DASH, 'Passed', '22', DASH]);
    await expect(linesOf(rule('Failing-test check'))).toEqual([
      ['Passed', '22'],
      ['Failed', '1'],
      ['No tests', '1'],
      ["Couldn't run", '2'],
      ['Exempt', '1'],
    ]);
    await expect(cells(rule('Dispatch guard').closest('tr')!)).toEqual([DASH, '3', 'No model', '2', DASH]);
    await expect(cells(rule('Advisor').closest('tr')!)).toEqual(['14', DASH, 'Notes', '12', '3.20']);
    await expect(linesOf(rule('Advisor'))).toEqual([
      ['Notes', '12'],
      ['Notes that changed something', '9'],
      ['Share of Fable spend (%)', '8'],
    ]);
    await expect(linesOf(rule('Fix-round cap'))).toEqual([
      ['Runs reaching round 3', '1'],
      ['Findings ruled', '2'],
    ]);
    await expect(cells(rule('Stop rule').closest('tr')!)).toEqual([DASH, DASH, 'Stops', '1', DASH]);
    await expect(cells(rule('Offer of grill-me').closest('tr')!).slice(0, 2)).toEqual(['3', DASH]);
    await expect(linesOf(rule('Offer of grill-me'))).toEqual([
      ['Accepted', '2'],
      ['Skipped', '1'],
      ['Not offered', '0'],
      ['Updated', '0'],
    ]);

    // No blank cell, nothing joined, and every figure is the period's sum.
    for (const cell of within(canvasElement).getAllByRole('cell')) await expect(cell.textContent).not.toBe('');
    await expectNoJoined(canvasElement);
    await expect(canvas.queryByText('reporter, all time')).toBeNull();
  },
};

/** An export from before CR6: its refusals, startup and advisor show as dashes, not as no counts. */
export const OldReporter: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': stepsOldReporter });
  },
  play: async ({ canvasElement }) => {
    const rules = await table(canvasElement, 'Rules table');
    const row = async (name: string) => (await rules.findByRole('rowheader', { name })).closest('tr')!;
    await expect(cells(await row('Dispatch guard'))).toEqual([DASH, DASH, DASH, DASH]);
    await expect(cells(await row('Advisor'))).toEqual([DASH, DASH, DASH, DASH]);
    await expect(cells(await row('Startup guidelines'))).toEqual([DASH, DASH, DASH, DASH]);
  },
};

/** The path, project and period filters go to the API as query params. */
export const Filters: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      ...projects,
      '/api/steps?weeks=4': stepsFull,
      '/api/steps?path=full&weeks=4': stepsFull,
      '/api/steps?path=full&weeks=12': stepsFull,
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('rowheader', { name: 'Task review' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '12');
    await expect(fetch).toHaveBeenCalledWith('/api/steps?path=full&weeks=12');
  },
};
