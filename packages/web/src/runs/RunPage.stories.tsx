import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn, within } from 'storybook/test';
import { parseTime, type StatusResponse } from '@cwd/shared';
import { formatDayTime, LATER_FIXES_TERM, WARNING_INK } from '../lib/format.ts';
import { mockApi } from '../test/mock-api.ts';
import { cells, expectNoJoined } from '../test/table.ts';
import { fullRun, oldRun, planRun, runAlone, runBeforeSteps, runFull, runHandedOff, runSmall, runStopped, smallRun } from '../test/runs.ts';
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
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: 500 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText("Couldn't load this run.");
    await expect(state).toBeVisible();
    await expect(state.closest('.glass')).not.toBeNull();
  },
};

/** A key no stored run has (or one showing mode hides) gets its own message, with the way back to Runs. */
export const Unknown: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: 404 });
  },
  play: async ({ canvas }) => {
    const state = await canvas.findByText('No run with this key.', { exact: false });
    await expect(state.closest('.glass')).not.toBeNull();
    await expect(within(state).getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/runs');
    await expect(canvas.queryByText("Couldn't load this run.")).toBeNull();
  },
};

/** Opens the "Cost, context and skills" disclosure, closed until then. */
async function openFold(canvasElement: HTMLElement, click: (element: Element) => Promise<void>): Promise<void> {
  const fold = canvasElement.querySelector('details')!;
  await expect(fold.querySelector('summary')).toHaveTextContent('Cost, context and skills');
  await expect(fold).not.toHaveAttribute('open');
  await click(fold.querySelector('summary')!);
  await expect(fold).toHaveAttribute('open');
}

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
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findByText('0 min')).toHaveClass('text-muted-foreground');
    await expect(canvas.getByText('$0.00')).toHaveClass('text-muted-foreground');
    await openFold(canvasElement, (summary) => userEvent.click(summary));
    await expect(within(canvas.getByRole('region', { name: 'Context' })).getByText('0')).toHaveClass('text-muted-foreground');
  },
};

/** Empty: a record from before steps, with no phases, models, advisor notes, context, skills or warnings: each fold
 * panel says so, and there is no Warnings panel. */
