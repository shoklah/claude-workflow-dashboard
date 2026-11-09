import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HTML_TEXT, runFull } from '../test/runs.ts';
import { FindingsTable } from './FindingsTable.tsx';

const meta = { component: FindingsTable } satisfies Meta<typeof FindingsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { findings: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No findings.')).toBeVisible();
  },
};

/** Full: every finding of the run, one row each, its free text shown as text. */
export const Full: Story = {
  args: { findings: runFull.findings },
  play: async ({ canvas, canvasElement }) => {
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers).toEqual(['#', 'Step', 'Task', 'Severity', 'Summary', 'Outcome', 'Reason', 'Verdicts']);
    await expect(canvas.getAllByRole('row')).toHaveLength(7);
    await expect(canvas.getByText(HTML_TEXT)).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();
    const outcomes = canvas.getByRole('combobox', { name: 'Outcome' });
    await expect([...outcomes.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'All',
      'applied',
      'deferred',
      'fixed',
      'open',
      'ruled',
    ]);
  },
};

/** Filtering by outcome `ruled` leaves the one ruled finding, with its reason. */
export const FilterRuled: Story = {
  args: { findings: runFull.findings },
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Outcome' }), 'ruled');
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(1);
    const row = within(rows[0]);
    await expect(row.getByText('F4')).toBeVisible();
    await expect(row.getByText('One index per run is intended')).toBeVisible();
    await expect(rows[0]).toHaveTextContent('open, open, open');
  },
};

/** Step and severity filter too, and together. */
export const FilterStepAndSeverity: Story = {
  args: { findings: runFull.findings },
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Step' }), 'task_review');
    await expect(canvas.getAllByRole('row').slice(1)).toHaveLength(4);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Severity' }), 'important');
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual(['F1', 'F4']);
  },
};
