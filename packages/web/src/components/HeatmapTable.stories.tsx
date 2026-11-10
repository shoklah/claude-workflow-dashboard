import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { HeatmapTable } from './HeatmapTable.tsx';

const WEEKS = ['2026-10-25', '2026-11-01', '2026-11-08'];

const meta = {
  component: HeatmapTable,
  args: { label: 'Things by kind and week', corner: 'Kind', weeks: WEEKS, groups: [], max: 0, selected: null, onSelect: fn() },
} satisfies Meta<typeof HeatmapTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: no rows, so only the weeks' header, in its named scrolling region. */
export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Kind',
      'Oct 25',
      'Nov 1',
      'Nov 8',
    ]);
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.getByRole('region', { name: 'Things by kind and week' })).toHaveAttribute('tabindex', '0');
  },
};

/**
 * Full: a group under its full-width heading, then one without; each cell a button with its number written in it (an
 * unknown value as a dash), shaded against `max`, and the selected one pressed.
 */
export const Full: Story = {
  args: {
    max: 4,
    groups: [
      {
        heading: 'First group',
        rows: [
          { id: 'alpha', name: 'alpha', header: 'alpha', values: [0, 1, 4] },
          { id: 'beta', name: 'beta', header: 'beta', values: [2, 0, null] },
        ],
      },
      { heading: null, rows: [{ id: 'gamma', name: 'gamma', header: <i>gamma</i>, values: [0, 0, 1] }] },
    ],
    selected: { id: 'alpha', week: '2026-11-08' },
  },
  play: async ({ args, canvas, userEvent }) => {
    const heading = canvas.getByText('First group');
    await expect(heading).toHaveAttribute('colspan', '4');
    await expect(canvas.getAllByRole('rowheader').map((th) => th.textContent)).toEqual([
      'First group',
      'alpha',
      'beta',
      'gamma',
    ]);
    const beta = within(canvas.getByRole('rowheader', { name: 'beta' }).closest('tr')!);
    await expect(beta.getAllByRole('button').map((b) => b.textContent)).toEqual(['2', '0', '–']);
    // The darkest step for `max`, a grey for 0 and for an unknown value.
    const top = canvas.getByRole('button', { name: 'alpha, week of Nov 8: 4' });
    await expect(top).toHaveClass('bg-[#184f95]');
    await expect(top).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'alpha, week of Nov 1: 1' })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getByRole('button', { name: 'beta, week of Nov 8: –' })).toHaveClass('bg-[#f0efec]');
    await userEvent.click(canvas.getByRole('button', { name: 'gamma, week of Nov 8: 1' }));
    await expect(args.onSelect).toHaveBeenCalledWith({ id: 'gamma', week: '2026-11-08' });
  },
};

/** A value format: a share as a whole percent. */
export const Percent: Story = {
  args: {
    max: 100,
    groups: [{ heading: null, rows: [{ id: 'alpha', name: 'alpha', header: 'alpha', values: [null, 50, 100] }] }],
    format: (value) => (value === null ? '–' : `${value}%`),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('button').map((b) => b.textContent)).toEqual(['–', '50%', '100%']);
  },
};
