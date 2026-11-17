import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { NONE, PROBLEMS_SIDE } from '../lib/format.ts';
import { HTML_TEXT, fullRun, runFull, workflowFindings } from '../test/runs.ts';
import { FindingsTable } from './FindingsTable.tsx';

const meta = { component: FindingsTable } satisfies Meta<typeof FindingsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No cell joins values with " · " outside the App column. */
async function plain(canvasElement: HTMLElement): Promise<void> {
  const app = [...canvasElement.querySelectorAll('th')].findIndex((th) => th.textContent === 'App');
  for (const tr of canvasElement.querySelectorAll('tbody tr')) {
    for (const [i, td] of [...tr.children].entries()) if (i !== app) await expect(td.textContent).not.toContain(' · ');
  }
}

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

/** Filters that match nothing say so, and how to see more. */
export const NoMatch: Story = {
  args: { findings: runFull.findings, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, userEvent }) => {
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Step' }), 'simplify');
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Severity' }), 'critical');
    await expect(
      canvas.getByText('No findings match these filters. Set a filter back to All to see more.'),
    ).toBeVisible();
  },
};

/**
 * Full: every finding of the run, one row each, its free text shown as text. The app's labels: each category as plain
 * text, named by the response's `categoryLabels`, "App" under Labelled by, the relevance call with its reason in a
 * tooltip; Valid is "–" on a run the workflow didn't label.
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
      'Labelled by',
      'Summary',
      'Outcome',
      'Reason',
      'Fix-check verdicts',
      'Valid',
      'App',
    ]);
    await expect(canvas.getAllByRole('row')).toHaveLength(7);
    await plain(canvasElement);
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
    await expect(column(canvasElement, 'Labelled by')).toEqual([...Array(5).fill('App'), `${NONE}not labelled`]);
    await expect(column(canvasElement, 'Severity')).toEqual(['Important', 'Minor', 'Critical', 'Important', `${NONE}not known`, 'Minor']);
    await expect(column(canvasElement, 'Fix-check verdicts')).toEqual(['Fixed', `${NONE}none`, 'Fixed', 'OpenOpenOpen', `${NONE}none`, `${NONE}none`]);
    await expect(column(canvasElement, 'Valid')).toEqual(Array(6).fill(`${NONE}not known`));
    await expect(column(canvasElement, 'App')).toEqual(['Valid', 'Unclear', 'Valid', 'Invalid', 'Valid', `${NONE}no app label`]);
    await userEvent.hover(canvas.getByText('Invalid'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      'The run means both tasks to share the index',
    );
    await expect(canvasElement.querySelector('img')).toBeNull();
    const outcomes = canvas.getByRole('combobox', { name: 'Outcome' });
    await expect([...outcomes.querySelectorAll('option')].map((o) => o.textContent)).toEqual([
      'All',
      'Applied',
      'Deferred',
      'Fixed',
      'Open',
      'Ruled',
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
    await expect(row.getAllByText('Open')).toHaveLength(3);
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

/** No finding labelled yet: every category is "unlabelled", Labelled by and the App column "–". */
export const Unlabelled: Story = {
  args: {
    findings: runFull.findings.map((f) => ({ ...f, category: null, relevance: null, labelReason: null })),
    categoryLabels: runFull.categoryLabels,
  },
  play: async ({ canvas, canvasElement }) => {
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers).toEqual(expect.arrayContaining(['Category', 'Labelled by', 'Valid', 'App']));
    await expect(column(canvasElement, 'Category')).toEqual(Array(6).fill('unlabelled'));
    await expect(column(canvasElement, 'Labelled by')).toEqual(Array(6).fill(`${NONE}not labelled`));
    await expect(column(canvasElement, 'App')).toEqual(Array(6).fill(`${NONE}no app label`));
  },
};

/**
 * After CR10: each category as plain text, Labelled by naming whose label it is; Valid is the workflow's call; App says "agrees" when the workflow made both calls and the app's match, else the app's category where it
 * differs and its call where it differs or the workflow made none.
 */
