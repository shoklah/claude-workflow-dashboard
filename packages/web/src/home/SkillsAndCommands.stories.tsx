import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { emptyUsage, fullUsage } from '../test/home.ts';
import { SkillsAndCommands } from './SkillsAndCommands.tsx';
import { cells, expectNoJoined } from '../test/table.ts';

const meta = { component: SkillsAndCommands } satisfies Meta<typeof SkillsAndCommands>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: no sessions or runs in either period; the table says so. */
export const Empty: Story = {
  args: { usage: { thisWeek: emptyUsage, lastFourWeeks: emptyUsage } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Skills and commands' })).toBeVisible();
    await expect(canvas.getByText('0 sessions and 0 runs')).toBeVisible();
    await expect(canvas.getByText('No skill loaded and no command typed in this period.')).toBeVisible();
  },
};

/** Full: this week's rows as in the mockup, a plain number per cell, then the last four weeks' through the switch. */
export const Full: Story = {
  args: { usage: fullUsage },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'Skills and commands' })).toBeVisible();
    const period = within(canvas.getByRole('group', { name: 'Period' }));
    await expect(period.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText('23 sessions and 6 runs')).toBeVisible();
    // The counts are numeric columns, "Typed, never loaded" too.
    for (const name of ['Sessions', 'Runs', 'Typed', 'Typed, never loaded']) {
      await expect(canvas.getByRole('columnheader', { name })).toHaveClass('text-right', 'tabular-nums');
    }
    await expect(cells(canvas.getByRole('row', { name: /^brainstorming/ }))).toEqual(['brainstorming', '35%', '8', '2', '1', '0']);
    // A command no skill has: no runs and no never-loaded count, each the dash read out as not known.
    await expect(cells(canvas.getByRole('row', { name: /^\/model/ }))).toEqual([
      '/model',
      '30%',
      '7',
      '–not known',
      '9',
      '–not known',
    ]);
    await expect(cells(canvas.getByRole('row', { name: /^grill-me/ })).at(-1)).toBe('2');
    await expectNoJoined(canvasElement);

    await userEvent.click(period.getByRole('button', { name: 'Last 4 weeks' }));
    await expect(period.getByRole('button', { name: 'Last 4 weeks' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText('81 sessions and 22 runs')).toBeVisible();
    await expect(canvas.getByRole('row', { name: /^\/superpowers:write-plan/ })).toBeVisible();
    await expect(cells(canvas.getByRole('row', { name: /^\/model/ }))[2]).toBe('30');
  },
};
