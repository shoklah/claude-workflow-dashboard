import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime, type StatusResponse } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { mockApi } from '../test/mock-api.ts';
import { fullRun, oldRun, runBeforeSteps, runFull } from '../test/runs.ts';
import { RunPage } from './RunPage.tsx';

const meta = { component: RunPage, args: { runKey: fullRun.key } } satisfies Meta<typeof RunPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };

/** Each term of a definition list and its value, in order. */
function pairs(list: Element): [string | null, string | null][] {
  return [...list.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling!.textContent]);
}

/** The key goes into the API's path URL-encoded. */
export const Loading: Story = {
  args: { runKey: 'odd key/1' },
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/runs/odd%20key%2F1': 'pending' });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText('Loading the run…');
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
    await expect(fetch).toHaveBeenCalledWith('/api/runs/odd%20key%2F1');
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: 404 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText("Couldn't load this run.");
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

/** Empty: a record from before steps, with no skills, models, advisor notes, context or warnings: each says so. */
export const Empty: Story = {
  args: { runKey: oldRun.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${oldRun.key}`]: runBeforeSteps });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'feat/import', level: 1 })).toBeVisible();
    await expect(canvas.getByText(/recorded before steps were logged/i)).toBeVisible();
    const none = {
      Skills: 'No skill loaded.',
      Models: 'No model recorded.',
      Advisor: 'Not consulted.',
      Context: 'No context facts for this run.',
      Warnings: 'No warnings.',
    };
    for (const [name, text] of Object.entries(none)) {
      await expect(within(canvas.getByRole('region', { name })).getByText(text)).toBeVisible();
    }
  },
};

/** Full: the branch as title, the header's facts as terms, the timeline, and the run's side panel as labelled pairs. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('heading', { name: 'feat/search', level: 1 })).toBeVisible();
    await expect(pairs(canvasElement.querySelector('dl')!)).toEqual([
      ['Project', 'atlas'],
      ['Path', 'Full'],
      ['Stage', '1'],
      ['Time', '2 h 10'],
      ['Est. cost', '$7.10'],
      ['Findings', '6'],
      ['Closed', '5'],
      ['Warnings', '1'],
    ]);
    const view = canvas.getByRole('group', { name: 'View' });
    await expect(within(view).getByRole('button', { name: 'Timeline' })).toHaveAttribute('aria-pressed', 'true');
    await expect(within(view).getByRole('button', { name: 'Findings' })).toHaveAttribute('aria-pressed', 'false');
    await expect(canvas.queryAllByRole('tab')).toEqual([]);

    await expect(pairs(canvas.getByRole('region', { name: 'Skills' }))).toEqual([
      ['subagent-driven-development', 'ran'],
      ['simplify', 'applied 1, skipped 0'],
    ]);
    // A model shows by its name, never its id.
    await expect(pairs(canvas.getByRole('region', { name: 'Models' }))).toEqual([
      ['Opus 5.5', '$5.20'],
      ['Fable 5.1', '$1.90'],
    ]);
    await expect(pairs(canvas.getByRole('region', { name: 'Advisor' }))).toEqual([
      ['Calls', '3'],
      ['Notes', '3'],
    ]);
    await expect(pairs(canvas.getByRole('region', { name: 'Context' }))).toEqual([
      ['Calls', '214'],
      ['Median tokens', '281K'],
      ['Largest tokens', '1.3M'],
      ['Calls past the cap', '62'],
      ['Handed off', formatDayTime(parseTime('2026-11-10T16:40:00.000Z'))],
      ['Tool results (characters)', '912K'],
      ['Read share', '44%'],
      ['Sweeps inline', '1'],
      ['Sweeps delegated', '4'],
    ]);
    const warnings = within(canvas.getByRole('region', { name: 'Warnings' }));
    await expect(warnings.getByText('0f1e2d3c')).toBeVisible();
    await expect(warnings.getByRole('button', { name: 'Copy session ID' })).toBeVisible();
    // The run's own "branch (date):" lead is gone: the page already names the run.
    await expect(warnings.getByText('Final review without simplify: final_review at step 4')).toBeVisible();
    await expect(canvasElement.textContent).not.toContain(' · ');
  },
};

/** Under the findings table, the reviewers' strengths: each one's category, summary and step. */
export const Strengths: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Findings' }));
    const strengths = canvas.getByRole('region', { name: 'Strengths' });
    await expect([...strengths.querySelectorAll('li')].map((li) => li.textContent)).toEqual([
      'Reuse and duplicationNew page reuses the shared table and format helpersTask review · task 3',
      'TestsEach view tested on both fixtures, null facts includedFinal review',
    ]);
    await expect(strengths.querySelector('[data-slot="badge"]')).toBeNull();
  },
};

/** A run with no strengths and no findings says so under its findings table. */
export const NoStrengths: Story = {
  args: { runKey: oldRun.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${oldRun.key}`]: runBeforeSteps });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Findings' }));
    await expect(within(canvas.getByRole('region', { name: 'Strengths' })).getByText('No strengths recorded.')).toBeVisible();
  },
};

/** The switch moves between the timeline and every finding in one table. */
export const Toggle: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Started')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Findings' }));
    await expect(canvas.getByRole('button', { name: 'Findings' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.queryByText('Started')).toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Timeline' }));
    await expect(canvas.getByText('Started')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};
