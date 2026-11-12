import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { spendEmpty, spendFull, spendUnknownPhase } from '../test/spend.ts';
import { SpendTable } from './SpendTable.tsx';

const meta = { component: SpendTable } satisfies Meta<typeof SpendTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const table = (canvas: HTMLElement) => within(within(canvas).getByRole('region', { name: 'Spend by phase' }));

/**
 * Full: the five groups, a group of several phases opening to its phases' rows, one column per model under "By model"
 * (the unpriced one a dash), then the advisor's, counted apart.
 */
export const Full: Story = {
  args: { response: spendFull },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const spend = table(canvasElement);
    await expect(canvas.getByText('By phase, over the period')).toBeVisible();
    await expect(spend.getByText('Review and cleanup')).toBeVisible();
    await expect(spend.queryByText('task review', { exact: true })).toBeNull();
    await expect(spend.queryByRole('button', { name: /Implement/ })).toBeNull();
    await expect(spend.queryByRole('button', { name: /Coordination/ })).toBeNull();

    const review = spend.getByRole('button', { name: 'Review and cleanup' });
    await expect(review).toHaveAttribute('aria-expanded', 'false');
    const before = spend.getAllByRole('row').length;
    await userEvent.click(review);
    await expect(review).toHaveAttribute('aria-expanded', 'true');
    await expect(spend.getByText('task review', { exact: true })).toBeVisible();
    await expect(spend.getAllByRole('row')).toHaveLength(before + 5);

    await expect(spend.getByRole('columnheader', { name: 'By model' })).toBeVisible();
    const headers = spend.getAllByRole('columnheader').map((header) => header.textContent);
    await expect(headers.slice(headers.indexOf('Share') + 1)).toEqual([
      'claude-opus-5-5',
      'claude-fable-5-2',
      'claude-haiku-5-5',
      'claude-nova-1',
      'Calls',
      'Cost',
    ]);
    await expect(spend.getByRole('columnheader', { name: 'Advisor, counted apart' })).toBeVisible();
    const total = spend.getByText('Total').closest('tr') as HTMLElement;
    await expect(within(total).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Total',
      '$763.00',
      '',
      '$605.00',
      '$152.00',
      '$6.00',
      '–',
      '66',
      '$38.00',
    ]);
  },
};

/** Empty: the five groups at $0, none opens, and no model column. */
export const Empty: Story = {
  args: { response: spendEmpty },
  play: async ({ canvasElement }) => {
    const spend = table(canvasElement);
    await expect(spend.getAllByText('$0.00').length).toBeGreaterThanOrEqual(5);
    await expect(spend.queryAllByRole('button')).toHaveLength(0);
    await expect(spend.queryByRole('columnheader', { name: 'By model' })).toBeNull();
    for (const name of ['Plan', 'Implement', 'Review and cleanup', 'Coordination', 'Unattributed']) {
      await expect(spend.getByText(name)).toBeVisible();
    }
  },
};

/** A group whose only phase is another name than its own (an unknown phase under Unattributed) still opens to it. */
export const UnknownPhase: Story = {
  args: { response: spendUnknownPhase },
  play: async ({ canvasElement, userEvent }) => {
    const spend = table(canvasElement);
    await expect(spend.queryByRole('button', { name: /Implement/ })).toBeNull();
    const unattributed = spend.getByRole('button', { name: 'Unattributed' });
    await expect(unattributed).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(unattributed);
    await expect(spend.getByText('deploy check', { exact: true })).toBeVisible();
  },
};
