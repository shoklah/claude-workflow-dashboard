import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';
import { emptyUsage, fullUsage } from '../test/home.ts';
import { SkillsAndCommands } from './SkillsAndCommands.tsx';

const meta = { component: SkillsAndCommands } satisfies Meta<typeof SkillsAndCommands>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: no sessions or runs in either period; the table says so. */
export const Empty: Story = {
  args: { usage: { thisWeek: emptyUsage, lastFourWeeks: emptyUsage } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Skills and commands' })).toBeVisible();
    await expect(canvas.getByText('0 sessions · 0 runs')).toBeVisible();
    await expect(canvas.getByText('No skill loaded and no command typed in this period.')).toBeVisible();
  },
};

/** Full: this week's rows as in the mockup, then the last four weeks' through the switch. */
export const Full: Story = {
  args: { usage: fullUsage },
  play: async ({ canvas }) => {
    const period = within(canvas.getByRole('group', { name: 'Period' }));
    await expect(period.getByRole('button', { name: 'This week' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText('23 sessions · 6 runs')).toBeVisible();
    const brainstorming = within(canvas.getByRole('row', { name: /^brainstorming/ }));
    await expect(brainstorming.getByText('35%')).toBeVisible();
    await expect(brainstorming.getByText('8 of 23')).toBeVisible();
    await expect(brainstorming.getByText('2 of 6')).toBeVisible();
    // A command no skill has: no runs and no never-loaded count.
    const model = within(canvas.getByRole('row', { name: /^\/model/ }));
    await expect(model.getAllByText('–')).toHaveLength(2);
    await expect(model.getByText('9')).toBeVisible();
    const grillMe = within(canvas.getByRole('row', { name: /^grill-me/ }));
    await expect(grillMe.getByText('2')).toBeVisible();

    await userEvent.click(period.getByRole('button', { name: 'Last 4 weeks' }));
    await expect(period.getByRole('button', { name: 'Last 4 weeks' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByText('81 sessions · 22 runs')).toBeVisible();
    await expect(canvas.getByRole('row', { name: /^\/superpowers:write-plan/ })).toBeVisible();
    await expect(within(canvas.getByRole('row', { name: /^\/model/ })).getByText('30 of 81')).toBeVisible();
  },
};
