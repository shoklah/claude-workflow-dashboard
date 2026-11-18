import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime, type StatusResponse } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { mockApi } from '../test/mock-api.ts';
import { cells, expectNoJoined, openedRow, visibleTerms, visibleValues } from '../test/table.ts';
import { changeFull, changeSmall } from '../test/work.ts';
import { ChangePage } from './ChangePage.tsx';

const meta = { component: ChangePage, args: { changeKey: changeFull.key } } satisfies Meta<typeof ChangePage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
const CHANGE = `/api/work/changes/${changeFull.key}`;
const SMALL = `/api/work/changes/${changeSmall.key}`;

/** A header fact's value, by its term. */
const fact = (header: HTMLElement, term: string) => within(header).getByText(term, { selector: 'dt' }).nextElementSibling!;

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [CHANGE]: 'pending' });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText('Loading the change…');
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [CHANGE]: 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText("Couldn't load the change.");
    await expect(state).toHaveClass('glass', 'border-warning-edge');
  },
};

/** A key no listed change has: the page says so, with a link to Work. */
export const Missing: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText(/This change isn't in the data any more\./);
    await expect(within(state).getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/work');
  },
};

/** Full: a link back to Work, the title, the header facts (Other projects, Spec), the graph, the Runs table with its
 * Project and Path columns (several projects, a plan record) and the Sessions table. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [CHANGE]: changeFull });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('heading', { name: changeFull.title, level: 1 })).toBeVisible();
    await expect(canvas.getAllByRole('link', { name: 'Work' })[0]).toHaveAttribute('href', '/work');
    const header = canvas.getByRole('heading', { level: 1 }).parentElement!.querySelector('dl')!;
    await expect([...header.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      'Goal',
      'Project',
      'Other projects',
      'Path',
      'Stage',
      'Started',
      'Last activity',
      'Sessions',
      'Runs',
      'Est. cost',
      'Spec',
    ]);
    await expect(within(fact(header, 'Goal') as HTMLElement).getByRole('link', { name: 'Offline sync' })).toHaveAttribute(
      'href',
      `/work/goals/${changeFull.goal!.key}`,
    );
    await expect(fact(header, 'Other projects')).toHaveTextContent('tidepool-api');
    await expect(fact(header, 'Started')).toHaveTextContent(formatDayTime(parseTime(changeFull.startedAt!)));
    await expect(fact(header, 'Est. cost')).toHaveTextContent('$61.40');
    await expect(fact(header, 'Spec')).toHaveTextContent(changeFull.spec!);

    await expect(canvas.getByRole('region', { name: 'Sessions of this change, as a graph' })).toBeVisible();

    const runs = canvas.getByRole('region', { name: 'Runs table' });
    await expect(within(runs).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Run',
      'Project',
      'Path',
      'Finished',
      'Found',
      'Est. cost ($)',
    ]);
    const rows = within(runs).getAllByRole('row').slice(1);
    await expect(within(rows[0]).getByRole('link', { name: 'Replay the queue on reconnect' })).toHaveAttribute(
      'href',
      `/runs/${changeFull.runs[0].key}`,
    );
    await expect(cells(rows[0]).slice(1)).toEqual([
      'lantern-notes',
      'Full',
      formatDayTime(parseTime(changeFull.runs[0].finishedAt!)),
      '12',
      '26.90',
    ]);
    await expect(cells(rows[2]).slice(1, 3)).toEqual(['tidepool-api', 'Plan']);
    // Its branch and other counts open under the row.
    await userEvent.click(within(runs).getByRole('button', { name: 'Details of Replay the queue on reconnect' }));
    const opened = openedRow(within(runs).getByRole('button', { name: 'Details of Replay the queue on reconnect' }));
    await expect(visibleTerms(opened)).toEqual(['Branch', 'Time (min)', 'Tasks', 'Closed findings']);
    await expect(visibleValues(opened)).toEqual(['claude/offline-sync-replay', '231', '6', '11']);
    await expectNoJoined(runs);

    await expect(canvas.getByRole('region', { name: 'Sessions table' })).toBeVisible();
  },
};

/** A change of one project and one run, with no goal, spec or known cost: no Other projects or Spec, the dash for the
 * goal, and no Project or Path column. */
export const Small: Story = {
  args: { changeKey: changeSmall.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [SMALL]: changeSmall });
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: changeSmall.title, level: 1 });
    const header = canvas.getByRole('heading', { level: 1 }).parentElement!.querySelector('dl')!;
    const terms = [...header.querySelectorAll('dt')].map((dt) => dt.textContent);
    await expect(terms).not.toContain('Other projects');
    await expect(terms).not.toContain('Spec');
    await expect(fact(header, 'Goal')).toHaveTextContent('no goal');
    await expect(fact(header, 'Est. cost')).toHaveTextContent('not known');
    const runs = canvas.getByRole('region', { name: 'Runs table' });
    const heads = within(runs).getAllByRole('columnheader').map((th) => th.textContent);
    await expect(heads).not.toContain('Project');
    await expect(heads).not.toContain('Path');
  },
};
