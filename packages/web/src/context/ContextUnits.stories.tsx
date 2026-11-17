import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { contextFull, contextHidden } from '../test/context.ts';
import { ContextUnits } from './ContextUnits.tsx';
import { expectNoJoined } from '../test/table.ts';

const meta = {
  component: ContextUnits,
  args: { units: contextFull.units, hidden: 0, over: true },
} satisfies Meta<typeof ContextUnits>;
export default meta;
type Story = StoryObj<typeof meta>;

const headers = (canvas: HTMLElement) =>
  within(within(canvas).getByRole('region', { name: 'Runs and sessions' }))
    .getAllByRole('columnheader')
    .map((header) => header.textContent);

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
 * Full: the rows in the response's order, under grouped headers; a run's branch linking to its page, a session's name
 * without its ID, the kind as plain text, and the handoff's session and ID in their own cells or as dashes.
 */
export const Full: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('heading', { name: 'Runs and sessions', level: 2 })).toBeVisible();
    await expect(headers(canvasElement)).toEqual([
      'Name',
      'Kind',
      'Project',
      'When',
      'Calls',
      'Context (tokens)',
      'Calls past the cap',
      'Handoff',
      'Read share',
      'Sweeps',
      'Median per call',
      'Largest',
      'At',
      'To session',
      'ID',
      'Inline',
      'Delegated',
    ]);
    const table = within(canvas.getByRole('region', { name: 'Runs and sessions' }));
    const body = table.getAllByRole('row').slice(2);
    await expect(body).toHaveLength(3);

    const session = within(body[0]).getAllByRole('cell');
    await expect(session[0]).toHaveTextContent(/^Refactor the sync queue$/);
    await expect(within(session[0]).queryByRole('button', { name: 'Copy session ID' })).toBeNull();
    await expect(session[1]).toHaveTextContent(/^Session$/);
    await expect(session[2]).toHaveTextContent('atlas');
    await expect(session[4]).toHaveTextContent(/^412$/);
    await expect(session[5]).toHaveTextContent(/^296.0K$/);
    await expect(session[6]).toHaveTextContent(/^902.0K$/);
    await expect(session[7]).toHaveTextContent(/^187$/);
    await expect(session[8]).toHaveTextContent('no handoff');
    await expect(session[9]).toHaveTextContent('no handoff');
    await expect(session[11]).toHaveTextContent('61%');
    await expect(session[12]).toHaveTextContent(/^9$/);
    await expect(session[13]).toHaveTextContent(/^0$/);

    const run = within(body[1]).getAllByRole('cell');
    await expect(within(run[0]).getByRole('link', { name: 'Search every note by title and body' })).toHaveAttribute('href', '/runs/a1b2c3d4e5f60718');
    await expect(run[1]).toHaveTextContent(/^Run$/);
    await expect(run[2]).toHaveTextContent('atlas');

    const handedOff = within(body[2]).getAllByRole('cell');
    await expect(handedOff[9]).toHaveTextContent(/^Plan the offline sync, part 2$/);
    await expect(within(handedOff[10]).getByRole('button', { name: 'Copy session ID' })).toBeVisible();

    await expectNoJoined(canvasElement);
    await expect(canvas.queryByText(/in other projects/)).toBeNull();
  },
};

/** With the page's switch beside the title. */
export const WithSwitch: Story = {
  args: { children: <button type="button">Switch</button> },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Switch' })).toBeVisible();
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
