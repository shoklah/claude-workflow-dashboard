import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HTML_TEXT, fullRun, oldRun, smallRun } from '../test/runs.ts';
import { RunsTable } from './RunsTable.tsx';

const meta = { component: RunsTable } satisfies Meta<typeof RunsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const EMPTY = 'No runs in this period. A run shows here once its record is written and imported.';

export const Empty: Story = {
  args: { runs: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.getByText(EMPTY)).toBeVisible();
  },
};

/** The cells of a body row, by column. */
function cells(row: HTMLElement): string[] {
  return [...row.querySelectorAll('td')].map((td) => td.textContent ?? '');
}

/** Full: one row per run, its branch linking to its page, one value per cell with the unit in the header; a record
 * from before steps says so in muted text and shows the dash for what it can't give. */
export const Full: Story = {
  args: { runs: [{ ...smallRun, minutes: 25.4 }, fullRun, oldRun] },
  play: async ({ canvas, canvasElement }) => {
    const [top, sub] = canvas.getAllByRole('row').slice(0, 2);
    await expect(within(top).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Branch',
      'Project',
      'Path',
      'Finished',
      'Time (min)',
      'Tasks',
      'Waves',
      'Findings',
      'Stops',
      'Est. cost ($)',
      'Warnings',
    ]);
    await expect(within(top).getByRole('columnheader', { name: 'Findings' })).toHaveAttribute('colspan', '2');
    await expect(within(sub).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Found', 'Closed']);

    const rows = canvas.getAllByRole('row').slice(2);
    await expect(rows).toHaveLength(3);
    // It scrolls sideways at a phone's width: its container is a named tab stop.
    await expect(canvas.getByRole('region', { name: 'Runs table' })).toHaveAttribute('tabindex', '0');

    // Branch, Project, Path, Finished, Time, Tasks, Waves, Found, Closed, Stops, Cost, Warnings.
    const full = cells(rows[1]);
    await expect(within(rows[1]).getByRole('link', { name: 'feat/search' })).toHaveAttribute('href', `/runs/${fullRun.key}`);
    await expect(full[1]).toBe('atlas');
    await expect(full[2]).toBe('Full');
    await expect(full.slice(4)).toEqual(['130', '4', '2', '6', '5', '0', '7.10', '1']);

    // The time is whole minutes.
    await expect(cells(rows[0])[4]).toBe('25');

    // Before steps: muted text, not a badge; what it can't give is the dash, read as "not known".
    const old = within(rows[2]);
    const mark = old.getByText('before steps');
    await expect(mark).toHaveClass('text-muted-foreground');
    await expect(mark.closest('[data-slot="badge"]')).toBeNull();
    const cost = rows[2].querySelectorAll('td')[10];
    await expect(cost).toHaveTextContent('–');
    await expect(within(cost).getByText('not known')).toBeInTheDocument();

    // One value per cell.
    for (const row of rows) for (const text of cells(row)) await expect(text).not.toContain(' · ');

    // Free text with HTML in it shows as text.
    await expect(canvas.getByRole('link', { name: HTML_TEXT })).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();
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
