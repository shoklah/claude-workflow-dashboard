import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { emptyHome, fullHome } from '../test/home.ts';
import { WeeklyCharts } from './WeeklyCharts.tsx';

const meta = { component: WeeklyCharts } satisfies Meta<typeof WeeklyCharts>;
export default meta;
type Story = StoryObj<typeof meta>;

const NOTE = /show what was stored; the reporter can no longer read them/;

/** Empty: twelve weeks of nothing, no coverage known, so no note. */
export const Empty: Story = {
  args: { charts: emptyHome.charts, coverageFrom: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Findings by week, by step' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Cost by week ($)' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Warnings by week' })).toBeVisible();
    await expect(canvas.queryByText(NOTE)).toBeNull();
    // The findings chart has its own row; the cost and warnings charts share the grid under it.
    const findings = canvas.getByRole('region', { name: 'Findings by week, by step' });
    const cost = canvas.getByRole('region', { name: 'Cost by week ($)' });
    const grid = cost.parentElement!;
    await expect(grid).toHaveClass('grid');
    await expect([...grid.children]).toEqual([cost, canvas.getByRole('region', { name: 'Warnings by week' })]);
    await expect(grid.contains(findings)).toBe(false);
    await expect(findings.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  },
};

/** Full: the reporter's coverage starts after the first charted week, so the page says so. */
export const Full: Story = {
  args: { charts: fullHome.charts, coverageFrom: fullHome.coverageFrom },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText(NOTE)).toHaveTextContent(
      'Weeks before Oct 5 show what was stored; the reporter can no longer read them.',
    );
    await expect(canvas.getAllByRole('img')).toHaveLength(3);

    // The table view carries every number, so no value hangs on a color alone.
    // A disclosure, closed until opened.
    const summary = canvas.getByText('The charts as a table');
    await expect(summary.tagName).toBe('SUMMARY');
    await expect(summary.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(summary);
    await expect(summary.closest('details')).toHaveAttribute('open');
    const table = within(canvas.getByRole('table'));
    await expect(table.getByRole('columnheader', { name: 'Cost ($)' })).toHaveClass('text-right', 'tabular-nums');
    await expect(table.getAllByRole('row')).toHaveLength(13);
    const lastWeek = table.getAllByRole('row').at(-1)!;
    await expect(within(lastWeek).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '5', '3', '9', '0', '6', '5', '1', '0', '21.00', '12',
    ]);
    const firstWeek = table.getAllByRole('row')[1];
    await expect(within(firstWeek).getAllByRole('cell').at(-2)).toHaveTextContent('–not known');
  },
};

/** Coverage from inside the first charted week: every charted week is the reporter's, so no note. */
export const CoveredFromTheFirstWeek: Story = {
  args: { charts: fullHome.charts, coverageFrom: '2026-08-25T10:00:00Z' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Cost by week ($)' })).toBeVisible();
    await expect(canvas.queryByText(NOTE)).toBeNull();
  },
};
