import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime, type StatusResponse } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { mockApi } from '../test/mock-api.ts';
import { openedRow, visibleFact, visibleTerms } from '../test/table.ts';
import { goalFull, goalSeveral } from '../test/work.ts';
import { GoalPage } from './GoalPage.tsx';

const meta = { component: GoalPage, args: { goalKey: goalFull.key } } satisfies Meta<typeof GoalPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
const GOAL = `/api/work/goals/${goalFull.key}`;

/** A header fact's value, by its term. */
const fact = (header: HTMLElement, term: string) => within(header).getByText(term, { selector: 'dt' }).nextElementSibling!;

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [GOAL]: 'pending' });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText('Loading the goal…');
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [GOAL]: 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText("Couldn't load the goal.");
    await expect(state).toHaveClass('glass', 'border-warning-edge');
  },
};

/** A key no listed goal has: the page says so, with a link to Work. */
export const Missing: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText(/This goal isn't in the data any more\./);
    await expect(within(state).getByRole('link', { name: 'Work' })).toHaveAttribute('href', '/work');
  },
};

/** Full: a link back to Work, the name, the header facts, the graph with a lane per change, then No change, then Other
 * goals, the Changes table with no Project column (one project) and the Sessions list, whose rows open to their change. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [GOAL]: goalFull });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByRole('heading', { name: 'Offline sync', level: 1 })).toBeVisible();
    await expect(canvas.getAllByRole('link', { name: 'Work' })[0]).toHaveAttribute('href', '/work');
    const header = canvas.getByRole('heading', { level: 1 }).parentElement!.querySelector('dl')!;
    await expect([...header.querySelectorAll('dt')].map((dt) => dt.textContent)).toEqual([
      'Project',
      'Started',
      'Last activity',
      'Changes',
      'Runs',
      'Sessions',
      'Findings',
      'Est. cost',
    ]);
    await expect(fact(header, 'Project')).toHaveTextContent('lantern-notes');
    await expect(fact(header, 'Started')).toHaveTextContent(formatDayTime(parseTime(goalFull.startedAt!)));
    await expect(fact(header, 'Last activity')).toHaveTextContent(formatDayTime(parseTime(goalFull.lastActivity!)));
    await expect(fact(header, 'Changes')).toHaveTextContent('2');
    await expect(fact(header, 'Runs')).toHaveTextContent('3');
    await expect(fact(header, 'Sessions')).toHaveTextContent('7');
    await expect(fact(header, 'Findings')).toHaveTextContent('25');
    await expect(fact(header, 'Est. cost')).toHaveTextContent('$64.50');

    const graph = canvas.getByRole('region', { name: 'Sessions of this goal, as a graph' });
    const lanes = ['Offline sync: queue and replay', 'No change', 'Other goals'].map((name) => within(graph).getByText(name));
    for (const [a, b] of [lanes.slice(0, 2), lanes.slice(1)]) {
      await expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    await expect(within(graph).getByText('Goal: Legal pages')).toBeVisible();

    const changes = canvas.getByRole('region', { name: 'Changes table' });
    await expect(within(changes).getAllByRole('columnheader').map((th) => th.textContent)).not.toContain('Project');
    await expect(within(changes).getAllByRole('row')).toHaveLength(goalFull.changes.length + 1);

    const sessions = canvas.getByRole('region', { name: 'Sessions table' });
    await expect(within(sessions).getAllByRole('columnheader').map((th) => th.textContent).slice(0, 2)).toEqual([
      'Session',
      'Step',
    ]);
    // A session opens to its change; one in no change leaves the fact out.
    const toggles = within(sessions).getAllByRole('button', { name: /^Details of / });
    await userEvent.click(toggles[0]);
    await expect(visibleFact(openedRow(toggles[0]), 'Change')).toHaveTextContent('Offline sync: queue and replay');
    await userEvent.click(toggles.at(-1)!);
    await expect(visibleTerms(openedRow(toggles.at(-1)!))).not.toContain('Change');
  },
};

/** A goal across projects with no known findings or cost: "Several projects", the dash for each, and the Changes
 * table's Project column. */
export const Several: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [GOAL]: goalSeveral });
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Offline sync', level: 1 });
    const header = canvas.getByRole('heading', { level: 1 }).parentElement!.querySelector('dl')!;
    await expect(fact(header, 'Project')).toHaveTextContent('Several projects');
    await expect(fact(header, 'Findings')).toHaveTextContent('not known');
    await expect(fact(header, 'Est. cost')).toHaveTextContent('not known');
    const changes = canvas.getByRole('region', { name: 'Changes table' });
    await expect(within(changes).getAllByRole('columnheader').map((th) => th.textContent)).toContain('Project');
  },
};