export const Empty: Story = {
  args: { runKey: oldRun.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${oldRun.key}`]: runBeforeSteps });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // Without a headline the branch stays the title, and no change, goal or session is known.
    await expect(await canvas.findByRole('heading', { name: 'feat/import', level: 1 })).toBeVisible();
    const terms = pairs(canvasElement.querySelector('dl')!).map(([term]) => term);
    await expect(terms[0]).toBe('Project');
    for (const term of ['Branch', 'Change', 'Goal', 'Session']) await expect(terms).not.toContain(term);
    const flow = canvas.getByRole('region', { name: 'Flow' });
    await expect(within(flow).getByText('Recorded before steps were logged: there is no flow to draw.')).toBeVisible();
    await expect(canvas.queryByRole('group', { name: "The run's flow" })).toBeNull();
    await expect(canvas.queryByText(HINT)).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Warnings' })).toBeNull();
    await openFold(canvasElement, (summary) => userEvent.click(summary));
    const none: [string, string[]][] = [
      ['Est. cost by phase', ['No cost by phase recorded.']],
      ['Models and advisor', ['No model recorded.', 'Advisor not consulted.']],
      ['Context', ['No context facts for this run.']],
      ['Skills', ['No skill loaded or offered.']],
    ];
    for (const [name, texts] of none) {
      for (const text of texts) await expect(within(canvas.getByRole('region', { name })).getByText(text)).toBeVisible();
    }
  },
};

/** The rows of the plain table named `name` inside `region`, each its row header's text, then its cells'. */
function tableRows(region: HTMLElement, name: string): (string | null)[][] {
  return within(within(region).getByRole('table', { name }))
    .getAllByRole('row')
    .slice(1)
    .map((row) => [within(row).queryByRole('rowheader')?.textContent ?? null, ...cells(row)]);
}

/** Full: the branch as title, the header's facts as terms, the run's flow, no side panel, its warnings in a panel, and
 * its cost, models, context and skills in four panels inside the closed fold. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(await canvas.findByRole('heading', { name: fullRun.headline!, level: 1 })).toBeVisible();
    // With a headline as its title, the branch moves into the facts, beside its change, goal and session.
    await expect(pairs(canvasElement.querySelector('dl')!)).toEqual([
      ['Project', 'atlas'],
      ['Branch', 'feat/search'],
      ['Change', 'Plan full-text search'],
      ['Goal', 'Findability'],
      ['Session', 'Search page build'],
      ['Path', 'Full'],
      ['Stage', '1'],
      ['Time', '2 h 10'],
      ['Est. cost', '$7.10'],
      ['Tasks', '4'],
      ['Findings', '6'],
      ['Closed', '5'],
      ['Stops', '0'],
      ['Warnings', '1'],
    ]);
    const header = within(canvasElement.querySelector('dl')!);
    await expect(header.getByRole('link', { name: 'Plan full-text search' })).toHaveAttribute('href', `/work/changes/${fullRun.change!.key}`);
    await expect(header.getByRole('link', { name: 'Findability' })).toHaveAttribute('href', `/work/goals/${fullRun.goal!.key}`);
    await expect(header.getByRole('link', { name: 'Search page build' })).toHaveAttribute(
      'href',
      `/work?view=sessions&session=${runFull.session!.key}`,
    );
    const flow = canvas.getByRole('region', { name: 'Flow' });
    await expect(within(flow).getByRole('group', { name: "The run's flow" })).toBeVisible();

    // No side panel: the old Models and Advisor regions are gone, and the fold is closed.
    await expect(canvas.queryByRole('region', { name: 'Models' })).toBeNull();
    await expect(canvas.queryByRole('region', { name: 'Advisor' })).toBeNull();
    await openFold(canvasElement, (summary) => userEvent.click(summary));

    await expect(pairs(canvas.getByRole('region', { name: 'Est. cost by phase' }))).toEqual([
      ['Plan writing', '$1.10'],
      ['Implement', '$3.40'],
      ['Task review', '$1.60'],
      ['Final review', '$1.00'],
    ]);
    const models = canvas.getByRole('region', { name: 'Models and advisor' });
    const [main, costs, advice] = [...models.querySelectorAll('dl')];
    await expect(pairs(main)).toEqual([
      ['Main session model', 'Opus 5.5'],
      ['Main session effort', 'medium'],
    ]);
    // A model shows by its name, never its id, its name in primary ink and its cost muted.
    await expect(pairs(costs)).toEqual([
      ['Opus 5.5', '$5.20'],
      ['Fable 5.1', '$1.90'],
    ]);
    for (const dt of costs.querySelectorAll('dt')) {
      await expect(dt).not.toHaveClass('text-muted-foreground');
      await expect(dt.nextElementSibling).toHaveClass('text-muted-foreground');
    }
    const agents = within(models).getByRole('table', { name: 'Agents' });
    await expect([...agents.querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Agent', 'Model', 'Effort', 'Dispatches']);
    await expect(tableRows(models, 'Agents')).toEqual([
      ['final-reviewer', 'Opus 5.5', 'high', '1'],
      ['implementer', 'Opus 5.5', 'medium', '4'],
      ['task-reviewer', 'Opus 5.5', 'high', '5'],
    ]);
    await expectNoJoined(agents);
    await expect(pairs(advice)).toEqual([
      ['Advisor calls', '3'],
      ['Advisor notes', '3'],
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
    await expect(tableRows(canvas.getByRole('region', { name: 'Skills' }), 'Skills')).toEqual([
      ['subagent-driven-development', 'Loaded', 'Ran'],
      ['simplify', 'Loaded', 'Found something'],
      ['graphify', 'Offered', 'Accepted'],
      ['session-summary', 'Offered', 'Skipped'],
    ]);
    await expectNoJoined(within(canvas.getByRole('region', { name: 'Skills' })).getByRole('table', { name: 'Skills' }));
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
    // Problems is a region named by its title, its filters inside it.
    const problems = canvas.getByRole('region', { name: 'Problems (6)' });
    await expect(within(problems).getByRole('combobox', { name: 'Severity' })).toBeVisible();
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

/** An offer with no outcome shows the muted dash, read out as "not known", never a blank cell. */
export const OfferWithoutOutcome: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      [`/api/runs/${fullRun.key}`]: { ...runFull, offers: [{ skill: 'graphify', outcome: '' }] },
    });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole('heading', { name: fullRun.headline!, level: 1 });
    await openFold(canvasElement, (element) => userEvent.click(element));
    const skills = canvas.getByRole('region', { name: 'Skills' });
    await expect(tableRows(skills, 'Skills').at(-1)).toEqual(['graphify', 'Offered', '–not known']);
  },
};

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

/** A filter belongs to its run too: the other run shows its every problem, and its select reads All. */
export const OtherRunFilters: Story = {
  render: () => <Switching />,
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull, [`/api/runs/${otherKey}`]: runFull });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole('region', { name: 'Flow' });
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Severity' }), 'minor');
    await expect(ids(canvasElement, 'Problems table')).not.toHaveLength(runFull.findings.length);
    await userEvent.click(canvas.getByRole('button', { name: 'Other run' }));
    await expect(fetch).toHaveBeenCalledWith(`/api/runs/${otherKey}`);
    await expect(ids(canvasElement, 'Problems table')).toEqual(runFull.findings.map((f) => f.id));
    await expect(canvas.getByRole('combobox', { name: 'Severity' })).toHaveValue('');
  },
};

/** The data rows of the table region named `name`, by their first cell. */
function ids(canvasElement: HTMLElement, name: string): (string | null)[] {
  const region = within(canvasElement).getByRole('region', { name });
  return [...region.querySelectorAll('tbody tr')].map((tr) => cells(tr as HTMLElement)[0]);
}

/** A selected step filters Problems and Strengths, and their titles name it; closing restores the whole run. */
export const SelectedStepTables: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const flow = within(await canvas.findByRole('region', { name: 'Flow' }));
    await userEvent.click(flow.getByRole('button', { name: /^Task 1(?!\d)/ }));
    await expect(canvas.getByRole('region', { name: 'Problems in Task 1 (2)' })).toBeVisible();
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

/** A filter set on one step resets when the step changes: the new step's every problem shows. */
export const FiltersResetWithStep: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const flow = within(await canvas.findByRole('region', { name: 'Flow' }));
    await userEvent.click(flow.getByRole('button', { name: /^Task 1(?!\d)/ }));
    await userEvent.selectOptions(canvas.getByRole('combobox', { name: 'Severity' }), 'minor');
    await expect(ids(canvasElement, 'Problems table')).toEqual(['F2']);
    await userEvent.click(flow.getByRole('button', { name: /^Task 2(?!\d)/ }));
    await expect(ids(canvasElement, 'Problems table')).toEqual(['F3']);
    await expect(canvas.getByRole('combobox', { name: 'Severity' })).toHaveValue('');
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
    // No warnings, so no Warnings panel.
    await expect(canvas.queryByRole('region', { name: 'Warnings' })).toBeNull();
  },
};

/** A run recorded before steps has no findings or strengths to list, and says why. */
export const EmptyTables: Story = {
  args: { runKey: oldRun.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${oldRun.key}`]: runBeforeSteps });
  },
  play: async ({ canvas }) => {
    const problems = await canvas.findByRole('region', { name: 'Problems' });
    await expect(within(problems).getByText('Recorded before findings were logged: this run has none to list.')).toBeVisible();
    await expect(canvas.getByText('Recorded before strengths were logged: this run has none to list.')).toBeVisible();
    // Not known is not zero: the titles carry no count, as the header's Findings shows the dash.
    await expect(problems).toBeVisible();
    await expect(canvas.getByRole('region', { name: 'Strengths' })).toBeVisible();
    // Left for later has none to list either, rather than every finding closed.
    const left = canvas.getByRole('region', { name: 'Left for later' });
    await expect(within(left).getByText('Recorded before findings were logged: this run has none to list.')).toBeVisible();
  },
};

