import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HTML_TEXT, fullRun, oldRun, smallRun } from '../test/runs.ts';
import { cells, expectNoJoined } from '../test/table.ts';
import { RunsTable } from './RunsTable.tsx';

const meta = { component: RunsTable } satisfies Meta<typeof RunsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The list in a box of a set width. */
const width =
  (px: number): Decorator =>
  (Story) => (
    <div style={{ width: px }}>
      <Story />
    </div>
  );

/** The visible elements of one tag in a row, as text. */
const visible = (row: HTMLElement, tag: string) =>
  [...row.querySelectorAll<HTMLElement>(tag)].filter((el) => el.checkVisibility()).map((el) => el.textContent);
const visibleTerms = (row: HTMLElement) => visible(row, 'dt');

const EMPTY = 'No runs in this period. A run shows here once its record is written and imported.';

export const Empty: Story = {
  args: { runs: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.getByText(EMPTY)).toBeVisible();
  },
};

/** Full: one row per run, its branch linking to its page, one value per cell with the unit in the header; a record
 * from before steps says so in muted text and shows the dash for what it can't give. The other counts open under a
 * row, the ones not known left out. */
export const Full: Story = {
  args: { runs: [{ ...smallRun, minutes: 25.4 }, fullRun, oldRun] },
  decorators: [width(1000)],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const [head, ...rows] = canvas.getAllByRole('row');
    await expect(within(head).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Branch',
      'Project',
      'Path',
      'Finished',
      'Found',
      'Est. cost ($)',
      'Warnings',
    ]);
    for (const th of within(head).getAllByRole('columnheader')) await expect(th).toBeVisible();
    await expect(rows).toHaveLength(3);
    await expect(canvas.getByRole('region', { name: 'Runs table' })).toHaveAttribute('tabindex', '0');

    // Branch, Project, Path, Finished, Found, Cost, Warnings.
    const full = cells(rows[1]);
    await expect(within(rows[1]).getByRole('link', { name: 'feat/search' })).toHaveAttribute('href', `/runs/${fullRun.key}`);
    await expect(full[1]).toBe('atlas');
    await expect(full[2]).toBe('Full');
    await expect(full.slice(4)).toEqual(['6', '7.10', '1']);

    // Before steps: muted text, not a badge; what it can't give is the dash, read as "not known".
    const old = within(rows[2]);
    const mark = old.getByText('before steps');
    await expect(mark).toHaveClass('text-muted-foreground');
    const cost = rows[2].querySelectorAll('td')[5];
    await expect(cost).toHaveTextContent('–');
    await expect(within(cost).getByText('not known')).toBeInTheDocument();

    // One value per cell.
    await expectNoJoined(canvasElement);

    // The first run opens to its other counts; the time is whole minutes.
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${HTML_TEXT}` }));
    const opened = canvas.getAllByRole('row')[2];
    await expect(visibleTerms(opened)).toEqual(['Time (min)', 'Tasks', 'Waves', 'Closed findings', 'Stops']);
    await expect(visible(opened, 'dd')).toEqual(['25', '1', '0', '1', '0']);

    // A record from before steps knows none of them, so its opened row lists none.
    await userEvent.click(canvas.getByRole('button', { name: 'Details of feat/import' }));
    const oldOpened = canvas.getAllByRole('row').at(-1)!;
    await expect(visibleTerms(oldOpened)).toEqual([]);

    // Free text with HTML in it shows as text.
    await expect(canvas.getByRole('link', { name: HTML_TEXT })).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();
  },
};

/** Narrow: under 768 px the list keeps Branch, Found and Warnings; Project, Path, Finished and the cost open first
 * under a row. */
export const Narrow: Story = {
  args: { runs: [fullRun] },
  decorators: [width(375)],
  play: async ({ canvas, userEvent }) => {
    const head = canvas.getAllByRole('row')[0];
    for (const name of ['Branch', 'Found', 'Warnings'])
      await expect(within(head).getByRole('columnheader', { name })).toBeVisible();
    for (const name of ['Project', 'Path', 'Finished', 'Est. cost ($)'])
      await expect(within(head).getByText(name).closest('th')).not.toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Details of feat/search' }));
    await expect(visibleTerms(canvas.getAllByRole('row')[2])).toEqual([
      'Project',
      'Path',
      'Finished',
      'Est. cost ($)',
      'Time (min)',
      'Tasks',
      'Waves',
      'Closed findings',
      'Stops',
    ]);
  },
};

/** A run with no branch: its link shows the muted dash, read out as "no branch". */
export const NoBranch: Story = {
  args: { runs: [{ ...fullRun, branch: null }] },
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'no branch' });
    await expect(link).toHaveTextContent('–');
    await expect(link.querySelector('.text-muted-foreground')).not.toBeNull();
  },
};
