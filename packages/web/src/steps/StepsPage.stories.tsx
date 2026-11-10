import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { runsFull } from '../test/runs.ts';
import { stepsEmpty, stepsFull, stepsOldReporter } from '../test/steps.ts';
import { StepsPage } from './StepsPage.tsx';

const meta = { component: StepsPage } satisfies Meta<typeof StepsPage>;
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

export const Loading: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the steps and rules…')).toBeVisible();
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': 500 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load the steps and rules.")).toBeVisible();
  },
};

/** Empty: every step kind with nothing run, no offers, and the reporter's all-time figures still shown. */
export const Empty: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': stepsEmpty });
  },
  play: async ({ canvas }) => {
    const review = (await canvas.findByRole('rowheader', { name: 'Task review' })).closest('tr')!;
    await expect(cells(review)).toEqual(['0', '0', '–', '0', '0', '0', '0', '0', '$0.00']);
    await expect(canvas.queryByRole('rowheader', { name: /^offer/ })).toBeNull();
    const startup = canvas.getByRole('rowheader', { name: /^startup guidelines/ }).closest('tr')!;
    await expect(cells(startup).slice(0, 3)).toEqual(['41', '–', 'with 38 · without 3']);
  },
};

/**
 * Full: the static page's rows, steps then rules, with its columns; simplify's spend is unknown, and the reporter's
 * all-time figures carry the "reporter, all time" mark.
 */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': stepsFull });
  },
  play: async ({ canvas }) => {
    const review = (await canvas.findByRole('rowheader', { name: 'Task review' })).closest('tr')!;
    await expect(canvas.getByRole('combobox', { name: 'Period' })).toHaveValue('4');
    await expect(canvas.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Step or rule',
      'Ran',
      'Found something',
      'Counts',
      'Fixed or applied',
      'Declined',
      'Deferred',
      'Open or to owner',
      'Tokens',
      'Est. cost',
    ]);
    await expect(cells(review)).toEqual([
      '31',
      '22',
      'critical 1 · important 18 · minor 47',
      '24',
      '3',
      '38',
      '1',
      '9.8M',
      '$21.40',
    ]);
    const simplify = canvas.getByRole('rowheader', { name: 'simplify' }).closest('tr')!;
    await expect(cells(simplify).slice(-2)).toEqual(['–', '–']);

    const row = (name: RegExp) => canvas.getByRole('rowheader', { name }).closest('tr')!;
    await expect(cells(row(/^failing-test check$/)).slice(0, 3)).toEqual([
      '27',
      '–',
      'passed 22 · failed 1 · no tests 1 · couldnt run 2 · exempt 1',
    ]);
    await expect(cells(row(/^dispatch guard/)).slice(0, 3)).toEqual(['–', '3', 'no model 2 · no simplify 1']);
    await expect(cells(row(/^advisor/))).toContain('notes 12 · changed 9 · share 8%');
    await expect(cells(row(/^advisor/)).at(-1)).toBe('$3.20');
    await expect(cells(row(/^fix-round cap$/))[2]).toBe('runs 1 · ruled 2');
    await expect(cells(row(/^stop rule$/))[2]).toBe('stops 1');
    await expect(cells(row(/^offer grill-me$/)).slice(0, 3)).toEqual([
      '3',
      '–',
      'accepted 2 · skipped 1 · not offered 0 · updated 0',
    ]);

    // The reporter's figures are marked; the period's sums aren't.
    for (const name of [/^dispatch guard/, /^advisor/, /^startup guidelines/]) {
      await expect(within(row(name)).getByText('reporter, all time')).toBeVisible();
    }
    await expect(within(row(/^failing-test check$/)).queryByText('reporter, all time')).toBeNull();
  },
};

/** An export from the old reporter: its all-time figures show as dashes, still marked. */
export const OldReporter: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, ...projects, '/api/steps?weeks=4': stepsOldReporter });
  },
  play: async ({ canvas }) => {
    const row = async (name: RegExp) => (await canvas.findByRole('rowheader', { name })).closest('tr')!;
    await expect(cells(await row(/^dispatch guard/)).slice(0, 3)).toEqual(['–', '–', '–']);
    await expect(cells(await row(/^advisor/)).slice(0, 3)).toEqual(['–', '–', '–']);
    await expect(cells(await row(/^advisor/)).at(-1)).toBe('–');
    await expect(cells(await row(/^startup guidelines/)).slice(0, 3)).toEqual(['–', '–', '–']);
    await expect(within(await row(/^startup guidelines/)).getByText('reporter, all time')).toBeVisible();
  },
};

/** The path, project and period filters go to the API as query params. */
export const Filters: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      ...projects,
      '/api/steps?weeks=4': stepsFull,
      '/api/steps?path=full&weeks=4': stepsFull,
      '/api/steps?path=full&weeks=12': stepsFull,
    });
  },
  play: async ({ canvas, userEvent }) => {
    await canvas.findByRole('rowheader', { name: 'Task review' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Path' }), 'full');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Period' }), '12');
    await expect(fetch).toHaveBeenCalledWith('/api/steps?path=full&weeks=12');
  },
};
