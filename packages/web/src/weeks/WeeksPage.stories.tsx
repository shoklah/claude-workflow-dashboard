import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { weeksEmpty, weeksFull } from '../test/weeks.ts';
import { WeeksPage } from './WeeksPage.tsx';
import { cells, expectNoJoined } from '../test/table.ts';

const meta = { component: WeeksPage } satisfies Meta<typeof WeeksPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };
const CHARTS = ['Runs', 'Final review findings', 'Estimated cost ($)', 'Time per run (min)'];
const EMPTY = 'No runs in this period. A week fills once a run that finished in it is imported.';
const HEADERS = [
  'Week', 'Runs', 'Tasks', 'Final review findings', 'Fix rounds', 'Stops', 'Usage (points)', 'Est. cost ($)',
  'Time per run (min)', 'Later fix commits',
  'Small', 'Full', 'Plan', 'Critical', 'Important', 'Minor', 'Not required', 'Fable', 'All models',
];

const table = (canvas: HTMLElement, name: string) =>
  within(within(within(canvas).getByRole('region', { name })).getByRole('table'));
export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/weeks?weeks=12': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the weeks…')).toBeVisible();
    await expect(canvas.getByText('Loading the weeks…').closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/weeks?weeks=12': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the weeks.")).toBeVisible();
    await expect(canvas.getByText("Couldn't load the weeks.").closest('.glass')).not.toBeNull();
  },
};

/** Empty: twelve weeks of nothing, a line saying so, zeros muted, every unknown sum a dash, and no coverage note. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/weeks?weeks=12': weeksEmpty });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByText(EMPTY)).toBeVisible();
    const weeks = table(canvasElement, 'Weeks');
    // Two header rows and twelve weeks.
    await expect(weeks.getAllByRole('row')).toHaveLength(14);
    const row = weeks.getAllByRole('row')[2];
    const unknown = '–not known';
    await expect(cells(row)).toEqual([
      '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', unknown, unknown, unknown, unknown, '0',
    ]);
    // A zero is muted.
    for (const cell of within(row).getAllByRole('cell')) {
      await expect(cell.querySelector('.text-muted-foreground')).not.toBeNull();
    }
    await expect(cells(table(canvasElement, 'Full runs').getAllByRole('row')[1])).toEqual(['0', '0', unknown]);
    await expect(canvas.queryByText(/the reporter can no longer read them/)).toBeNull();
    await expectNoJoined(canvasElement);
  },
};

/**
 * Full: the last 12 weeks by default, four small multiples (one measure each, its unit in its title), the week table
 * as their table view, newest first with one value per cell, the Full runs' run time, and the coverage note.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/weeks?weeks=12': weeksFull });
  },
  play: async ({ canvas, canvasElement }) => {
    // The scroll region names the table, so the table has no name of its own.
    await expect(within(await canvas.findByRole('region', { name: 'Weeks' })).getByRole('table')).not.toHaveAccessibleName();
    const weeks = table(canvasElement, 'Weeks');
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('12');
    for (const title of CHARTS) await expect(canvas.getByRole('heading', { name: title })).toBeVisible();
    const charts = canvas.getAllByRole('img');
    await expect(charts).toHaveLength(4);
    // One chart per row at first, two across from sm, four from 2xl.
    const grid = charts[0].closest('section')!.parentElement!;
    await expect(grid).toHaveClass('sm:grid-cols-2', '2xl:grid-cols-4');

    await expect(canvas.getByRole('heading', { name: 'By week' })).toBeVisible();
    await expect(weeks.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(HEADERS);
    const [, , newest, previous] = weeks.getAllByRole('row');
    await expect(within(newest).getByRole('rowheader')).toHaveTextContent('Nov 8');
    await expect(cells(newest)).toEqual([
      '4', '2', '1', '12', '0', '3', '8', '0', '8', '0', '14', '7', '38.40', '140', '1',
    ]);
    // A duration is rounded to whole minutes.
    await expect(cells(previous).at(-2)).toBe('166');

    await expect(canvas.getByRole('heading', { name: 'Full runs, with and without waves' })).toBeVisible();
    const runTime = table(canvasElement, 'Full runs');
    await expect(runTime.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Kind', 'Runs', 'With a run time', 'Median time (min)',
    ]);
    await expect(runTime.getAllByRole('row').slice(1).map((row) => row.textContent)).toEqual([
      'With waves33150',
      'Without waves43185',
    ]);
    // The numeric columns, headers included, are right-aligned in tabular figures; the week and the kind aren't.
    const aligned = (cell: Element) => {
      const style = getComputedStyle(cell);
      return style.textAlign === 'right' && style.fontVariantNumeric === 'tabular-nums';
    };
    for (const row of weeks.getAllByRole('row').slice(2, 4)) {
      await expect([...row.children].map(aligned)).toEqual([false, ...Array(15).fill(true)]);
    }
    for (const row of runTime.getAllByRole('row').slice(0, 2)) {
      await expect([...row.children].map(aligned)).toEqual([false, true, true, true]);
    }

    await expect(canvas.getByText(/the reporter can no longer read them/)).toHaveTextContent(
      'Weeks before Oct 13 show what was stored; the reporter can no longer read them.',
    );
    await expect(canvas.queryByText(EMPTY)).toBeNull();
    await expectNoJoined(canvasElement);
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
    await canvas.findByRole('region', { name: 'Weeks' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '4');
    await expect(fetch).toHaveBeenCalledWith('/api/weeks?path=full&weeks=4');
  },
};
