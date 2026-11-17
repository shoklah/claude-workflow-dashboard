import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { cells, expectColgroups, expectNoJoined } from '../test/table.ts';
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
const MARK = 'reporter, all time';
const NO_FACTS = 'No advisor facts: the export is from before the reporter counted them.';

/** The rows of a table's body, from the one its row header names, as cell texts. */
function lines(table: HTMLElement, name: string, count: number): string[][] {
  const first = within(table).getByRole('rowheader', { name }).closest('tr')!;
  const rows = [first];
  while (rows.length < count) rows.push(rows[rows.length - 1].nextElementSibling as HTMLTableRowElement);
  return rows.map(cells);
}

/** A table's column headers, as text. */
function columns(table: HTMLElement): string[] {
  return within(table)
    .getAllByRole('columnheader')
    .map((header) => header.textContent ?? '');
}

/** The table inside the scroll region named `name`. */
const table = (canvas: HTMLElement, name: string) => within(within(canvas).getByRole('region', { name })).getByRole('table');

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText('Loading the models and advisor…');
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText("Couldn't load the models and advisor.");
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

/** Empty: no dispatches, main sessions, advisor calls or advisor weeks in the period; the reporter's stage table and
 * trial show. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': modelsEmpty });
  },
  play: async ({ canvas, canvasElement }) => {
    const empty = await canvas.findByText(
      'No dispatches in this period. An agent shows here once a run or session dispatches it.',
    );
    await expect(empty).toHaveAttribute('colspan', '8');
    await expect(canvas.getByText('No advisor calls in this period.')).toBeVisible();
    await expect(canvas.getByText('No failed calls in this period.')).toBeVisible();
    await expect(canvas.getByText('No advisor weeks in this period.')).toBeVisible();
    const main = table(canvasElement, 'Main sessions table');
    await expect(lines(main, 'Full', 1)).toEqual([
      ['Opus 5.5medium', 'Opus 5.5medium', 'Opus 5.5medium', 'Opus 5.5medium', 'No sessions', '0'],
    ]);
    const period = within(canvas.getByRole('region', { name: 'This period' }));
    await expect(period.getAllByRole('definition')[0]).toHaveTextContent('0');
    // A zero shows muted, tokens, cost and share alike.
    for (const zero of ['0', '$0.00', '0%']) {
      for (const value of period.getAllByText(zero, { selector: 'span' })) await expect(value).toHaveClass('text-muted-foreground');
    }
    await expectNoJoined(canvasElement);
  },
};

/**
 * Full: the agents and main sessions, one model and effort per line with the item's cells spanning its lines; the
 * advisor's facts for the period, its calls by role and failed calls; its spend by week. The reporter's all-time
 * figures (mismatches, the stage table, differs, the trial and the advisor's weeks) carry the reporter's mark.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': modelsFull });
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('rowheader', { name: 'final-reviewer' });
    await expectColgroups(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Models and advisor', level: 1 })).toBeVisible();
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');

    const agents = table(canvasElement, 'Agents table');
    await expect(canvas.getByRole('region', { name: 'Agents table' })).toHaveAttribute('tabindex', '0');
    // Each table sits in a section, a region named by its title; the advisor's tables share theirs.
    for (const [name, inner] of [
      ['Agents', 'Agents table'],
      ['Main sessions', 'Main sessions table'],
      ['Advisor', 'Advisor calls by role'],
      ['Advisor', 'Failed calls, by error'],
      ['Advisor spend by week', 'Advisor spend by week table'],
    ]) {
      await expect(within(canvas.getByRole('region', { name })).getByRole('region', { name: inner })).toBeVisible();
    }
    await expect(columns(agents)).toEqual([
      'Agent',
      'Requested',
      'Ran on',
      `Mismatches${MARK}`,
      'Model',
      'Effort',
      'Dispatches',
      'Model',
      'Effort',
      'Dispatches',
    ]);
    await expect(within(agents).getByRole('rowheader', { name: 'final-reviewer' })).toHaveAttribute('rowspan', '2');
    await expect(lines(agents, 'final-reviewer', 2)).toEqual([
      ['–not set', 'xhigh', '5', 'Fable 5.1', 'xhigh', '4', '1'],
      ['', 'Opus 5.5', 'xhigh', '1'],
    ]);
    // A pair with no model or effort shows the dash.
    await expect(lines(agents, 'task-reviewer', 1)).toEqual([['–not set', '–not set', '31', 'Opus 5.5', 'high', '31', '0']]);

    const main = table(canvasElement, 'Main sessions table');
    await expect(columns(main)).toEqual([
      'Path',
      `Recommended, by stage${MARK}`,
      'Ran on',
      `Differs${MARK}`,
      'Stage 1',
      'Stage 2',
      'Stage 3',
      'Out',
      'Model',
      'Effort',
      'Sessions',
    ]);
    await expect(lines(main, 'Small', 1)).toEqual([['–none', 'Opus 5.5', 'Opus 5.5', 'Opus 5.5', 'No sessions', '0']]);
    await expect(lines(main, 'Plan', 2)).toEqual([
      ['Fable 5.1', 'Fable 5.1', 'Fable 5.1', 'Fable 5.1', 'Opus 5.5', 'high', '2', '2'],
      ['Fable 5.1', 'high', '2'],
    ]);
    // A stage's effort sits under its model in secondary ink.
    const fullRow = within(main).getByRole('rowheader', { name: 'Full' }).closest('tr')!;
    await expect(within(fullRow).getAllByText('medium')[0]).toHaveClass('text-muted-foreground');

    const period = within(canvas.getByRole('region', { name: 'This period' }));
    await expect(period.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Calls',
      'Tokens',
      'Est. cost',
      'Notes',
      'Notes that changed something',
      'Notes missing',
      'Share of Fable spend',
      `Trial${MARK}`,
    ]);
    await expect(period.getAllByRole('definition').map((value) => value.textContent)).toEqual([
      '14',
      '43.5K',
      '$3.20',
      '12',
      '9',
      '2',
      '8%',
      'runs 8/5, weeks 0/3 CHECKPOINT',
    ]);
    // The trial is a term and its value, the reporter's mark in the term.
    await expect(within(period.getAllByRole('term').at(-1)!).getByText(MARK)).toBeVisible();

    const roles = table(canvasElement, 'Advisor calls by role');
    await expect(columns(roles)).toEqual(['Role', 'Calls', 'May consult']);
    await expect(lines(roles, 'implementer', 3)).toEqual([['3', 'yes'], ['9', 'yes'], ['2', 'no']]);
    await expect(within(roles).getByText('no')).toHaveClass('text-warning-ink');

    const failed = table(canvasElement, 'Failed calls, by error');
    await expect(columns(failed)).toEqual(['Failed calls, by error', 'Calls']);
    await expect(lines(failed, 'overloaded error', 1)).toEqual([['1']]);

    const weeks = table(canvasElement, 'Advisor spend by week table');
    await expect(columns(weeks)).toEqual([`Week${MARK}`, 'Advisor ($)', 'Fable ($)', 'Share (%)', 'Past the stop share']);
    await expect(lines(weeks, 'Nov 1', 2)).toEqual([
      ['9.80', '25.10', '39', 'yes'],
      ['3.20', '41.00', '8', 'no'],
    ]);

    // Only the reporter's figures are marked: mismatches, the stage table, differs, the trial and the weeks.
    await expect(canvas.getAllByText(MARK)).toHaveLength(5);
    await expectNoJoined(canvasElement);
  },
};

/** An export from the old reporter: its all-time figures show as dashes and the advisor's facts say why they're
 * missing. */
export const OldReporter: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/models?weeks=4': modelsOldReporter });
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('rowheader', { name: 'final-reviewer' });
    await expect(lines(table(canvasElement, 'Agents table'), 'implementer', 1)).toEqual([
      ['Opus 5.5', 'medium', '22', 'Opus 5.5', 'medium', '22', '–not known'],
    ]);
    await expect(lines(table(canvasElement, 'Main sessions table'), 'Full', 1)).toEqual([
      ['–not known', '–not known', '–not known', '–not known', 'Opus 5.5', 'medium', '5', '–not known'],
    ]);
    await expect(canvas.getAllByText(NO_FACTS)).toHaveLength(3);
    const period = within(canvas.getByRole('region', { name: 'This period' }));
    await expect(period.getByText('not known')).toBeInTheDocument();
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
    await canvas.findByRole('rowheader', { name: 'final-reviewer' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '12');
    await expect(fetch).toHaveBeenCalledWith('/api/models?path=full&weeks=12');
  },
};
