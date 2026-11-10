import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { skillsEmpty, skillsFull } from '../test/skills.ts';
import { SkillsPage } from './SkillsPage.tsx';

const meta = { component: SkillsPage } satisfies Meta<typeof SkillsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/skills?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the skills…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/skills?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the skills.")).toBeVisible();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/skills?weeks=4': skillsEmpty });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No skill loads in this period.')).toBeVisible();
  },
};

/**
 * Full: the last 4 weeks' skills by name, under the static page's columns, each with its outcomes counted; "required
 * but missing" is marked as the reporter's all-time figure, and a dash where the export has none.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/skills?weeks=4': skillsFull });
  },
  play: async ({ canvas }) => {
    const simplify = await canvas.findByRole('row', { name: /^simplify/ });
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    await expect(canvas.getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Skill',
      'Runs',
      'Last',
      'Outcomes',
      'Required but missingreporter, all time',
    ]);
    await expect(canvas.getByText('reporter, all time')).toHaveAttribute(
      'title',
      "The latest export's figure over everything the reporter reads; it isn't summed by period yet.",
    );
    const cells = within(simplify).getAllByRole('cell').map((c) => c.textContent);
    expect(cells[0]).toBe('simplify');
    expect(cells[1]).toBe('5');
    expect(cells[3]).toBe('applied 2, skipped 1 × 3 · applied 0, skipped 0 × 2');
    expect(cells[4]).toBe('1');
    const plans = within(canvas.getByRole('row', { name: /^writing-plans/ })).getAllByRole('cell');
    await expect(plans[4]).toHaveTextContent('–');
    await expect(canvas.getByText(/every session counts/)).toBeVisible();
  },
};

/** The path, project and period filters go to the API as query params. */
export const Filters: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      ...projects,
      '/api/skills?weeks=4': skillsFull,
      '/api/skills?path=full&weeks=4': skillsFull,
      '/api/skills?path=full&weeks=12': skillsFull,
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('row', { name: /^simplify/ });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '12');
    await expect(fetch).toHaveBeenCalledWith('/api/skills?path=full&weeks=12');
  },
};
