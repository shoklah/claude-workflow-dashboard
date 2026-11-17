import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { HTML_TEXT, runsFull } from '../test/runs.ts';
import { noGoal, searchGoal, syncGoal, workEmpty, workFilteredEmpty, workFull, workHidden, workNoGoals } from '../test/work.ts';
import { WorkPage } from './WorkPage.tsx';

const meta = { component: WorkPage } satisfies Meta<typeof WorkPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
const PROJECTS = '/api/runs?weeks=52';
const WORK = '/api/work?weeks=4';
const NO_GOALS_LINE = 'Runs recorded before goals existed show under No goal.';
// Wide enough for the title rows' columns (from `sm`).
const DESKTOP = {
  parameters: { viewport: { options: { desktop: { name: 'Desktop', styles: { width: '1280px', height: '900px' } } } } },
  globals: { viewport: { value: 'desktop' } },
};

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, [WORK]: 'pending' });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText('Loading the changes…');
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, [WORK]: 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText("Couldn't load the changes.");
    await expect(state).toHaveClass('glass', 'border-warning-edge');
  },
};

/** Nothing in the period: what the page lists and how it fills, and no line about goals. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, [WORK]: workEmpty });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText(
      'No work in this period. A change shows here once one of its sessions or runs is imported.',
    );
    await expect(state.closest('.glass')).not.toBeNull();
    await expect(canvas.queryByText(NO_GOALS_LINE)).toBeNull();
    await expect(canvas.queryByText(/belongs? to no change/)).toBeNull();
  },
};

/** The filters match nothing: its own message, whose control clears them. */
export const FilteredEmpty: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      [PROJECTS]: runsFull,
      [WORK]: workFull,
      [`${WORK}&goal=${searchGoal.key}`]: workFilteredEmpty,
    });
  },
  play: async ({ canvas, userEvent }) => {
    const goal = await canvas.findByRole('combobox', { name: 'Goal' });
    await canvas.findByRole('region', { name: syncGoal.name! });
    await userEvent.selectOptions(goal, searchGoal.key!);
    await expect(fetch).toHaveBeenCalledWith(`${WORK}&goal=${searchGoal.key}`);
    await expect(await canvas.findByText('Nothing matches these filters.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Clear the filters' }));
    await expect(await canvas.findByRole('region', { name: syncGoal.name! })).toBeVisible();
    await expect(goal).toHaveValue('');
  },
};

/** Full: the view switch on Changes, the Changes view's filters (no Path), a section per goal, the open ones showing
 * their changes; a closed one opens by its chevron; the totals line up down the page; "No goal" is plain text; the
 * loose sessions' line links to the Sessions view. */
export const Full: Story = {
  ...DESKTOP,
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, [WORK]: workFull });
  },
  play: async ({ canvas, userEvent }) => {
    const sync = await canvas.findByRole('region', { name: syncGoal.name! });
    await expect(canvas.getByRole('heading', { name: 'Work', level: 1 })).toBeVisible();
    const view = canvas.getByRole('group', { name: 'View' });
    await expect(within(view).getAllByRole('button').map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([
      ['Changes', 'true'],
      ['Runs', 'false'],
      ['Sessions', 'false'],
    ]);
    await expect(canvas.getAllByRole('combobox').map((select) => select.closest('label')!.firstChild!.textContent)).toEqual([
      'Project',
      'Goal',
      'Period',
    ]);
    await expect(canvas.queryByRole('combobox', { name: 'Path' })).toBeNull();
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    await expect(canvas.queryByText(NO_GOALS_LINE)).toBeNull();

    // Open sections show their changes; a goal's name links to its page, "No goal" is plain text.
    const search = canvas.getByRole('region', { name: searchGoal.name! });
    const none = canvas.getByRole('region', { name: 'No goal' });
    await expect(within(sync).getByRole('region', { name: `${syncGoal.name} table` })).toBeVisible();
    await expect(within(search).getByRole('region', { name: `${searchGoal.name} table` })).toBeVisible();
    await expect(within(sync).getByRole('link', { name: syncGoal.name! })).toHaveAttribute('href', `/work/goals/${syncGoal.key}`);
    await expect(within(none).queryByRole('link', { name: 'No goal' })).toBeNull();
    await expect(within(sync).getByRole('link', { name: HTML_TEXT })).toBeVisible();

    // The closed section opens and closes by its chevron.
    const toggle = within(none).getByRole('button', { name: 'No goal' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(within(none).queryByRole('table')).toBeNull();
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(within(none).getByRole('link', { name: noGoal.rows[0].title })).toBeVisible();

    // Each total's value ends at the same place in every section's title row, whatever the name's length.
    const values = [sync, search, none].map((section) =>
      [...section.querySelector('dl')!.querySelectorAll('dd')].map((dd) => dd.getBoundingClientRect().right),
    );
    await expect(values[0]).toHaveLength(5);
    await expect(values[1]).toEqual(values[0]);
    await expect(values[2]).toEqual(values[0]);
    await expect(within(sync).getAllByRole('term').map((dt) => dt.textContent)).toEqual([
      'Changes',
      'Runs',
      'Sessions',
      'Est. cost',
      'Last activity',
    ]);

    const loose = canvas.getByText('4 sessions in this period belong to no change.');
    await expect(within(loose.parentElement!).getByRole('link', { name: 'See them under Sessions' })).toHaveAttribute(
      'href',
      '/work?view=sessions',
    );
  },
};

/** No stored unit has a goal yet: the page says so once, above the list. */
export const NoGoalsYet: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, [WORK]: workNoGoals });
  },
  play: async ({ canvas }) => {
    const line = await canvas.findByText(NO_GOALS_LINE);
    const none = canvas.getByRole('region', { name: 'No goal' });
    await expect(line.compareDocumentPosition(none)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await expect(within(none).getByRole('button', { name: 'No goal' })).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText('1 session in this period belongs to no change.')).toBeVisible();
  },
};

/** Showing mode on: the changes of other projects only counted, under the list. */
export const Hidden: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, [WORK]: workHidden });
  },
  play: async ({ canvas }) => {
    await canvas.findByRole('region', { name: searchGoal.name! });
    await expect(canvas.getByText('+ 2 changes in other projects, counted in totals and charts only')).toBeVisible();
  },
};

/** The Runs view: its option pressed, the runs list under it. */
export const RunsView: Story = {
  args: { view: 'runs' },
  beforeEach: () => {
    mockApi({ '/api/status': status, [PROJECTS]: runsFull, '/api/runs?weeks=4': runsFull });
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Runs' })).toHaveAttribute('aria-pressed', 'true');
    await expect(await canvas.findByRole('region', { name: 'Runs table' })).toBeVisible();
    await expect(fetch).not.toHaveBeenCalledWith(WORK);
  },
};
