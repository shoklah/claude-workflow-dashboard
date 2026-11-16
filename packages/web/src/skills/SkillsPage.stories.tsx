import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime, type StatusResponse } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
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
    const state = await canvas.findByText('Loading the skills…');
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/skills?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText(
      "Couldn't load the skills. Check that the dashboard server is running, then refresh.",
    );
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/skills?weeks=4': skillsEmpty });
  },
  play: async ({ canvas }) => {
    const empty = await canvas.findByText(
      'No skill loads in this period. A skill shows here once a run or session loads it.',
    );
    await expect(empty).toBeVisible();
    await expect(empty).toHaveAttribute('colspan', String(canvas.getAllByRole('columnheader').length - 1));
  },
};

/**
 * Full: the last 4 weeks' skills by name, one line per outcome with the skill's cells spanning them; a skill required
 * but never loaded in the period has one line reading "No loads"; how they are counted folds under the table.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/skills?weeks=4': skillsFull });
  },
  play: async ({ canvas }) => {
    const simplify = await canvas.findByRole('rowheader', { name: 'simplify' });
    await expect(canvas.getByRole('heading', { name: 'Skills', level: 1 })).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    await expect(canvas.getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Skill',
      'Runs and sessions',
      'Required but missing',
      'Last loaded',
      'Loads, by outcome',
      'Outcome',
      'Loads',
    ]);
    // simplify's two outcomes take two rows, its Skill cell spanning them.
    await expect(simplify).toHaveAttribute('rowspan', '2');
    const first = within(simplify.closest('tr')!).getAllByRole('cell').map((c) => c.textContent);
    expect(first).toEqual(['5', '1', formatDayTime(parseTime('2026-11-09T16:02:00Z')), 'Applied 2, skipped 1', '3']);
    const second = simplify.closest('tr')!.nextElementSibling as HTMLElement;
    expect(within(second).getAllByRole('cell').map((c) => c.textContent)).toEqual(['Applied 0, skipped 0', '2']);
    // An outcome reads capitalised.
    const brainstorming = canvas.getByRole('rowheader', { name: 'brainstorming' }).closest('tr')!;
    await expect(within(brainstorming).getByRole('cell', { name: 'Wrote a file' })).toBeVisible();
    // A skill never loaded: one row reading "No loads".
    const never = canvas.getByRole('rowheader', { name: 'requesting-code-review' });
    await expect(never).toHaveAttribute('rowspan', '1');
    await expect(within(never.closest('tr')!).getByRole('cell', { name: 'No loads' })).toBeVisible();
    // One value per cell.
    for (const cell of canvas.getAllByRole('cell')) expect(cell.textContent).not.toContain(' · ');
    const notes = canvas.getByText('How skills are counted').closest('details')!;
    await expect(notes).not.toHaveAttribute('open');
    await expect(canvas.getByRole('region', { name: 'Skills' }).compareDocumentPosition(notes)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
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
    await canvas.findByRole('rowheader', { name: 'simplify' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '12');
    await expect(fetch).toHaveBeenCalledWith('/api/skills?path=full&weeks=12');
  },
};
