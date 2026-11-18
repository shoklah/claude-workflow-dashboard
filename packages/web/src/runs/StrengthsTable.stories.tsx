import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { cells, expectNoJoined, visibleTerms, visibleValues, width, openedRow } from '../test/table.ts';
import { runFull } from '../test/runs.ts';
import { StrengthsTable } from './StrengthsTable.tsx';

const meta = { component: StrengthsTable, decorators: [width(1000)] } satisfies Meta<typeof StrengthsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The full run's strengths and a wave's, numbered as the run page numbers them. */
const strengths = [
  ...runFull.strengths,
  { step: 'task_review' as const, task: null, wave: 'A', round: 0, category: 'conventions', summary: 'Both tasks follow the one key recipe' },
].map((strength, i) => ({ ...strength, id: `S${i + 1}` }));

/** Full: #, Summary and Category, one value per cell; a row opens to its step and task, a strength with no task
 * leaving it out, a wave's showing its wave; the table scrolls in its own region, a tab stop named "Strengths table". */
export const Full: Story = {
  args: { strengths, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const headers = canvas.getAllByRole('columnheader');
    await expect(headers.map((th) => th.textContent)).toEqual(['#', 'Summary', 'Category']);
    for (const th of headers) await expect(th).toBeVisible();
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(3);
    await expect(cells(rows[0])).toEqual(['S1', 'New page reuses the shared table and format helpers', 'Reuse and duplication']);
    await expect(cells(rows[1])).toEqual(['S2', 'Each view tested on both fixtures, null facts included', 'Tests']);
    await expectNoJoined(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Strengths table' })).toHaveAttribute('tabindex', '0');

    for (const name of ['S1', 'S2', 'S3']) await userEvent.click(canvas.getByRole('button', { name }));
    const opened = (name: string) => openedRow(canvas.getByRole('button', { name }));
    await expect(visibleTerms(opened('S1'))).toEqual(['Step', 'Task']);
    await expect(visibleValues(opened('S1'))).toEqual(['Task review', '3']);
    await expect(visibleTerms(opened('S2'))).toEqual(['Step']);
    await expect(visibleValues(opened('S2'))).toEqual(['Final review']);
    await expect(visibleValues(opened('S3'))).toEqual(['Task review', 'Wave A']);
  },
};

/** A strength with no summary shows the muted dash, read out as "not known". */
export const WithoutSummary: Story = {
  args: { strengths: [{ ...strengths[0], summary: null }], categoryLabels: runFull.categoryLabels },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('not known')).toHaveClass('sr-only');
  },
};

/** No strength: one muted row across the three columns says so. */
export const Empty: Story = {
  args: { strengths: [], categoryLabels: runFull.categoryLabels },
  play: async ({ canvas }) => {
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(1);
    const cell = canvas.getByRole('cell', { name: 'No strengths.' });
    await expect(cell).toHaveAttribute('colspan', '3');
    await expect(cell).toHaveClass('text-muted-foreground');
  },
};
