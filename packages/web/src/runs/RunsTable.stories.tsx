import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HTML_TEXT, fullRun, runsFull } from '../test/runs.ts';
import { RunsTable } from './RunsTable.tsx';

const meta = { component: RunsTable } satisfies Meta<typeof RunsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: { runs: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.getByText('No runs in this period.')).toBeVisible();
  },
};

/** Full: one row per run, each linking to its page; a before-steps record shows "–" with its mark. */
export const Full: Story = {
  args: { runs: runsFull.runs },
  play: async ({ canvas, canvasElement }) => {
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers).toEqual([
      'Finished',
      'Project · branch',
      'Path',
      'Time',
      'Tasks',
      'Findings',
      'Stops',
      'Est. cost',
      'Warnings',
    ]);
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(3);
    // A table is a tab stop only when it asks to be one.
    await expect(canvasElement.querySelector('[data-slot="table-container"]')).not.toHaveAttribute('tabindex');

    const full = within(rows[1]);
    await expect(full.getByRole('link', { name: 'atlas · feat/search' })).toHaveAttribute('href', `/runs/${fullRun.key}`);
    await expect(rows[1]).toHaveTextContent('2 h 10');
    await expect(rows[1]).toHaveTextContent('4 in 2 waves');
    await expect(rows[1]).toHaveTextContent('6 · 5 closed');
    await expect(rows[1]).toHaveTextContent('$7.10');

    await expect(rows[0]).toHaveTextContent('25 min');

    const old = within(rows[2]);
    await expect(old.getByText('before steps')).toBeVisible();
    await expect(old.getAllByText('–').length).toBeGreaterThanOrEqual(5);

    // Free text with HTML in it shows as text.
    await expect(canvas.getByRole('link', { name: `harbor · ${HTML_TEXT}` })).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();
  },
};
