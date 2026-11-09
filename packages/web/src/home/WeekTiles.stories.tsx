import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { emptyWeek, fullHome } from '../test/home.ts';
import { WeekTiles } from './WeekTiles.tsx';

const meta = { component: WeekTiles } satisfies Meta<typeof WeekTiles>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: no runs this week or last; an unknown cost shows as a dash. */
export const EmptyWeek: Story = {
  args: { thisWeek: emptyWeek, lastWeek: emptyWeek },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Runs this week' })).toHaveTextContent(
      'Runs this week0small 0 · full 0 · plan 0last week 0',
    );
    await expect(canvas.getByRole('group', { name: 'Findings' })).toHaveTextContent(
      'Findings00 acted on · 0 open',
    );
    await expect(canvas.getByRole('group', { name: 'Est. cost' })).toHaveTextContent('Est. cost–– a run');
    await expect(canvas.getByRole('group', { name: 'Warnings' })).toHaveTextContent('Warnings00 new');
  },
};

/** Full: each tile this week's number, its split, and last week's number. */
export const FullWeek: Story = {
  args: { thisWeek: fullHome.thisWeek, lastWeek: fullHome.lastWeek },
  play: async ({ canvas }) => {
    const runs = within(canvas.getByRole('group', { name: 'Runs this week' }));
    await expect(runs.getByText('6')).toBeVisible();
    await expect(runs.getByText('small 3 · full 2 · plan 1')).toBeVisible();
    await expect(runs.getByText('last week 8')).toBeVisible();

    const findings = within(canvas.getByRole('group', { name: 'Findings' }));
    await expect(findings.getByText('19')).toBeVisible();
    await expect(findings.getByText('13 acted on · 1 open')).toBeVisible();
    await expect(findings.getByText('last week 15')).toBeVisible();

    const cost = within(canvas.getByRole('group', { name: 'Est. cost' }));
    await expect(cost.getByText('$21.00')).toBeVisible();
    await expect(cost.getByText('$3.50 a run')).toBeVisible();
    await expect(cost.getByText('last week $27.25')).toBeVisible();

    const warnings = within(canvas.getByRole('group', { name: 'Warnings' }));
    await expect(warnings.getByText('12')).toBeVisible();
    await expect(warnings.getByText('3 new')).toBeVisible();
    await expect(warnings.getByText('last week 9')).toBeVisible();
  },
};

/** A week whose runs have no priced cost: the cost and the cost a run are a dash, not $0. */
export const CostUnknown: Story = {
  args: { thisWeek: { ...fullHome.thisWeek, cost: null, costPerRun: null }, lastWeek: fullHome.lastWeek },
  play: async ({ canvas }) => {
    const cost = within(canvas.getByRole('group', { name: 'Est. cost' }));
    await expect(cost.getByText('–')).toBeVisible();
    await expect(cost.getByText('– a run')).toBeVisible();
    await expect(cost.getByText('last week $27.25')).toBeVisible();
    await expect(cost.queryByText(/\$0/)).toBeNull();
  },
};
