import type { Meta, StoryObj } from '@storybook/react-vite';
import { useQueryClient } from '@tanstack/react-query';
import { expect, waitFor, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { complianceEmpty, complianceFull, complianceShowing } from '../test/compliance.ts';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { CompliancePage } from './CompliancePage.tsx';
import { expectNoJoined } from '../test/table.ts';

const meta = { component: CompliancePage } satisfies Meta<typeof CompliancePage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText('Loading the warnings…');
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText(
      "Couldn't load the warnings. Check that the dashboard server is running, then refresh.",
    );
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': complianceEmpty });
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('No warnings in this period. A warning shows here when the reporter flags a run or session.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /week of/ })).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Information from the reporter' })).toBeNull();
  },
};

/**
 * Full: the line summing the grid, then the current warnings' kinds by family and week, in the reporter's order, each
 * family under its heading and "other" last, each kind's total last; a selected cell lists its warnings below the grid
 * as a table: run link, project, text and whether it is new.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': complianceFull });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('region', { name: 'Warnings by kind and week' });
    const switcher = within(canvas.getByRole('group', { name: 'Warnings' }));
    await expect(switcher.getByRole('button', { name: 'Current' })).toHaveAttribute('aria-pressed', 'true');
    await expect(switcher.getByRole('button', { name: 'Including resolved' })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getAllByRole('rowheader').map((th) => th.textContent)).toEqual([
      'Review flow',
      'Final review without simplify',
      'Plan review without plan simplify',
      'Steps and the record',
      'Step has no agent id',
      'Agents and models',
      'Model-less dispatch',
      'Sessions',
      'Startup guidelines missing',
      'Other',
      'Brand new check',
      'Other',
    ]);
    // N is the full fixture's cells' total.
    await expect(canvas.getByText('9 warnings in 4 weeks, 2 of them new since you last looked.')).toBeVisible();
    // Each kind's warnings over the period in the last column; a family's heading spans it too.
    await expect(canvas.getAllByRole('columnheader').at(-1)).toHaveTextContent('Total');
    const totalOf = (kind: string) =>
      within(canvas.getAllByRole('rowheader', { name: kind }).at(-1)!.closest('tr')!).getAllByRole('cell').at(-1);
    await expect(totalOf('Step has no agent id')).toHaveTextContent('3');
    await expect(totalOf('Other')).toHaveTextContent('1');
    await expect(canvas.getByRole('rowheader', { name: 'Review flow' })).toHaveAttribute('colspan', '6');
    // The grid's largest count takes the darkest step.
    await expect(canvas.getByRole('button', { name: 'Step has no agent id, week of Nov 1: 2' })).toHaveClass(
      'bg-shade-5',
    );
    await expect(canvas.getByText('Select a cell to list its warnings.')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Step has no agent id, week of Nov 8: 1' }));
    await expect(canvas.getByRole('heading', { name: '1 warning of "Step has no agent id", week of Nov 8' })).toBeVisible();
    const table = within(canvas.getByRole('region', { name: 'Warnings' }));
    await expect(table.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Run',
      'Project',
      'Warning',
      'Since you last looked',
    ]);
    const rows = table.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(1);
    await expect(table.getByRole('link', { name: 'feat/search' })).toHaveAttribute('href', '/runs/a1b2c3d4e5f60718');
    await expect(within(rows[0]).getByText('atlas')).toBeVisible();
    await expect(within(rows[0]).getByText('New')).toBeVisible();
    // The "WARN:" prefix and the run's own "branch (date):" lead are gone: the Run column already names the run.
    await expect(table.getByText('final_review step 0 has no agent id')).toBeVisible();
    await expect(table.queryByText(/WARN:/)).toBeNull();
    await expectNoJoined(rows[0].closest('table')!);

    // Two warnings of one cell, neither new.
    await userEvent.click(canvas.getByRole('button', { name: 'Step has no agent id, week of Nov 1: 2' }));
    const two = within(canvas.getByRole('region', { name: 'Warnings' }));
    await expect(two.getAllByRole('row').slice(1)).toHaveLength(2);
    await expect(two.queryByText('New')).toBeNull();
    await expect(two.getAllByText('Seen')).toHaveLength(2);

    // A session's warning has no run to link to, and its session shows as its chip.
    await userEvent.click(canvas.getByRole('button', { name: 'Startup guidelines missing, week of Nov 8: 1' }));
    const session = within(canvas.getByRole('region', { name: 'Warnings' }));
    await expect(session.queryByRole('link')).toBeNull();
    await expect(session.getByText('5f0c9a1e')).toBeVisible();
    await expect(session.getByText('no run')).toBeInTheDocument();
    await expect(session.queryByText(/WARN:/)).toBeNull();

    // The reporter's information lines below the warnings, under its mark, each split at its first ": ".
    const information = within(canvas.getByRole('region', { name: 'Information from the reporter' }));
    await expect(information.getByText('reporter')).toBeVisible();
    await expect(information.getAllByRole('term').map((dt) => dt.textContent)).toEqual([
      'atlas feat/search',
      'inline sweeps',
      'over the cap without a handoff',
      'advisor roles',
      'Line 5',
    ]);
    await expect(information.getAllByRole('definition').map((dd) => dd.textContent)).toEqual([
      'the handoff came 12 calls after the cap',
      '2',
      '1 transcripts',
      'fable: 3 calls',
      'every transcript was read',
    ]);
  },
};

/** The current/resolved switch and the filters go to the API as query params. */
export const Resolved: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      ...projects,
      '/api/compliance?weeks=4': complianceFull,
      '/api/compliance?weeks=4&resolved=1': complianceFull,
      '/api/compliance?path=full&weeks=4&resolved=1': complianceFull,
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('region', { name: 'Warnings by kind and week' });
    await userEvent.click(canvas.getByRole('button', { name: 'Including resolved' }));
    await expect(canvas.getByRole('button', { name: 'Including resolved' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Current' })).toHaveAttribute('aria-pressed', 'false');
    await expect(fetch).toHaveBeenCalledWith('/api/compliance?weeks=4&resolved=1');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await expect(fetch).toHaveBeenCalledWith('/api/compliance?path=full&weeks=4&resolved=1');
  },
};

/** With a step from the URL: the API gets it, and a chip names it with a link that clears it. */
export const Step: Story = {
  args: { step: 'final_review' },
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4&step=final_review': complianceFull });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Step: Final review')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Clear the step filter' })).toHaveAttribute('href', '/compliance');
  },
};

