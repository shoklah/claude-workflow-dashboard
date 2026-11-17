import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HTML_TEXT, runBeforeSteps, runFull } from '../test/runs.ts';
import { RunTimeline } from './RunTimeline.tsx';

const meta = { component: RunTimeline } satisfies Meta<typeof RunTimeline>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: a run with no steps is its start and its end, each with its time. */
export const Empty: Story = {
  args: { timeline: [runFull.timeline[0], runFull.timeline.at(-1)!], beforeSteps: false },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Started')).toBeVisible();
    await expect(canvas.getByText('Record written')).toBeVisible();
    await expect(canvasElement.querySelector(`time[datetime="${runFull.facts.startedAt}"]`)).not.toBeNull();
    await expect(canvasElement.querySelector(`time[datetime="${runFull.facts.finishedAt}"]`)).not.toBeNull();
    await expect(canvasElement.querySelector('details')).toBeNull();
  },
};

/** Full: a wave's tasks side by side, each step's name, round and counts as separate words, each step opening its
 * findings; a group of one step names it once. */
export const Full: Story = {
  args: { timeline: runFull.timeline, beforeSteps: false },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(canvas.getByText('Wave A')).toBeVisible();
    await expect(canvas.getByText('Wave B')).toBeVisible();
    const task1 = canvas.getByRole('group', { name: 'Task 1' }).getBoundingClientRect();
    const task2 = canvas.getByRole('group', { name: 'Task 2' }).getBoundingClientRect();
    await expect(task2.top).toBe(task1.top);
    await expect(task2.left).toBeGreaterThan(task1.right - 1);

    const finding = 'Search drops the last page on exact multiples';
    await expect(canvas.getByText(finding)).not.toBeVisible();
    const inTask1 = within(canvas.getByRole('group', { name: 'Task 1' }));
    await expect(canvasElement.textContent).not.toContain(' · ');
    const review = inTask1.getByText('Task review').closest('summary')!;
    await expect([...review.querySelectorAll('span span')].map((s) => s.textContent)).toEqual([
      'Task review',
      'Important 1',
      'Minor 1',
    ]);
    await expect(inTask1.getByText('Round 1')).toBeVisible();
    await expect(inTask1.getByText('Fixed 1')).toBeVisible();
    await userEvent.click(review);
    await expect(canvas.getByText(finding)).toBeVisible();
    await expect(inTask1.getByText("Test name doesn't say what it checks")).toBeVisible();

    // The wave check's ruled finding shows its reason.
    await userEvent.click(within(canvas.getByRole('group', { name: 'Wave check' })).getByText(/Task review/));
    await expect(canvas.getByText('One index per run is intended')).toBeVisible();

    // A finding's free text with HTML in it shows as text.
    await userEvent.click(within(canvas.getByRole('group', { name: 'Task 2' })).getByText(/Task review/));
    await expect(canvas.getByText(HTML_TEXT)).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();

    // A finding's severity and outcome in the reader's words.
    await expect(inTask1.getByText('Important')).toBeVisible();
    await expect(inTask1.getAllByText('Fixed')[0]).toBeVisible();

    // A step with no findings has nothing to open, and says so.
    const task3 = canvas.getByRole('group', { name: 'Task 3' });
    await expect(task3.querySelector('details')).toBeNull();
    await expect(within(task3).getByText('No findings')).toBeVisible();

    // The Simplify group's one step isn't named again.
    await expect(canvas.getAllByText('Simplify')).toHaveLength(1);
    await expect(canvas.getByText('Applied 1')).toBeVisible();
  },
};

/** A record from before steps were logged says so where its steps would be. */
export const BeforeSteps: Story = {
  args: { timeline: runBeforeSteps.timeline, beforeSteps: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/recorded before steps were logged/i)).toBeVisible();
    await expect(canvas.getByText('Record written')).toBeVisible();
  },
};

/** A count or a finding whose words aren't its slug's reads as on every screen: `unneeded` as "Not required". */
export const NotRequired: Story = {
  args: {
    timeline: [
      {
        kind: 'final',
        label: 'Final review',
        at: null,
        conflicts: null,
        tasks: [],
        steps: [
          {
            step: 'final_review',
            round: 0,
            agent: null,
            model: null,
            effort: null,
            kit: null,
            counts: { unneeded: 1, minor: 0 },
            findings: [{ ...runFull.findings[0], severity: 'unneeded', outcome: 'to_owner' }],
          },
        ],
      },
    ],
    beforeSteps: false,
  },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText('Not required 1')).toBeVisible();
    await expect(canvas.queryByText(/Minor/)).toBeNull();
    await userEvent.click(canvas.getByText('Not required 1'));
    await expect(canvas.getByText('Not required')).toBeVisible();
    await expect(canvas.getByText('To owner')).toBeVisible();
  },
};
