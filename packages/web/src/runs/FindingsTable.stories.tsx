import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { NONE, PROBLEMS_SIDE } from '../lib/format.ts';
import { HTML_TEXT, fullRun, runFull, workflowFindings } from '../test/runs.ts';
import { visibleFact, visibleTerms, visibleValues, width, openedRow } from '../test/table.ts';
import { FindingsTable } from './FindingsTable.tsx';

const meta = { component: FindingsTable, decorators: [width(1000)] } satisfies Meta<typeof FindingsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No cell joins values with " · " outside the App column. */
async function plain(canvasElement: HTMLElement): Promise<void> {
  const app = [...canvasElement.querySelectorAll('th')].findIndex((th) => th.textContent === 'App');
  for (const tr of canvasElement.querySelectorAll('tbody tr')) {
    for (const [i, td] of [...tr.children].entries()) if (i !== app) await expect(td.textContent).not.toContain(' · ');
  }
}

/** The body rows, opened rows left out. */
const closedRows = (canvasElement: HTMLElement) =>
  [...canvasElement.querySelectorAll<HTMLElement>('tbody tr')].filter((tr) => !tr.querySelector('dl'));

/** The text of each body row's cell under the header `name`. */
function column(canvasElement: HTMLElement, name: string): (string | null)[] {
  const index = [...canvasElement.querySelectorAll('th')].findIndex((th) => th.textContent === name);
  return closedRows(canvasElement).map((tr) => tr.children[index].textContent);
}

/** Opens every closed row, then gives each row's visible value for the fact `term`, null where it is left out. */
async function fact(
  canvasElement: HTMLElement,
  userEvent: { click: (el: Element) => Promise<void> },
  term: string,
): Promise<(string | null)[]> {
  for (const toggle of canvasElement.querySelectorAll('tbody button[aria-expanded="false"]')) await userEvent.click(toggle);
  return [...canvasElement.querySelectorAll<HTMLElement>('tbody tr')]
    .filter((tr) => tr.querySelector('dl'))
    .map((tr) => (visibleTerms(tr).includes(term) ? visibleFact(tr, term).textContent : null));
}

/** A finding with no id keeps its open state when a filter changes the rows above it. */
export const NoIdKeepsOpen: Story = {
  args: {
    findings: [
      { ...runFull.findings[0], id: null, summary: 'First' },
      { ...runFull.findings[3], id: null, step: 'final_review', summary: 'Second' },
    ],
    categoryLabels: runFull.categoryLabels,
  },
  play: async ({ canvas, userEvent }) => {
    const [first] = canvas.getAllByRole('button', { name: NONE });
    await userEvent.click(first);
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Step' }), 'final_review');
    await expect(canvas.getByText('Second')).toBeVisible();
    await expect(canvas.getByRole('button', { name: NONE })).toHaveAttribute('aria-expanded', 'false');
  },
};

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
 * Full: every finding of the run, one row each: its id, summary, the app's call and the validity at first glance, its
 * free text shown as text. A row opens to its other facts, an empty one left out: the app's labels (each category as
 * plain text, named by the response's `categoryLabels`, "App" under Labelled by), its outcome, reason and one line per
 * fix round. The relevance call carries its reason in a tooltip; Valid is "–" on a run the workflow didn't label.
 */
