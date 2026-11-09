import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HTML_TEXT, runBeforeSteps, runFull } from '../test/run-fixtures.ts';
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

/** Full: a wave's tasks side by side, each step opening its findings. */
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
    await userEvent.click(inTask1.getByText('Task review · 1 important · 1 minor'));
    await expect(canvas.getByText(finding)).toBeVisible();
    await expect(inTask1.getByText("Test name doesn't say what it checks")).toBeVisible();

    // The wave check's ruled finding shows its reason.
    await userEvent.click(within(canvas.getByRole('group', { name: 'Wave check' })).getByText(/Task review/));
    await expect(canvas.getByText('One index per run is intended')).toBeVisible();

    // A finding's free text with HTML in it shows as text.
    await userEvent.click(within(canvas.getByRole('group', { name: 'Task 2' })).getByText(/Task review/));
    await expect(canvas.getByText(HTML_TEXT)).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();

    // A step with no findings has nothing to open.
    await expect(canvas.getByRole('group', { name: 'Task 3' }).querySelector('details')).toBeNull();
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
