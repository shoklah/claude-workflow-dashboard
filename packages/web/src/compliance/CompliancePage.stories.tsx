import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { complianceEmpty, complianceFull } from '../test/compliance.ts';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { CompliancePage } from './CompliancePage.tsx';

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
    await expect(await canvas.findByText('Loading the warnings…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the warnings.")).toBeVisible();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': complianceEmpty });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No warnings in this period.')).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /week of/ })).toBeNull();
  },
};

/**
 * Full: the current warnings' kinds by family and week, in the reporter's order, each family under its heading and
 * "other" last; a selected cell lists its warnings below the grid: kind, run link, "new" mark and text.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': complianceFull });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('region', { name: 'Warnings by kind and week' });
    await expect(canvas.getByRole('button', { name: 'Current warnings' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Including resolved' })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.getAllByRole('rowheader').map((th) => th.textContent)).toEqual([
      'Review flow',
      'final review without simplify',
      'plan review without plan simplify',
      'Steps and the record',
      'step has no agent id',
      'Agents and models',
      'model-less dispatch',
      'Sessions',
      'startup guidelines missing',
      'Other',
      'brand new check',
      'other',
    ]);
    // The grid's largest count takes the darkest step.
    await expect(canvas.getByRole('button', { name: 'step has no agent id, week of Nov 1: 2' })).toHaveClass(
      'bg-[#184f95]',
    );
    await expect(canvas.getByText('Select a cell to list its warnings.')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'step has no agent id, week of Nov 8: 1' }));
    await expect(canvas.getByRole('heading', { name: 'step has no agent id · week of Nov 8 · 1 warning' })).toBeVisible();
    const list = within(canvas.getByRole('list', { name: 'Warnings' }));
    const items = list.getAllByRole('listitem');
    await expect(items).toHaveLength(1);
    await expect(items[0]).toHaveTextContent('step has no agent id');
    await expect(items[0]).toHaveClass('border-[#ec835a]');
    await expect(list.getByRole('link', { name: 'atlas · feat/search' })).toHaveAttribute('href', '/runs/a1b2c3d4e5f60718');
    await expect(list.getByText('new')).toBeVisible();
    await expect(list.getByText('WARN: feat/search (2026-11-10): final_review step 0 has no agent id')).toBeVisible();

    // Two warnings of one cell, neither new.
    await userEvent.click(canvas.getByRole('button', { name: 'step has no agent id, week of Nov 1: 2' }));
    await expect(within(canvas.getByRole('list', { name: 'Warnings' })).getAllByRole('listitem')).toHaveLength(2);
    await expect(within(canvas.getByRole('list', { name: 'Warnings' })).queryByText('new')).toBeNull();

    // A session's warning has no run to link to, and its session shows as its chip.
    await userEvent.click(canvas.getByRole('button', { name: 'startup guidelines missing, week of Nov 8: 1' }));
    const session = within(canvas.getByRole('list', { name: 'Warnings' }));
    await expect(session.queryByRole('link')).toBeNull();
    await expect(session.getByText('5f0c9a1e')).toBeVisible();
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

/** Showing mode: what it left out of the list (other projects', sessions' and "other" warnings) is counted under it. */
export const Hidden: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/compliance?weeks=4': { ...complianceFull, hidden: 3 } });
  },
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByText(
        '+ 3 warnings left out while showing (other projects, sessions and other kinds), counted in the grid only',
      ),
    ).toBeVisible();
  },
};
