import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn, within } from 'storybook/test';
import { parseTime, type StatusResponse } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { mockApi } from '../test/mock-api.ts';
import { fullRun, oldRun, runBeforeSteps, runFull, runSmall, smallRun } from '../test/runs.ts';
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

/** A zero time, cost or token count shows muted, as every zero does. */
export const Zeros: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      [`/api/runs/${fullRun.key}`]: {
        ...runFull,
        facts: { ...runFull.facts, minutes: 0, cost: 0 },
        context: { ...runFull.context!, medianTokens: 0 },
      },
    });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('0 min')).toHaveClass('text-muted-foreground');
    await expect(canvas.getByText('$0.00')).toHaveClass('text-muted-foreground');
    await expect(within(canvas.getByRole('region', { name: 'Context' })).getByText('0')).toHaveClass('text-muted-foreground');
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
    const flow = canvas.getByRole('region', { name: 'Flow' });
    await expect(within(flow).getByText('Recorded before steps were logged: there is no flow to draw.')).toBeVisible();
    await expect(canvas.queryByRole('group', { name: "The run's flow" })).toBeNull();
    await expect(canvas.queryByText(HINT)).toBeNull();
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

/** Full: the branch as title, the header's facts as terms, the run's flow, and the run's side panel as labelled pairs. */
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
    const flow = canvas.getByRole('region', { name: 'Flow' });
    await expect(within(flow).getByRole('group', { name: "The run's flow" })).toBeVisible();

    await expect(pairs(canvas.getByRole('region', { name: 'Skills' }))).toEqual([
      ['subagent-driven-development', 'ran'],
      ['simplify', 'applied 1, skipped 0'],
    ]);
    // A model shows by its name, never its id.
    await expect(pairs(canvas.getByRole('region', { name: 'Models' }))).toEqual([
      ['Opus 5.5', '$5.20'],
      ['Fable 5.1', '$1.90'],
    ]);
    // A skill's and a model's name in primary ink, the outcome and cost muted; Advisor's terms muted as labels.
    for (const name of ['Skills', 'Models']) {
      for (const dt of canvas.getByRole('region', { name }).querySelectorAll('dt')) {
        await expect(dt).not.toHaveClass('text-muted-foreground');
        await expect(dt.nextElementSibling).toHaveClass('text-muted-foreground');
      }
    }
    await expect(canvas.getByRole('region', { name: 'Advisor' }).querySelector('dt')).toHaveClass('text-muted-foreground');
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
    // The findings as two tables, each under its titled icon; no "Findings" heading, no Step select.
    for (const [name, ink] of [['Problems (6)', 'text-notice-edge'], ['Strengths (2)', 'text-success-edge']]) {
      const heading = canvas.getByRole('heading', { name });
      await expect(heading.querySelector('svg')).toHaveClass(ink);
      await expect(heading.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    }
    await expect(canvas.queryByRole('heading', { name: /^Findings/ })).toBeNull();
    await expect(canvas.queryByRole('combobox', { name: 'Step' })).toBeNull();
    await expect(canvas.getByRole('region', { name: 'Problems table' })).toHaveClass('border-l-notice-edge');
    await expect(canvas.getByRole('region', { name: 'Strengths table' })).toHaveClass('border-l-success-edge');
  },
};

const HINT = 'Select a task or a review to see its rounds, and its findings below.';

/** Selecting a box opens its detail under the graph in place of the hint; Close brings the hint back. */
export const SelectStep: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, userEvent }) => {
    const flow = within(await canvas.findByRole('region', { name: 'Flow' }));
    await expect(flow.getByText(HINT)).toBeVisible();
    const task1 = flow.getByRole('button', { name: /^Task 1(?!\d)/ });
    const scroll = spyOn(HTMLElement.prototype, 'scrollIntoView');
    await userEvent.click(task1);
    await expect(flow.queryByText(HINT)).toBeNull();
    const detail = flow.getByRole('region', { name: 'Task 1' });
    const heading = within(detail).getByRole('heading', { name: 'Task 1' });
    await expect(heading).toBeVisible();
    // Only the title row is brought into view, never the whole detail.
    await expect(scroll).toHaveBeenCalledTimes(1);
    await expect(scroll.mock.contexts[0]).toBe(heading.parentElement);
    await userEvent.click(within(detail).getByRole('button', { name: 'Close Task 1' }));
    // Closing doesn't scroll.
    await expect(scroll).toHaveBeenCalledTimes(1);
    await expect(flow.getByText(HINT)).toBeVisible();
    await expect(flow.queryByRole('region', { name: 'Task 1' })).toBeNull();
    await expect(task1).toHaveAttribute('aria-pressed', 'false');
  },
};

const otherKey = 'f60718293a4b5c6d';

