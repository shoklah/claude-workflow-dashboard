import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { contextFull, contextHidden } from '../test/context.ts';
import { ContextUnits } from './ContextUnits.tsx';

const meta = {
  component: ContextUnits,
  args: { units: contextFull.units, hidden: 0, over: true },
} satisfies Meta<typeof ContextUnits>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: no unit past the cap. */
export const Empty: Story = {
  args: { units: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No runs or sessions past the cap in this period.')).toBeVisible();
  },
};

/** Empty under "All": no unit with context. */
export const EmptyAll: Story = {
  args: { units: [], over: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No runs or sessions with context in this period.')).toBeVisible();
  },
};

/**
 * Full: the rows in the response's order, a run linking to its page, a session with its chip and project, and a
 * "Handed off to" cell naming its session or reading a dash.
 */
export const Full: Story = {
  play: async ({ canvas }) => {
    const table = within(canvas.getByRole('region', { name: 'Runs and sessions' }));
    const body = table.getAllByRole('row').slice(1);
    await expect(body).toHaveLength(3);
    await expect(body[0]).toHaveTextContent(/^sessionRefactor the sync queue/);
    await expect(within(body[0]).getByText('atlas')).toBeVisible();
    await expect(within(body[0]).getByRole('button', { name: 'Copy session ID' })).toBeVisible();
    await expect(within(body[0]).getByText('187')).toBeVisible();
    await expect(within(body[0]).getByText('61%')).toBeVisible();
    await expect(within(body[0]).getByText('9 · 0')).toBeVisible();
    const cells = within(body[0]).getAllByRole('cell');
    await expect(cells[8]).toHaveTextContent('–');

    const run = within(body[1]).getByRole('link', { name: 'atlas · feat/search · full' });
    await expect(run).toHaveAttribute('href', '/runs/a1b2c3d4e5f60718');
    await expect(within(body[1]).getByText('281K')).toBeVisible();
    await expect(within(body[1]).getByText('744K')).toBeVisible();

    const handedOff = within(body[2]).getAllByRole('cell')[8];
    await expect(handedOff).toHaveTextContent('Plan the offline sync, part 2');
    await expect(within(handedOff).getByRole('button', { name: 'Copy session ID' })).toBeVisible();

    await expect(canvas.queryByText(/in other projects/)).toBeNull();
  },
};

/** Showing: no session ID, and the units of other projects only counted, under the list. */
export const Showing: Story = {
  args: { units: contextHidden.units, hidden: contextHidden.hidden },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Refactor the sync queue')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Copy session ID' })).toBeNull();
    await expect(canvas.getByText('+ 2 rows in other projects, counted in totals and charts only')).toBeVisible();
  },
};