/** The boxes of the header's chain, each one's text. */
function chain(canvasElement: HTMLElement) {
  return within(within(canvasElement).getByRole('list', { name: 'Before and after this run' }));
}

/** The header's chain, in time order: the branch's plan run as a link with its time, this run with its session, the
 * handoff with its time, and the later fix, a term. */
export const Chain: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await canvas.findByRole('heading', { name: fullRun.headline!, level: 1 });
    const boxes = chain(canvasElement).getAllByRole('listitem');
    await expect(boxes.map((box) => box.textContent)).toEqual([
      `Plan run${formatDayTime(parseTime(planRun.finishedAt!))}`,
      'This run, fullin session Search page build 0f1e2d3c',
      `Handed off to a new session${formatDayTime(parseTime('2026-11-10T16:40:00.000Z'))}`,
      '1 later fix',
    ]);
    await expect(within(boxes[0]).getByRole('link', { name: 'Plan run' })).toHaveAttribute('href', `/runs/${planRun.key}`);
    await expect(boxes[1].querySelector('[aria-current="page"]')).toHaveTextContent(/^This run, full/);
    await expect(within(boxes[1]).getByRole('button', { name: 'Copy session ID' })).toBeVisible();
    await userEvent.hover(within(boxes[3]).getByText('1 later fix'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(LATER_FIXES_TERM);
  },
};