/** The page for one key, then another, as the route keeps it mounted when only its key changes. */
function Switching() {
  const [runKey, setRunKey] = useState(fullRun.key);
  return (
    <>
      <button type="button" onClick={() => setRunKey(otherKey)}>
        Other run
      </button>
      <RunPage runKey={runKey} />
    </>
  );
}

/** A selection belongs to its run: unit ids repeat across runs, so the other run shows no box pressed and the hint. */
export const OtherRun: Story = {
  render: () => <Switching />,
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull, [`/api/runs/${otherKey}`]: runFull });
  },
  play: async ({ canvas, userEvent }) => {
    const flow = await canvas.findByRole('region', { name: 'Flow' });
    await userEvent.click(within(flow).getByRole('button', { name: /^Task 1(?!\d)/ }));
    await expect(within(flow).getByRole('region', { name: 'Task 1' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Other run' }));
    await expect(fetch).toHaveBeenCalledWith(`/api/runs/${otherKey}`);
    const other = within(await canvas.findByRole('region', { name: 'Flow' }));
    await expect(await other.findByText(HINT)).toBeVisible();
    for (const box of other.getAllByRole('button')) await expect(box).toHaveAttribute('aria-pressed', 'false');
  },
};

/** The data rows of the table region named `name`, by their first cell. */
function ids(canvasElement: HTMLElement, name: string): (string | null)[] {
  const region = within(canvasElement).getByRole('region', { name });
  return [...region.querySelectorAll('tbody tr')].map((tr) => tr.firstElementChild!.textContent);
}

/** A selected step filters Problems and Strengths, and their titles name it; closing restores the whole run. */
export const SelectedStepTables: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const flow = within(await canvas.findByRole('region', { name: 'Flow' }));
    await userEvent.click(flow.getByRole('button', { name: /^Task 1(?!\d)/ }));
    await expect(canvas.getByRole('heading', { name: 'Problems in Task 1 (2)' })).toBeVisible();
    await expect(ids(canvasElement, 'Problems table')).toEqual(['F1', 'F2']);
    const strengths = canvas.getByRole('region', { name: 'Strengths in Task 1 (0)' });
    await expect(within(strengths).getByText('The reviewers named no strength in Task 1.')).toBeVisible();
    await expect(within(strengths).getByText('The reviewers named no strength in Task 1.')).toHaveClass('glass', 'border-l-success-edge');
    await expect(canvas.queryByRole('region', { name: 'Strengths table' })).toBeNull();

    await userEvent.click(within(flow.getByRole('region', { name: 'Task 1' })).getByRole('button', { name: 'Close Task 1' }));
    await expect(canvas.getByRole('heading', { name: 'Problems (6)' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Strengths (2)' })).toBeVisible();

    await userEvent.click(flow.getByRole('button', { name: /^Task 3(?!\d)/ }));
    const problems = canvas.getByRole('region', { name: 'Problems in Task 3 (0)' });
    const line = within(problems).getByText('Task 3 found no problem.');
    await expect(line).toHaveClass('glass', 'border-l-notice-edge');
    await expect(within(problems).queryByRole('table')).toBeNull();
    await expect(within(problems).queryByRole('combobox')).toBeNull();
    await expect(canvas.getByRole('heading', { name: 'Strengths in Task 3 (1)' })).toBeVisible();
    await expect(ids(canvasElement, 'Strengths table')).toEqual(['S1']);
  },
};

/** A severity filter that matches nothing keeps the filters' own message. */
export const ProblemsNoMatch: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(within(await canvas.findByRole('region', { name: 'Flow' })).getByRole('button', { name: /^Task 1(?!\d)/ }));
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Severity' }), 'important');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Outcome' }), 'deferred');
    await expect(canvas.getByText('No findings match these filters. Set a filter back to All to see more.')).toBeVisible();
  },
};

/** A run with no finding and no strength says so in each section's line. */
export const Small: Story = {
  args: { runKey: smallRun.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${smallRun.key}`]: runSmall });
  },
  play: async ({ canvas }) => {
    const problems = await canvas.findByRole('region', { name: 'Problems (0)' });
    await expect(within(problems).getByText('The reviews found no problem in this run.')).toBeVisible();
    const strengths = canvas.getByRole('region', { name: 'Strengths (0)' });
    await expect(within(strengths).getByText('The reviewers named no strength in this run.')).toBeVisible();
  },
};

/** A run recorded before steps has no findings or strengths to list, and says why. */
export const EmptyTables: Story = {
  args: { runKey: oldRun.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${oldRun.key}`]: runBeforeSteps });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Recorded before findings were logged: this run has none to list.')).toBeVisible();
    await expect(canvas.getByText('Recorded before strengths were logged: this run has none to list.')).toBeVisible();
  },
};
