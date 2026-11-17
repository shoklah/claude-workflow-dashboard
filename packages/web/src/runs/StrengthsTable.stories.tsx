import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { NONE } from '../lib/format.ts';
import { cells, expectNoJoined } from '../test/table.ts';
import { runFull } from '../test/runs.ts';
import { StrengthsTable } from './StrengthsTable.tsx';

const meta = { component: StrengthsTable } satisfies Meta<typeof StrengthsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The full run's strengths and a wave's, numbered as the run page numbers them. */
const strengths = [
  ...runFull.strengths,
  { step: 'task_review' as const, task: null, wave: 'A', round: 0, category: 'conventions', summary: 'Both tasks follow the one key recipe' },
].map((strength, i) => ({ ...strength, id: `S${i + 1}` }));

/** Full: five columns, one value per cell; a strength with no task shows the dash, a wave's its wave; the table scrolls
 * in its own region, a tab stop named "Strengths table". */
export const Full: Story = {
  args: { strengths, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['#', 'Step', 'Task', 'Category', 'Summary']);
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(3);
    await expect(cells(rows[0])).toEqual(['S1', 'Task review', '3', 'Reuse and duplication', 'New page reuses the shared table and format helpers']);
    await expect(cells(rows[1])).toEqual(['S2', 'Final review', `${NONE}no task`, 'Tests', 'Each view tested on both fixtures, null facts included']);
    await expect(cells(rows[2])[2]).toBe('Wave A');
    await expectNoJoined(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Strengths table' })).toHaveAttribute('tabindex', '0');
  },
};

/** A strength with no summary shows the muted dash, read out as "not known". */
export const WithoutSummary: Story = {
  args: { strengths: [{ ...strengths[0], summary: null }], categoryLabels: runFull.categoryLabels },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('not known')).toHaveClass('sr-only');
  },
};

/** No strength: one muted row across the five columns says so. */
export const Empty: Story = {
  args: { strengths: [], categoryLabels: runFull.categoryLabels },
  play: async ({ canvas }) => {
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(1);
    const cell = canvas.getByRole('cell', { name: 'No strengths.' });
    await expect(cell).toHaveAttribute('colspan', '5');
    await expect(cell).toHaveClass('text-muted-foreground');
  },
};
