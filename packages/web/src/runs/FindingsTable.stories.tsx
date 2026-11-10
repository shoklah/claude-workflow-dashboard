import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { NONE } from '../lib/format.ts';
import { HTML_TEXT, fullRun, runFull, workflowFindings } from '../test/runs.ts';
import { FindingsTable } from './FindingsTable.tsx';

const meta = { component: FindingsTable } satisfies Meta<typeof FindingsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

const APP_LABEL = "The app's label";

/** The text of each body row's cell under the header `name`. */
function column(canvasElement: HTMLElement, name: string): (string | null)[] {
  const index = [...canvasElement.querySelectorAll('th')].findIndex((th) => th.textContent === name);
  return [...canvasElement.querySelectorAll('tbody tr')].map((tr) => tr.children[index].textContent);
}

export const Empty: Story = {
  args: { findings: [], categoryLabels: {} },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No findings.')).toBeVisible();
  },
};

/**
 * Full: every finding of the run, one row each, its free text shown as text. The app's labels: each category in a
 * dashed badge, named by the response's `categoryLabels`, the relevance call with its reason in a tooltip; Valid is "–"
 * on a run the workflow didn't label.
 */
export const Full: Story = {
  args: { findings: runFull.findings, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers).toEqual([
      '#',
      'Step',
      'Task',
      'Severity',
      'Category',
      'Summary',
      'Outcome',
      'Reason',
      'Verdicts',
      'Valid',
      'App',
    ]);
    await expect(canvas.getAllByRole('row')).toHaveLength(7);
    // It scrolls sideways: its container is a named tab stop.
    await expect(canvas.getByRole('region', { name: 'Findings' })).toHaveAttribute('tabindex', '0');
    await expect(canvas.getAllByText(HTML_TEXT)).toHaveLength(1);
    await expect(canvas.getByText(HTML_TEXT)).toBeVisible();
    await expect(column(canvasElement, 'Category')).toEqual([
      'Correctness',
      'Naming and clarity',
      'Security and privacy',
      'Data safety',
      'Simplicity',
      'unlabelled',
    ]);
    const badges = canvas.getAllByTitle(APP_LABEL);
    await expect(badges).toHaveLength(5);
    for (const badge of badges) await expect(badge).toHaveClass('border-dashed');
    await expect(column(canvasElement, 'Valid')).toEqual(Array(6).fill(NONE));
    await expect(column(canvasElement, 'App')).toEqual(['valid', 'unclear', 'valid', 'invalid', 'valid', NONE]);
    await userEvent.hover(canvas.getByText('invalid'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      'The run means both tasks to share the index',
    );
    await expect(canvasElement.querySelector('img')).toBeNull();
    const outcomes = canvas.getByRole('combobox', { name: 'Outcome' });
    await expect([...outcomes.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'All',
      'applied',
      'deferred',
      'fixed',
      'open',
      'ruled',
    ]);
  },
};

/** Filtering by outcome `ruled` leaves the one ruled finding, with its reason. */
export const FilterRuled: Story = {
  args: { findings: runFull.findings, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Outcome' }), 'ruled');
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows).toHaveLength(1);
    const row = within(rows[0]);
    await expect(row.getByText('F4')).toBeVisible();
    await expect(row.getByText('One index per run is intended')).toBeVisible();
    await expect(rows[0]).toHaveTextContent('open, open, open');
  },
};

/** Step and severity filter too, and together. */
export const FilterStepAndSeverity: Story = {
  args: { findings: runFull.findings, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Step' }), 'task_review');
    await expect(canvas.getAllByRole('row').slice(1)).toHaveLength(4);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Severity' }), 'important');
    const rows = canvas.getAllByRole('row').slice(1);
    await expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual(['F1', 'F4']);
  },
};

/** No finding labelled yet: every category is "unlabelled", with no badge, and the App column is "–". */
export const Unlabelled: Story = {
  args: {
    findings: runFull.findings.map((f) => ({ ...f, category: null, relevance: null, labelReason: null })),
    categoryLabels: runFull.categoryLabels,
  },
  play: async ({ canvas, canvasElement }) => {
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers).toEqual(expect.arrayContaining(['Category', 'Valid', 'App']));
    await expect(column(canvasElement, 'Category')).toEqual(Array(6).fill('unlabelled'));
    await expect(canvas.queryAllByTitle(APP_LABEL)).toEqual([]);
    await expect(column(canvasElement, 'App')).toEqual(Array(6).fill(NONE));
  },
};

/**
 * After CR10: the workflow's categories in plain badges, the app's own in the dashed one; Valid is the workflow's
 * call; App says "agrees", or the app's category and call where they differ, or its own call where it is the label.
 */
export const WorkflowLabels: Story = {
  args: { findings: workflowFindings, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(column(canvasElement, 'Category')).toEqual([
      'Reuse and duplication',
      'Tests',
      'Conventions',
      'Simplicity',
    ]);
    const badges = canvas.getAllByTitle(APP_LABEL);
    await expect(badges.map((badge) => badge.textContent)).toEqual(['Conventions']);
    await expect(badges[0]).toHaveClass('border-dashed');
    await expect(canvas.getByText('Tests')).not.toHaveClass('border-dashed');
    await expect(column(canvasElement, 'Valid')).toEqual(['valid', 'invalid', NONE, 'unclear']);
    await expect(column(canvasElement, 'App')).toEqual(['agrees', 'Correctness · valid', 'valid', NONE]);
    await userEvent.hover(canvas.getByText('Correctness · valid'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent('An empty export is a real case');
  },
};

/** A category the labels don't name shows as its id. */
export const UnnamedCategory: Story = {
  args: { findings: runFull.findings.slice(0, 1), categoryLabels: {} },
  play: async ({ canvasElement }) => {
    await expect(column(canvasElement, 'Category')).toEqual(['correctness']);
  },
};

/** With `run`, the first column links each finding to its run's page, as the Findings page lists them. */
export const WithRun: Story = {
  args: {
    findings: runFull.findings.map((f) => ({
      ...f,
      runKey: fullRun.key,
      project: fullRun.project,
      branch: fullRun.branch,
    })),
    categoryLabels: runFull.categoryLabels,
    run: true,
  },
  play: async ({ canvas, canvasElement }) => {
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers.slice(0, 2)).toEqual(['Run', '#']);
    await expect(headers).toEqual(expect.arrayContaining(['Category', 'Valid', 'App']));
    await expect(canvas.getAllByTitle(APP_LABEL)).toHaveLength(5);
    const links = canvas.getAllByRole('link', { name: 'atlas · feat/search' });
    await expect(links).toHaveLength(6);
    await expect(links[0]).toHaveAttribute('href', `/runs/${fullRun.key}`);
    await expect(column(canvasElement, 'Run')).toEqual(Array(6).fill('atlas · feat/search'));
  },
};