export const WorkflowLabels: Story = {
  args: { findings: workflowFindings, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(column(canvasElement, 'Category')).toEqual([
      'Reuse and duplication',
      'Tests',
      'Conventions',
      'Simplicity',
      'Correctness',
      'Correctness',
    ]);
    await expect(column(canvasElement, 'Labelled by')).toEqual(['Workflow', 'Workflow', 'App', 'Workflow', 'Workflow', 'Workflow']);
    await expect(canvas.getAllByRole('row')).toHaveLength(7);
    await plain(canvasElement);
    await expect(column(canvasElement, 'Valid')).toEqual(['Valid', 'Invalid', `${NONE}not known`, 'Unclear', `${NONE}not known`, `${NONE}not known`]);
    // With no validity from the workflow, the app's call shows: it never "agrees" with a call nobody made.
    await expect(column(canvasElement, 'App')).toEqual([
      'Agrees',
      'Correctness · Valid',
      'Valid',
      `${NONE}no app label`,
      'Invalid',
      'Error handling · Valid',
    ]);
    await userEvent.hover(canvas.getByText('Correctness · Valid'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent('An empty export is a real case');
  },
};

/** A severity or verdict whose words aren't its slug's reads as on every screen: `unneeded` as "Not required",
 * `couldnt_run` as "Couldn't run", in the cells and the filter's options; an outcome as words, `to_owner` as "To owner". */
export const NotRequired: Story = {
  args: {
    findings: [{ ...runFull.findings[0], severity: 'unneeded', outcome: 'to_owner', verdicts: ['couldnt_run'] }],
    categoryLabels: runFull.categoryLabels,
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(column(canvasElement, 'Severity')).toEqual(['Not required']);
    await expect(column(canvasElement, 'Outcome')).toEqual(['To owner']);
    await expect(column(canvasElement, 'Fix-check verdicts')).toEqual(["Couldn't run"]);
    const severities = canvas.getByRole('combobox', { name: 'Severity' });
    await expect([...severities.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['All', 'Not required']);
  },
};

/** A category the labels don't name shows as its id. */
export const UnnamedCategory: Story = {
  args: { findings: runFull.findings.slice(0, 1), categoryLabels: {} },
  play: async ({ canvasElement }) => {
    await expect(column(canvasElement, 'Category')).toEqual(['correctness']);
  },
};

/** With `run`, the first column links each finding to its run's page by its branch, its project beside it, as the
 * Findings page lists them. */
export const WithRun: Story = {
  args: {
    findings: runFull.findings.map((f) => ({
      ...f,
      runKey: fullRun.key,
      project: fullRun.project,
      branch: fullRun.branch,
      headline: fullRun.headline,
    })),
    categoryLabels: runFull.categoryLabels,
    run: true,
  },
  play: async ({ canvas, canvasElement }) => {
    const headers = canvas.getAllByRole('columnheader').map((th) => th.textContent);
    await expect(headers.slice(0, 3)).toEqual(['Run', 'Project', '#']);
    await expect(headers).toEqual(expect.arrayContaining(['Category', 'Labelled by', 'Valid', 'App']));
    const links = canvas.getAllByRole('link', { name: 'Search every note by title and body' });
    await expect(links).toHaveLength(6);
    await expect(links[0]).toHaveAttribute('href', `/runs/${fullRun.key}`);
    await expect(column(canvasElement, 'Run')).toEqual(Array(6).fill('Search every note by title and body'));
    await expect(column(canvasElement, 'Project')).toEqual(Array(6).fill('atlas'));
    await plain(canvasElement);
  },
};

/** On the run page: its heading starts the filter row, Severity and Outcome beside it and no Step select (the graph is
 * the step filter); the container, named "Problems table", carries the problems' amber side. */
export const RunPageProblems: Story = {
  args: {
    findings: runFull.findings,
    categoryLabels: runFull.categoryLabels,
    heading: 'Problems (6)',
    label: 'Problems table',
    skip: ['step'],
    containerClassName: PROBLEMS_SIDE,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('combobox', { name: 'Step' })).toBeNull();
    // A region named by its heading, which starts the filter row.
    await expect(canvas.getByRole('region', { name: 'Problems (6)' })).toBeVisible();
    const row = canvas.getByRole('heading', { name: 'Problems (6)' }).parentElement!;
    await expect(within(row).getByRole('combobox', { name: 'Severity' })).toBeVisible();
    await expect(within(row).getByRole('combobox', { name: 'Outcome' })).toBeVisible();
    const region = canvas.getByRole('region', { name: 'Problems table' });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toHaveClass('border-l-4', 'border-l-notice-edge', 'overflow-x-auto');
    // The Step column stays: only its select goes.
    await expect(canvas.getByRole('columnheader', { name: 'Step' })).toBeVisible();
  },
};