/** A handoff to a stored session names it. */
export const HandedOffTo: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runHandedOff });
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: fullRun.headline!, level: 1 });
    await expect(chain(canvasElement).getAllByRole('listitem')[2]).toHaveTextContent(/^Handed off to Search page polish/);
    await expect(chain(canvasElement).getByText('Search page polish')).not.toHaveClass('text-muted-foreground');
  },
};

/** A session with no title reads "no title", muted, in this run's box and the handoff's alike. */
export const UntitledSessions: Story = {
  beforeEach: () => {
    mockApi({
      '/api/status': status,
      [`/api/runs/${fullRun.key}`]: {
        ...runHandedOff,
        session: { ...runHandedOff.session!, title: null },
        handoffTo: { ...runHandedOff.handoffTo!, title: null },
      },
    });
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: fullRun.headline!, level: 1 });
    const boxes = chain(canvasElement).getAllByRole('listitem');
    await expect(boxes[1]).toHaveTextContent('This run, fullin session no title 0f1e2d3c');
    await expect(boxes[2]).toHaveTextContent(/^Handed off to no title/);
    await expect(chain(canvasElement).queryByText(/null/)).toBeNull();
    // This run's session line is muted whole; the handoff's bold name gives way to the muted "no title".
    await expect(within(boxes[2]).getByText('no title')).toHaveClass('font-normal', 'text-muted-foreground');
  },
};

/** A run with a stop shows its count in the warning ink. */
export const Stopped: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runStopped });
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: fullRun.headline!, level: 1 });
    const stops = [...canvasElement.querySelector('dl')!.querySelectorAll('dt')].find((dt) => dt.textContent === 'Stops')!;
    await expect(stops.nextElementSibling).toHaveTextContent('1');
    await expect(stops.nextElementSibling!.querySelector(`.${WARNING_INK}`)).not.toBeNull();
  },
};

/** A run with nothing around it: dashes for its time and cost, pills with no time, and a chain of this run alone. */
export const Alone: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runAlone });
  },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: fullRun.headline!, level: 1 });
    const facts = Object.fromEntries(pairs(canvasElement.querySelector('dl')!));
    await expect(facts['Time']).toBe('–not known');
    await expect(facts['Est. cost']).toBe('–not known');
    // Its session isn't known, so the header names none.
    await expect(facts['Change']).toBe('Plan full-text search');
    await expect(facts).not.toHaveProperty('Session');
    const flow = within(canvas.getByRole('group', { name: "The run's flow" }));
    await expect(flow.getByText('Started').parentElement).toHaveTextContent(/^Started$/);
    await expect(flow.getByText('Record written').parentElement).toHaveTextContent(/^Record written$/);
    await expect(chain(canvasElement).getAllByRole('listitem').map((box) => box.textContent)).toEqual(['This run, full']);
  },
};

/** Left for later sits under Strengths and narrows with the selected step. */
export const LeftForLaterFollows: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, userEvent }) => {
    const left = await canvas.findByRole('region', { name: 'Left for later' });
    const strengths = canvas.getByRole('region', { name: 'Strengths (2)' });
    await expect(strengths.compareDocumentPosition(left) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect(within(left).getAllByRole('row').slice(1).map((row) => cells(row))).toEqual([
      ['Deferred', "Test name doesn't say what it checks", 'Task 1'],
      ['Open', 'Error text not localized', 'Final review'],
    ]);
    await userEvent.click(within(canvas.getByRole('region', { name: 'Flow' })).getByRole('button', { name: /^Task 1(?!\d)/ }));
    const step = canvas.getByRole('region', { name: 'Left for later in Task 1' });
    await expect(within(step).getAllByRole('row').slice(1).map((row) => cells(row))).toEqual([
      ['Deferred', "Test name doesn't say what it checks", 'Task 1'],
    ]);
    await expect(within(step).queryByText('Later fixes')).toBeNull();
  },
};
