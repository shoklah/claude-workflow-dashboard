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
    await expect(canvas.getByRole('heading', { name: 'Cost by week' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Warnings by week' })).toBeVisible();
    await expect(canvas.queryByText(NOTE)).toBeNull();
  },
};

/** Full: the reporter's coverage starts after the first charted week, so the page says so. */
export const Full: Story = {
  args: { charts: fullHome.charts, coverageFrom: fullHome.coverageFrom },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText(NOTE)).toHaveTextContent(
      'Weeks before Oct 5, 2026 show what was stored; the reporter can no longer read them.',
    );
    await expect(canvas.getAllByRole('img')).toHaveLength(3);

    // The table view carries every number, so no value hangs on a color alone.
    await userEvent.click(canvas.getByText('The charts as a table'));
    const table = within(canvas.getByRole('table'));
    await expect(table.getAllByRole('row')).toHaveLength(13);
    const lastWeek = table.getAllByRole('row').at(-1)!;
    await expect(within(lastWeek).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      '5', '3', '9', '0', '6', '5', '1', '$21.00', '12',
    ]);
    const firstWeek = table.getAllByRole('row')[1];
    await expect(within(firstWeek).getAllByRole('cell').at(-2)).toHaveTextContent('–');
  },
};

/** Coverage from inside the first charted week: every charted week is the reporter's, so no note. */
export const CoveredFromTheFirstWeek: Story = {
  args: { charts: fullHome.charts, coverageFrom: '2026-08-25T10:00:00Z' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Cost by week' })).toBeVisible();
    await expect(canvas.queryByText(NOTE)).toBeNull();
  },
};
