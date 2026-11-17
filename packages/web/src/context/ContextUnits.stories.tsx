import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
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

/** The list in a box of a set width. */
const width =
  (px: number): Decorator =>
  (Story) => (
    <div style={{ width: px }}>
      <Story />
    </div>
  );

/** An opened row's visible terms (`dt`) or values (`dd`). */
const visible = (row: HTMLElement, tag: string) =>
  [...row.querySelectorAll<HTMLElement>(tag)].filter((el) => el.checkVisibility()).map((el) => el.textContent);

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
 * Full, 1000 px wide: the rows in the response's order under the first glance's sortable headers; a run's branch
 * linking to its page, a session's name without its ID, and a run opening to its other facts, the empty ones absent.
 */
export const Full: Story = {
  decorators: [width(1000)],
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByRole('heading', { name: 'Runs and sessions', level: 2 })).toBeVisible();
    const region = within(canvas.getByRole('region', { name: 'Runs and sessions table' }));
    const heads = region.getAllByRole('columnheader');
    await expect(heads.map((h) => h.textContent)).toEqual(['Name', 'Kind', 'When', 'Past the cap', 'Largest', 'Read share']);
    for (const head of heads) await expect(head).toBeVisible();
    const body = region.getAllByRole('row').slice(1);
    await expect(body).toHaveLength(3);

    const session = within(body[0]).getAllByRole('cell');
    await expect(session[0]).toHaveTextContent(/^Refactor the sync queue$/);
    await expect(within(session[0]).queryByRole('button', { name: 'Copy session ID' })).toBeNull();
    await expect(session[1]).toHaveTextContent(/^Session$/);
    await expect(session[3]).toHaveTextContent(/^187$/);
    await expect(session[4]).toHaveTextContent(/^902.0K$/);
    await expect(session[5]).toHaveTextContent('61%');

    const run = within(body[1]).getAllByRole('cell');
    await expect(within(run[0]).getByRole('link', { name: 'feat/search' })).toHaveAttribute('href', '/runs/a1b2c3d4e5f60718');
    await expect(run[1]).toHaveTextContent(/^Run$/);

    await userEvent.click(region.getByRole('button', { name: 'Details of feat/search' }));
    const opened = region.getAllByRole('row')[3];
    await expect(visible(opened, 'dt')).toEqual([
      'Project',
      'Calls',
      'Median tokens per call',
      'Sweeps inline',
      'Sweeps delegated',
    ]);
    await expect(visible(opened, 'dd')).toEqual(['atlas', '268', '281.0K', '4', '1']);

    await userEvent.click(region.getByRole('button', { name: 'Plan the offline sync' }));
    const handedOff = region.getAllByRole('row').at(-1)!;
    await expect(visible(handedOff, 'dt')).toEqual([
      'Project',
      'Calls',
      'Median tokens per call',
      'Handed off',
      'To session',
      'Its ID',
      'Sweeps inline',
      'Sweeps delegated',
    ]);
    await expect(visible(handedOff, 'dd')[4]).toBe('Plan the offline sync, part 2');
    await expect(
      within(handedOff).getAllByRole('button', { name: 'Copy session ID', hidden: true }).filter((b) => b.checkVisibility()),
    ).toHaveLength(1);

    await expectNoJoined(canvasElement);
    await expect(canvas.queryByText(/in other projects/)).toBeNull();
  },
};

/** Narrow, 375 px: Kind, When, Largest and Read share fold into the opened row. */
export const Narrow: Story = {
  decorators: [width(375)],
  play: async ({ canvas, userEvent }) => {
    const region = within(canvas.getByRole('region', { name: 'Runs and sessions table' }));
    await expect(region.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    await expect(region.getByRole('columnheader', { name: 'Past the cap' })).toBeVisible();
    for (const name of ['Kind', 'When', 'Largest', 'Read share'])
      await expect(region.getByText(name).closest('th')).not.toBeVisible();
    await userEvent.click(region.getByRole('button', { name: 'Refactor the sync queue' }));
    const opened = region.getAllByRole('row')[2];
    await expect(visible(opened, 'dt').slice(0, 5)).toEqual(['Kind', 'When', 'Largest', 'Read share', 'Project']);
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
