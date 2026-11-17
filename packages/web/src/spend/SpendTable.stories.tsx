import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { spendEmpty, spendFull, spendUnknownPhase } from '../test/spend.ts';
import { SpendTable } from './SpendTable.tsx';
import { cells, expectNoJoined } from '../test/table.ts';

const meta = { component: SpendTable } satisfies Meta<typeof SpendTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const table = (canvas: HTMLElement) => within(within(canvas).getByRole('region', { name: 'Spend by phase' }));
/**
 * Full: "All phases" first, then the five groups, a group of several phases opening to its phases' rows (its toggle a
 * button with a chevron), one column per model under "By model ($)" (the unpriced one a dash), then the advisor's,
 * counted apart.
 */
export const Full: Story = {
  args: { response: spendFull },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const spend = table(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'By phase, over the period' })).toBeVisible();
    await expect(spend.getByText('Review and cleanup')).toBeVisible();
    await expect(spend.queryByText('Task review', { exact: true })).toBeNull();
    await expect(spend.queryByRole('button', { name: /Implement/ })).toBeNull();
    await expect(spend.queryByRole('button', { name: /Coordination/ })).toBeNull();

    await expect(spend.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Phase',
      'Est. cost ($)',
      'Share',
      'By model ($)',
      'Advisor, counted apart',
      'Opus 5.5',
      'Fable 5.2',
      'Haiku 5.5',
      'Nova 1',
      'Calls',
      'Cost ($)',
    ]);
    const rows = spend.getAllByRole('row');
    await expect(cells(rows[2])).toEqual([
      'All phases',
      '763.00',
      '',
      '605.00',
      '152.00',
      '6.00',
      '–not known',
      '66',
      '38.00',
    ]);
    await expectNoJoined(rows[0].closest('table')!);

    const review = spend.getByRole('button', { name: 'Review and cleanup' });
    await expect(review).toHaveAttribute('aria-expanded', 'false');
    await expect(review.querySelector('svg')).not.toBeNull();
    await userEvent.click(review);
    await expect(review).toHaveAttribute('aria-expanded', 'true');
    await expect(spend.getByText('Task review', { exact: true })).toBeVisible();
    await expect(spend.getByText('Fix-check', { exact: true })).toBeVisible();
    await expect(spend.getAllByRole('row')).toHaveLength(rows.length + 5);
  },
};

/** Empty: the five groups at 0.00, none opens, and no model column. */
export const Empty: Story = {
  args: { response: spendEmpty },
  play: async ({ canvasElement }) => {
    const spend = table(canvasElement);
    await expect(spend.getAllByText('0.00').length).toBeGreaterThanOrEqual(5);
    await expect(spend.queryAllByRole('button')).toHaveLength(0);
    await expect(spend.queryByRole('columnheader', { name: 'By model ($)' })).toBeNull();
    for (const name of ['All phases', 'Plan', 'Implement', 'Review and cleanup', 'Coordination', 'Unattributed']) {
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
    await expect(spend.getByText('Deploy check', { exact: true })).toBeVisible();
  },
};