export const Full: Story = {
  args: { findings: runFull.findings, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const headers = canvas.getAllByRole('columnheader');
    await expect(headers.map((th) => th.textContent)).toEqual(['#', 'Summary', 'App', 'Valid']);
    for (const th of headers) await expect(th).toBeVisible();
    await expect(canvas.getAllByRole('row')).toHaveLength(7);
    await plain(canvasElement);
    await expect(canvas.getByRole('region', { name: 'Findings' })).toHaveAttribute('tabindex', '0');
    await expect(canvas.getAllByText(HTML_TEXT)).toHaveLength(1);
    await expect(canvas.getByText(HTML_TEXT)).toBeVisible();
    await expect(column(canvasElement, 'Valid')).toEqual(Array(6).fill(`${NONE}not known`));
    await expect(column(canvasElement, 'App')).toEqual(['Valid', 'Unclear', 'Valid', 'Invalid', 'Valid', `${NONE}no app label`]);
    await userEvent.hover(canvas.getByText('Invalid'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(
      'The run means both tasks to share the index',
    );
    await expect(canvasElement.querySelector('img')).toBeNull();

    // F1 opens to its other facts; it has no reason, so none shows.
    const f1 = canvas.getByRole('button', { name: 'F1' });
    await userEvent.click(f1);
    await expect(f1).toHaveAttribute('aria-expanded', 'true');
    await expect(visibleTerms(openedRow(f1))).toEqual([
      'Step',
      'Task',
      'Severity',
      'Category',
      'Labelled by',
      'Outcome',
      'Fix round 1',
    ]);
    await expect(visibleValues(openedRow(f1))).toEqual(['Task review', '1', 'Important', 'Correctness', 'App', 'Fixed', 'Fixed']);
    // F4's reason, and one line per fix round.
    const f4 = canvas.getByRole('button', { name: 'F4' });
    await userEvent.click(f4);
    await expect(visibleTerms(openedRow(f4)).slice(-4)).toEqual(['Reason', 'Fix round 1', 'Fix round 2', 'Fix round 3']);
    await expect(visibleValues(openedRow(f4)).slice(-4)).toEqual([
      'One index per run is intended',
      'Still open',
      'Still open',
      'Still open',
    ]);
    // Every verdict but a fix is in the warning ink.
    await expect(visibleFact(openedRow(f4), 'Fix round 1').firstElementChild).toHaveClass('text-warning-ink');
    await expect(visibleFact(openedRow(f1), 'Fix round 1').firstElementChild).not.toHaveClass('text-warning-ink');

    await expect(await fact(canvasElement, userEvent, 'Category')).toEqual([
      'Correctness',
      'Naming and clarity',
      'Security and privacy',
      'Data safety',
      'Simplicity',
      'unlabelled',
    ]);
    await expect(await fact(canvasElement, userEvent, 'Labelled by')).toEqual([...Array(5).fill('App'), null]);
    await expect(await fact(canvasElement, userEvent, 'Severity')).toEqual(['Important', 'Minor', 'Critical', 'Important', null, 'Minor']);
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
    const toggle = within(rows[0]).getByRole('button', { name: 'F4' });
    await userEvent.click(toggle);
    await expect(visibleValues(openedRow(toggle))).toEqual(expect.arrayContaining(['One index per run is intended']));
    await expect(visibleValues(openedRow(toggle)).filter((v) => v === 'Still open')).toHaveLength(3);
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

/** No finding labelled yet: every category is "unlabelled", Labelled by left out and the App column "–". */
export const Unlabelled: Story = {
  args: {
    findings: runFull.findings.map((f) => ({ ...f, category: null, relevance: null, labelReason: null })),
    categoryLabels: runFull.categoryLabels,
  },
  play: async ({ canvasElement, userEvent }) => {
    await expect(column(canvasElement, 'App')).toEqual(Array(6).fill(`${NONE}no app label`));
    await expect(await fact(canvasElement, userEvent, 'Category')).toEqual(Array(6).fill('unlabelled'));
    await expect(await fact(canvasElement, userEvent, 'Labelled by')).toEqual(Array(6).fill(null));
  },
};

/**
 * After CR10: each category as plain text, Labelled by naming whose label it is; Valid is the workflow's call; App says "agrees" when the workflow made both calls and the app's match, else the app's category where it
 * differs and its call where it differs or the workflow made none.
 */
export const WorkflowLabels: Story = {
  args: { findings: workflowFindings, categoryLabels: runFull.categoryLabels },
  play: async ({ canvas, canvasElement, userEvent }) => {
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
    await expect(await fact(canvasElement, userEvent, 'Category')).toEqual([
      'Reuse and duplication',
      'Tests',
      'Conventions',
      'Simplicity',
      'Correctness',
      'Correctness',
    ]);
    await expect(await fact(canvasElement, userEvent, 'Labelled by')).toEqual(['Workflow', 'Workflow', 'App', 'Workflow', 'Workflow', 'Workflow']);
  },
};

/** A severity or verdict whose words aren't its slug's reads as on every screen: `unneeded` as "Not required",
 * `couldnt_run` as "Couldn't run", in the cells and the filter's options; an outcome as words, `to_owner` as "To owner". */
export const NotRequired: Story = {
  args: {
    findings: [{ ...runFull.findings[0], severity: 'unneeded', outcome: 'to_owner', verdicts: ['couldnt_run'] }],
    categoryLabels: runFull.categoryLabels,
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await fact(canvasElement, userEvent, 'Severity')).toEqual(['Not required']);
    await expect(await fact(canvasElement, userEvent, 'Outcome')).toEqual(['To owner']);
    await expect(await fact(canvasElement, userEvent, 'Fix round 1')).toEqual(["Couldn't run"]);
    const severities = canvas.getByRole('combobox', { name: 'Severity' });
    await expect([...severities.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['All', 'Not required']);
  },
};

/** A category the labels don't name shows as its id. */
export const UnnamedCategory: Story = {
  args: { findings: runFull.findings.slice(0, 1), categoryLabels: {} },
  play: async ({ canvasElement, userEvent }) => {
    await expect(await fact(canvasElement, userEvent, 'Category')).toEqual(['correctness']);
  },
};

/** With `run`, the first column links each finding to its run's page by its title, as the Findings page lists them;
 * its project ends the opened row. */
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
  play: async ({ canvas, canvasElement, userEvent }) => {
    const headers = canvas.getAllByRole('columnheader');
    await expect(headers.map((th) => th.textContent)).toEqual(['Run', '#', 'Summary', 'App', 'Valid']);
    for (const th of headers) await expect(th).toBeVisible();
    const links = canvas.getAllByRole('link', { name: fullRun.headline! });
    await expect(links).toHaveLength(6);
    await expect(links[0]).toHaveAttribute('href', `/runs/${fullRun.key}`);
    await expect(column(canvasElement, 'Run')).toEqual(Array(6).fill(fullRun.headline));
    await plain(canvasElement);
    const f1 = canvas.getByRole('button', { name: 'F1' });
    await userEvent.click(f1);
    await expect(visibleTerms(openedRow(f1)).at(-1)).toBe('Project');
    await expect(visibleValues(openedRow(f1)).at(-1)).toBe('atlas');
  },
};

/** Narrow: under 768 px the Run column folds into the top of the opened row, its link still there. */
export const NarrowWithRun: Story = {
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
  decorators: [width(375)],
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('columnheader', { name: '#' })).toBeVisible();
    await expect(canvas.getByText('Run').closest('th')).not.toBeVisible();
    const f1 = canvas.getByRole('button', { name: 'F1' });
    await userEvent.click(f1);
    const opened = openedRow(f1);
    await expect(visibleTerms(opened)[0]).toBe('Run');
    await expect(visibleTerms(opened).at(-1)).toBe('Project');
    await expect(within(opened).getByRole('link', { name: fullRun.headline! })).toHaveAttribute('href', `/runs/${fullRun.key}`);
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
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.queryByRole('combobox', { name: 'Step' })).toBeNull();
    // A region named by its heading, which starts the filter row.
    await expect(canvas.getByRole('region', { name: 'Problems (6)' })).toBeVisible();
    const row = canvas.getByRole('heading', { name: 'Problems (6)' }).parentElement!;
    await expect(within(row).getByRole('combobox', { name: 'Severity' })).toBeVisible();
    await expect(within(row).getByRole('combobox', { name: 'Outcome' })).toBeVisible();
    const region = canvas.getByRole('region', { name: 'Problems table' });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toHaveClass('border-l-4', 'border-l-notice-edge', 'overflow-x-auto');
    // The Step fact stays: only its select goes.
    const f1 = canvas.getByRole('button', { name: 'F1' });
    await userEvent.click(f1);
    await expect(visibleTerms(openedRow(f1))[0]).toBe('Step');
  },
};