/** Showing mode: no "other" rows, and what it left out of the list (other projects', sessions' and "other" warnings) is
 * counted under it; the reporter's information lines are hidden and counted. */
export const Hidden: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': complianceShowing });
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText(
        '+ 3 warnings left out while showing (other projects, sessions and other kinds); the grid counts all but other kinds',
      ),
    ).toBeVisible();
    await expect(canvas.queryByRole('rowheader', { name: 'Other' })).toBeNull();
    const information = within(canvas.getByRole('region', { name: 'Information from the reporter' }));
    await expect(information.getByText('3 information lines are hidden while showing')).toBeVisible();
    await expect(information.queryByRole('term')).toBeNull();
  },
};

/** Showing mode with only warnings it leaves out of the grid: the page doesn't say there are none, and counts them. */
export const AllLeftOut: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': { ...complianceEmpty, hidden: 2 } });
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText('No warnings to show in this period: showing mode leaves out other projects.'),
    ).toBeVisible();
    await expect(canvas.queryByText(/^No warnings in this period/)).toBeNull();
  },
};

// The answers SelectionLeftOut changes as it runs, as showing mode's start does.
const live: Record<string, object | number> = {};

/** A selected cell whose row showing mode then leaves out: once the grid comes back without it, nothing names it. */
export const SelectionLeftOut: Story = {
  beforeEach: () => {
    Object.assign(live, { '/api/status': status, ...projects, '/api/compliance?weeks=4': complianceFull });
    mockApi(live);
  },
  // Showing mode's start resets every query, as this button does.
  render: function Render(args) {
    const client = useQueryClient();
    return (
      <>
        <button type="button" onClick={() => void client.resetQueries()}>
          Start showing
        </button>
        <CompliancePage {...args} />
      </>
    );
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Brand new check, week of Nov 8: 1' }));
    await expect(canvas.getByRole('heading', { name: /"Brand new check"/ })).toBeVisible();
    live['/api/compliance?weeks=4'] = complianceShowing;

    await userEvent.click(canvas.getByRole('button', { name: 'Start showing' }));

    await waitFor(() => expect(canvas.queryByRole('rowheader', { name: 'Other' })).toBeNull());
    await expect(await canvas.findByRole('region', { name: 'Warnings by kind and week' })).toBeVisible();
    await expect(canvas.queryByText(/Brand new check/)).toBeNull();
    await expect(canvas.getByText('Select a cell to list its warnings.')).toBeVisible();
  },
};
