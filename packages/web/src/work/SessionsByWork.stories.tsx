import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { HTML_TEXT } from '../test/runs.ts';
import { cells, expectNoJoined, visibleTerms, visibleValues, width } from '../test/table.ts';
import { changeFull } from '../test/work.ts';
import { SessionsByWork } from './SessionsByWork.tsx';

const meta = { component: SessionsByWork, args: { sessions: changeFull.sessions, change: false } } satisfies Meta<
  typeof SessionsByWork
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Full, on a change's page: each session's title links to it in the Sessions view; a row opens to who started it
 * ("Another session" when showing mode hides it, the dash read "started by you" when none), its models and its held
 * run, linking to the run's page, the run left out when none; a title with markup shows as text. */
export const Full: Story = {
  decorators: [width(1000)],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const table = canvas.getByRole('region', { name: 'Sessions table' });
    await expect(table).toHaveAttribute('tabindex', '0');
    await expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Session',
      'Step',
      'Started',
      'Length',
      'Est. cost ($)',
    ]);
    for (const th of within(table).getAllByRole('columnheader')) await expect(th).toBeVisible();
    const rows = within(table).getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(changeFull.sessions.length);
    const [first, second, third, fourth, fifth] = changeFull.sessions;
    await expect(within(rows[0]).getByRole('link', { name: first.title! })).toHaveAttribute(
      'href',
      `/work?view=sessions&session=${first.key}`,
    );
    await expect(cells(rows[0])).toEqual(['Design offline sync', 'Design', formatDayTime(parseTime(first.start)), '2 h 44', '5.90']);
    await expect(within(rows[4]).getByRole('link', { name: HTML_TEXT })).toHaveAttribute('href', `/work?view=sessions&session=${fifth.key}`);
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expectNoJoined(table);

    // Started by you, no run: the run is left out.
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${first.title}` }));
    let opened = within(table).getAllByRole('row')[2];
    await expect(visibleTerms(opened)).toEqual(['Started by', 'Model']);
    await expect(visibleValues(opened)).toEqual(['–started by you', 'Fable 5.2']);
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${first.title}` }));

    await userEvent.click(canvas.getByRole('button', { name: `Details of ${second.title}` }));
    opened = within(table).getAllByRole('row')[3];
    await expect(visibleValues(opened)[0]).toBe(second.startedBy!.title);
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${second.title}` }));

    await expect(third.startedBy).toEqual({ key: null, title: null });
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${third.title}` }));
    opened = within(table).getAllByRole('row')[4];
    await expect(visibleValues(opened)[0]).toBe('Another session');
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${third.title}` }));

    await userEvent.click(canvas.getByRole('button', { name: `Details of ${fourth.title}` }));
    opened = within(table).getAllByRole('row')[5];
    await expect(visibleTerms(opened)).toEqual(['Started by', 'Model', 'Run']);
    await expect(within(opened).getByRole('link', { name: fourth.run!.title! })).toHaveAttribute('href', `/runs/${fourth.run!.key}`);
  },
};

/** On a goal's page: a row opens first to its change, linking to the change's page. */
export const WithChange: Story = {
  args: { change: true },
  decorators: [width(1000)],
  play: async ({ canvas, userEvent }) => {
    const table = canvas.getByRole('region', { name: 'Sessions table' });
    await expect(within(table).getAllByRole('columnheader').map((th) => th.textContent).slice(0, 2)).toEqual(['Session', 'Step']);
    const first = changeFull.sessions[0];
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${first.title}` }));
    const opened = within(table).getAllByRole('row')[2];
    await expect(visibleTerms(opened)).toEqual(['Change', 'Started by', 'Model']);
    await expect(within(opened).getByRole('link', { name: changeFull.title })).toHaveAttribute('href', `/work/changes/${changeFull.key}`);
  },
};

/** Narrow: under 768 px the list keeps Session, Step and Length; Started and the cost open first under a row. */
export const Narrow: Story = {
  args: { change: true },
  decorators: [width(375)],
  play: async ({ canvas, userEvent }) => {
    const head = canvas.getAllByRole('row')[0];
    for (const name of ['Session', 'Step', 'Length']) await expect(within(head).getByRole('columnheader', { name })).toBeVisible();
    for (const name of ['Started', 'Est. cost ($)']) await expect(within(head).getByText(name).closest('th')).not.toBeVisible();
    const first = changeFull.sessions[0];
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${first.title}` }));
    await expect(visibleTerms(canvas.getAllByRole('row')[2])).toEqual(['Started', 'Est. cost ($)', 'Change', 'Started by', 'Model']);
  },
};

/** Empty: one line saying how the table fills. */
export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No sessions here yet. A session shows here once its transcript is imported.')).toBeVisible();
  },
};
