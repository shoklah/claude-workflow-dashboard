import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { emptyHome, fullHome, warnedDiagram } from '../test/home.ts';
import { WorkflowDiagram } from './WorkflowDiagram.tsx';

const meta = { component: WorkflowDiagram } satisfies Meta<typeof WorkflowDiagram>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A box's or line's facts as [term, value] pairs. */
const facts = (element: HTMLElement) =>
  within(element)
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent]);

/** Empty: nothing ran in the last 7 days; the boxes stay, at zero, and no before-steps note. */
export const Empty: Story = {
  args: { diagram: emptyHome.diagram },
  play: async ({ canvas }) => {
    const panel = within(canvas.getByRole('region', { name: 'Workflow, last 7 days' }));
    const boxes = await panel.findAllByRole('figure');
    await expect(boxes).toHaveLength(5);
    for (const box of boxes) {
      await expect(facts(box)).toEqual([
        ['Ran', '0'],
        ['Found', '0'],
        ['Acted on', '0'],
      ]);
    }
    await expect(facts(canvas.getByRole('group', { name: 'Fix-checks' }))).toEqual([
      ['Ran', '0'],
      ['Still open', '0'],
      ['Reached round 3', '0'],
    ]);
    await expect(canvas.queryByText(/before steps/)).toBeNull();
  },
};

/** Full: the Full path's five boxes with their counts, its fix-check facts, and the runs from before steps. */
export const Full: Story = {
  args: { diagram: fullHome.diagram },
  play: async ({ canvas, canvasElement, userEvent }) => {
    // A switch of pressed-state buttons, no tabs.
    await expect(canvasElement.querySelector('[role="tab"]')).toBeNull();
    const path = within(canvas.getByRole('group', { name: 'Path' }));
    await expect(path.getByRole('button', { name: 'Full path' })).toHaveAttribute('aria-pressed', 'true');
    await expect(path.getByRole('button', { name: 'Small path' })).toHaveAttribute('aria-pressed', 'false');
    const boxes = await canvas.findAllByRole('figure');
    await expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      'Plan simplify',
      'Plan review',
      'Task review',
      'Simplify',
      'Final review',
    ]);
    await expect(facts(boxes[2])).toEqual([
      ['Ran', '11'],
      ['Found', '9'],
      ['Acted on', '8'],
    ]);
    await expect(facts(canvas.getByRole('group', { name: 'Fix-checks' }))).toEqual([
      ['Ran', '7'],
      ['Still open', '1'],
      ['Reached round 3', '1'],
    ]);
    await expect(canvas.getByText('2 runs before steps, not counted')).toBeVisible();
    await expect(canvasElement.textContent).not.toContain(' · ');

    await userEvent.click(path.getByRole('button', { name: 'Small path' }));
    await expect(path.getByRole('button', { name: 'Small path' })).toHaveAttribute('aria-pressed', 'true');
    await expect(path.getByRole('button', { name: 'Full path' })).toHaveAttribute('aria-pressed', 'false');
    const smallBoxes = await canvas.findAllByRole('figure');
    await expect(smallBoxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      'Task review',
      'Simplify',
      'Final review',
    ]);
    await expect(facts(smallBoxes[1])).toEqual([
      ['Ran', '3'],
      ['Found', '4'],
      ['Acted on', '3'],
    ]);
    await expect(facts(canvas.getByRole('group', { name: 'Fix-checks' }))).toEqual([
      ['Ran', '2'],
      ['Still open', '0'],
      ['Reached round 3', '0'],
    ]);
  },
};

/** One run before steps reads in the singular. */
export const OneRunBeforeSteps: Story = {
  args: { diagram: { ...fullHome.diagram, beforeSteps: 1 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('1 run before steps, not counted')).toBeVisible();
  },
};

/**
 * Boxes whose step a current warning names: an orange border, the count written in it, and a link to Compliance
 * filtered to that step; the others stay plain.
 */
export const WithWarnings: Story = {
  args: { diagram: warnedDiagram },
  play: async ({ canvas }) => {
    const boxes = await canvas.findAllByRole('figure');
    const task = within(boxes[2]);
    await expect(task.getByRole('link', { name: '2 warnings on Task review' })).toHaveAttribute('href', '/compliance?step=task_review');
    await expect(task.getByText('2 warnings').closest('.border-2')).toHaveClass('border-warning-edge');
    await expect(within(boxes[4]).getByRole('link', { name: '1 warning on Final review' })).toHaveAttribute(
      'href',
      '/compliance?step=final_review',
    );
    await expect(within(boxes[0]).queryByRole('link')).toBeNull();
    await expect(within(boxes[0]).queryByText(/warning/)).toBeNull();
  },
};
