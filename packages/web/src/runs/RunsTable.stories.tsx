import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HTML_TEXT, fullRun, oldRun, smallRun } from '../test/runs.ts';
import { cells, expectNoJoined, visibleTerms, visibleValues, width } from '../test/table.ts';
import { RunsTable } from './RunsTable.tsx';

const meta = { component: RunsTable } satisfies Meta<typeof RunsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const EMPTY = 'No runs in this period. A run shows here once its record is written and imported.';

export const Empty: Story = {
  args: { runs: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.getByText(EMPTY)).toBeVisible();
  },
};

/** Full: one row per run, its title (else its branch) linking to its page, one value per cell with the unit in the
 * header; a record from before steps says so in muted text and shows the dash for what it can't give. Its change
 * (linking to the change's page), goal, branch and other counts open under a row, the ones not known left out. */
export const Full: Story = {
  args: { runs: [{ ...smallRun, minutes: 25.4 }, fullRun, oldRun] },
  decorators: [width(1000)],
  play: async ({ canvas, canvasElement, userEvent }) => {
    const [head, ...rows] = canvas.getAllByRole('row');
    await expect(within(head).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Run',
      'Project',
      'Path',
      'Finished',
      'Found',
      'Est. cost ($)',
      'Warnings',
    ]);
    for (const th of within(head).getAllByRole('columnheader')) await expect(th).toBeVisible();
    await expect(rows).toHaveLength(3);
    await expect(canvas.getByRole('region', { name: 'Runs table' })).toHaveAttribute('tabindex', '0');

    // Run, Project, Path, Finished, Found, Cost, Warnings; a run with a title is named by it.
    const full = cells(rows[1]);
    await expect(within(rows[1]).getByRole('link', { name: fullRun.headline! })).toHaveAttribute('href', `/runs/${fullRun.key}`);
    await expect(within(rows[1]).queryByRole('link', { name: 'feat/search' })).toBeNull();
    await expect(full[1]).toBe('atlas');
    await expect(full[2]).toBe('Full');
    await expect(full.slice(4)).toEqual(['6', '7.10', '1']);

    // Before steps: muted text, not a badge; what it can't give is the dash, read as "not known".
    const old = within(rows[2]);
    const mark = old.getByText('before steps');
    await expect(mark).toHaveClass('text-muted-foreground');
    const cost = rows[2].querySelectorAll('td')[5];
    await expect(cost).toHaveTextContent('–');
    await expect(within(cost).getByText('not known')).toBeInTheDocument();

    // One value per cell.
    await expectNoJoined(canvasElement);

    // The first run, with no title, is named by its branch; it opens to its branch and other counts, no change or
    // goal left out; the time is whole minutes.
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${HTML_TEXT}` }));
    const opened = canvas.getAllByRole('row')[2];
    await expect(visibleTerms(opened)).toEqual(['Branch', 'Time (min)', 'Tasks', 'Waves', 'Closed findings', 'Stops']);
    await expect(visibleValues(opened)).toEqual([HTML_TEXT, '25', '1', '0', '1', '0']);

    // A titled run's chevron reads its title, and its opened row its change, linking to the change's page, and goal.
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${fullRun.headline}` }));
    const fullOpened = canvas.getAllByRole('row')[4];
    await expect(visibleTerms(fullOpened).slice(0, 3)).toEqual(['Change', 'Goal', 'Branch']);
    await expect(visibleValues(fullOpened).slice(0, 3)).toEqual([fullRun.change!.title, fullRun.goal!.name, 'feat/search']);
    await expect(within(fullOpened).getByRole('link', { name: fullRun.change!.title })).toHaveAttribute(
      'href',
      `/work/changes/${fullRun.change!.key}`,
    );

    // A record from before steps knows only its branch.
    await userEvent.click(canvas.getByRole('button', { name: 'Details of feat/import' }));
    const oldOpened = canvas.getAllByRole('row').at(-1)!;
    await expect(visibleTerms(oldOpened)).toEqual(['Branch']);

    // Free text with HTML in it shows as text.
    await expect(canvas.getByRole('link', { name: HTML_TEXT })).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();
  },
};

/** Narrow: under 768 px the list keeps Run, Found and Warnings; Project, Path, Finished and the cost open first
 * under a row. */
export const Narrow: Story = {
  args: { runs: [fullRun] },
  decorators: [width(375)],
  play: async ({ canvas, userEvent }) => {
    const head = canvas.getAllByRole('row')[0];
    for (const name of ['Run', 'Found', 'Warnings'])
      await expect(within(head).getByRole('columnheader', { name })).toBeVisible();
    for (const name of ['Project', 'Path', 'Finished', 'Est. cost ($)'])
      await expect(within(head).getByText(name).closest('th')).not.toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${fullRun.headline}` }));
    await expect(visibleTerms(canvas.getAllByRole('row')[2])).toEqual([
      'Project',
      'Path',
      'Finished',
      'Est. cost ($)',
      'Change',
      'Goal',
      'Branch',
      'Time (min)',
      'Tasks',
      'Waves',
      'Closed findings',
      'Stops',
    ]);
  },
};

/** A run with no title and no branch: its link shows the muted dash, read out as "no branch", as its chevron's name. */
export const NoBranch: Story = {
  args: { runs: [{ ...fullRun, headline: null, branch: null }] },
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'no branch' });
    await expect(link).toHaveTextContent('–');
    await expect(link.querySelector('.text-muted-foreground')).not.toBeNull();
    await expect(canvas.getByRole('button', { name: 'Details of no branch' })).toBeVisible();
  },
};

/** The runs of one change (a change's page): no Warnings column and no change, goal, waves or stops in the opened
 * row; Project and Path only when the change asks for them (several projects, a plan record). */
export const OfAChange: Story = {
  args: { runs: [fullRun, { ...smallRun, path: 'plan' }], of: { project: true, path: true } },
  decorators: [width(1000)],
  play: async ({ canvas, userEvent }) => {
    await expect(within(canvas.getAllByRole('row')[0]).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Run',
      'Project',
      'Path',
      'Finished',
      'Found',
      'Est. cost ($)',
    ]);
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(cells(rows[0]).slice(1, 3)).toEqual(['atlas', 'Full']);
    await expect(cells(rows[1])[2]).toBe('Plan');
    await expect(cells(rows[0]).slice(4)).toEqual(['6', '7.10']);
    await userEvent.click(canvas.getByRole('button', { name: `Details of ${fullRun.headline}` }));
    await expect(visibleTerms(canvas.getAllByRole('row')[2])).toEqual(['Branch', 'Time (min)', 'Tasks', 'Closed findings']);
  },
};

/** One change's runs with neither column asked for, and none to list: its own empty line. */
export const OfAChangeEmpty: Story = {
  args: { runs: [], of: { project: false, path: false } },
  play: async ({ canvas }) => {
    const heads = within(canvas.getAllByRole('row')[0]).getAllByRole('columnheader').map((th) => th.textContent);
    await expect(heads).not.toContain('Project');
    await expect(heads).not.toContain('Path');
    const empty = canvas.getByText('No runs yet. A run shows here once its record is written and imported.');
    await expect(empty).toHaveAttribute('colspan', '4');
  },
};
