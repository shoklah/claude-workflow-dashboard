import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { HTML_TEXT } from '../test/runs.ts';
import { cells, expectNoJoined } from '../test/table.ts';
import { changeFull } from '../test/work.ts';
import { SessionsByWork } from './SessionsByWork.tsx';

const meta = { component: SessionsByWork, args: { sessions: changeFull.sessions, change: false } } satisfies Meta<
  typeof SessionsByWork
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Full, on a change's page: each session's title links to it in the Sessions view; Started by names the starter,
 * "Another session" when showing mode hides it, the dash read "started by you" when none; Run links to the run's page;
 * a title with markup shows as text; no Change column. */
export const Full: Story = {
  play: async ({ canvas, canvasElement }) => {
    const table = canvas.getByRole('region', { name: 'Sessions table' });
    await expect(table).toHaveAttribute('tabindex', '0');
    await expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Session',
      'Step',
      'Started',
      'Started by',
      'Length',
      'Model',
      'Run',
      'Est. cost ($)',
    ]);
    const rows = within(table).getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(changeFull.sessions.length);
    const [first, second, third, fourth, fifth] = changeFull.sessions;
    await expect(within(rows[0]).getByRole('link', { name: first.title! })).toHaveAttribute(
      'href',
      `/work?view=sessions&session=${first.key}`,
    );
    await expect(cells(rows[0])).toEqual(['Design offline sync', 'Design', formatDayTime(parseTime(first.start)), '–started by you', '2 h 44', 'Fable 5.2', '–no run', '5.90']);
    await expect(cells(rows[1])[3]).toBe(second.startedBy!.title);
    await expect(cells(rows[2])[3]).toBe('Another session');
    await expect(within(rows[3]).getByRole('link', { name: fourth.run!.title! })).toHaveAttribute('href', `/runs/${fourth.run!.key}`);
    await expect(within(rows[4]).getByRole('link', { name: HTML_TEXT })).toHaveAttribute('href', `/work?view=sessions&session=${fifth.key}`);
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expect(third.startedBy).toEqual({ key: null, title: null });
    await expectNoJoined(table);
  },
};

/** On a goal's page: the Change column after Session, linking to the change's page. */
export const WithChange: Story = {
  args: { change: true },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('region', { name: 'Sessions table' });
    await expect(within(table).getAllByRole('columnheader').map((th) => th.textContent).slice(0, 3)).toEqual(['Session', 'Change', 'Step']);
    const row = within(table).getAllByRole('row')[1];
    await expect(within(row).getByRole('link', { name: changeFull.title })).toHaveAttribute('href', `/work/changes/${changeFull.key}`);
  },
};

/** Empty: one line saying how the table fills. */
export const Empty: Story = {
  args: { sessions: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No sessions here yet. A session shows here once its transcript is imported.')).toBeVisible();
  },
};
