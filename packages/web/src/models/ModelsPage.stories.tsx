import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { modelsEmpty, modelsFull, modelsOldReporter } from '../test/models.ts';
import { runsFull } from '../test/runs.ts';
import { ModelsPage } from './ModelsPage.tsx';

const meta = { component: ModelsPage } satisfies Meta<typeof ModelsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };
// The project filter's options: every project of the last 52 weeks.
const projects = { '/api/runs?weeks=52': runsFull };

/** A row's cells after its header, as text. */
function cells(row: HTMLElement): string[] {
  return within(row)
    .getAllByRole('cell')
    .map((cell) => cell.textContent ?? '');
}

/** A table's column headers, as text. */
function columns(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '');
}

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the models and advisor…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the models and advisor.")).toBeVisible();
  },
};

/** Empty: no dispatches, main sessions or advisor weeks in the period; the reporter's stage table and facts show. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': modelsEmpty });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('No dispatches in this period.')).toBeVisible();
    await expect(canvas.getByText('No advisor weeks in this period.')).toBeVisible();
    const full = canvas.getByRole('rowheader', { name: 'full' }).closest('tr')!;
    await expect(cells(full)).toEqual(['1=opus-5-5/medium 2=opus-5-5/medium 3=opus-5-5/medium out=opus-5-5/medium', '–', '0']);
    const notes = canvas.getByRole('rowheader', { name: 'notes' }).closest('tr')!;
    await expect(cells(notes)).toEqual(['notes 12 · changed 9 · missing 2']);
  },
};

/**
 * Full: the static page's tables, agents, main sessions, the advisor's facts and its weeks, the reporter's all-time
 * figures marked "reporter, all time".
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': modelsFull });
  },
  play: async ({ canvas }) => {
    const row = (name: string) => canvas.getByRole('rowheader', { name }).closest('tr')!;
    const reviewer = (await canvas.findByRole('rowheader', { name: 'final-reviewer' })).closest('tr')!;
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    const [agents, main, facts, weeks] = canvas.getAllByRole('table');
    // Each table scrolls sideways in its own named, focusable region.
    await expect(canvas.getByRole('region', { name: 'Main sessions' })).toHaveAttribute('tabindex', '0');
    await expect(within(canvas.getByRole('region', { name: 'Advisor weeks' })).getByRole('table')).toBe(weeks);
    await expect(columns(agents)).toEqual(['Agent', 'Requested', 'Ran on', 'Mismatchesreporter, all time']);
    await expect(cells(reviewer)).toEqual(['-/xhigh 5', 'fable-5-1/xhigh 4 · opus-5-5/xhigh 1', '1']);

    await expect(columns(main)).toEqual([
      'Main session',
      'Stage tablereporter, all time',
      'Ran on',
      'Differsreporter, all time',
    ]);
    await expect(cells(row('small'))).toEqual(['1=– 2=opus-5-5 3=opus-5-5 out=opus-5-5', '–', '0']);
    await expect(cells(row('plan'))).toEqual([
      '1=fable-5-1 2=fable-5-1 3=fable-5-1 out=fable-5-1',
      'opus-5-5/high 2 · fable-5-1/high 2',
      '2',
    ]);

    await expect(columns(facts)).toEqual(['Advisorreporter, all time', 'Value']);
    await expect(cells(row('calls by role'))).toEqual([
      'implementer 3 · main 9 · task-reviewer 2 (should not consult)',
    ]);
    await expect(cells(row('failed calls'))).toEqual(['overloaded error 1']);
    await expect(cells(row('tokens'))).toEqual(['43.5K']);
    await expect(cells(row('est. cost'))).toEqual(['$3.20']);
    await expect(cells(row('trial'))).toEqual(['runs 8/5, weeks 0/3 CHECKPOINT']);

    await expect(columns(weeks)).toEqual(['Weekreporter, all time', 'Advisor', 'Fable', 'Share', 'Stop']);
    await expect(cells(row('Nov 1'))).toEqual(['$9.80', '$25.10', '39%', 'STOP']);
    await expect(cells(row('Nov 8'))).toEqual(['$3.20', '$41.00', '8%', '']);

    // The period's sums aren't marked.
    await expect(within(agents).getAllByText('reporter, all time')).toHaveLength(1);
  },
};

/** An export from the old reporter: its all-time figures show as dashes, still marked. */
export const OldReporter: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': modelsOldReporter });
  },
  play: async ({ canvas }) => {
    const row = async (name: string) => (await canvas.findByRole('rowheader', { name })).closest('tr')!;
    await expect(cells(await row('implementer'))).toEqual(['opus-5-5/medium 22', 'opus-5-5/medium 22', '–']);
    await expect(cells(await row('full'))).toEqual(['–', 'opus-5-5/medium 5', '–']);
    for (const name of ['calls by role', 'failed calls', 'tokens', 'est. cost', 'notes', 'trial']) {
      await expect(cells(await row(name))).toEqual(['–']);
    }
  },
};

/** The path, project and period filters go to the API as query params. */
export const Filters: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      ...projects,
      '/api/models?weeks=4': modelsFull,
      '/api/models?path=full&weeks=4': modelsFull,
      '/api/models?path=full&weeks=12': modelsFull,
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('rowheader', { name: 'implementer' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '12');
    await expect(fetch).toHaveBeenCalledWith('/api/models?path=full&weeks=12');
  },
};
