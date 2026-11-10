import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { emptyHome, fullHome, warnedDiagram } from '../test/home.ts';
import { WorkflowDiagram } from './WorkflowDiagram.tsx';

const meta = { component: WorkflowDiagram } satisfies Meta<typeof WorkflowDiagram>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: nothing ran in the last 7 days; the boxes stay, at zero, and no before-steps note. */
export const Empty: Story = {
  args: { diagram: emptyHome.diagram },
  play: async ({ canvas }) => {
    const panel = within(canvas.getByRole('tabpanel'));
    await expect(await panel.findAllByRole('figure')).toHaveLength(5);
    await expect(panel.getAllByText('ran 0')).toHaveLength(5);
    await expect(canvas.getByText('fix-checks: 0 ran · 0 still open · 0 reached round 3')).toBeVisible();
    await expect(canvas.queryByText(/before steps/)).toBeNull();
  },
};

/** Full: the Full path's five boxes with their counts, its fix-check line, and the runs from before steps. */
export const Full: Story = {
  args: { diagram: fullHome.diagram },
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByRole('tab', { name: 'Full path' })).toHaveAttribute('aria-selected', 'true');
    const full = within(canvas.getByRole('tabpanel'));
    const boxes = await full.findAllByRole('figure');
    await expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      'Plan simplify',
      'Plan review',
      'Task review',
      'simplify',
      'Final review',
    ]);
    await expect(within(boxes[2]).getByText('ran 11')).toBeVisible();
    await expect(within(boxes[2]).getByText('9 found · 8 acted on')).toBeVisible();
    await expect(canvas.getByText('fix-checks: 7 ran · 1 still open · 1 reached round 3')).toBeVisible();
    await expect(canvas.getByText('2 runs before steps, not counted')).toBeVisible();

    await userEvent.click(canvas.getByRole('tab', { name: 'Small path' }));
    const small = within(canvas.getByRole('tabpanel'));
    const smallBoxes = await small.findAllByRole('figure');
    await expect(smallBoxes.map((box) => box.getAttribute('aria-label'))).toEqual([
      'Task review',
      'simplify',
      'Final review',
    ]);
    await expect(within(smallBoxes[1]).getByText('4 found · 3 acted on')).toBeVisible();
    await expect(canvas.getByText('fix-checks: 2 ran · 0 still open · 0 reached round 3')).toBeVisible();
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
    const boxes = await within(canvas.getByRole('tabpanel')).findAllByRole('figure');
    const task = within(boxes[2]);
    await expect(task.getByRole('link', { name: '2 warnings on Task review' })).toHaveAttribute('href', '/compliance?step=task_review');
    await expect(task.getByText('2 warnings').closest('.border-2')).toHaveClass('border-[#ec835a]');
    await expect(within(boxes[4]).getByRole('link', { name: '1 warning on Final review' })).toHaveAttribute(
      'href',
      '/compliance?step=final_review',
    );
    await expect(within(boxes[0]).queryByRole('link')).toBeNull();
    await expect(within(boxes[0]).queryByText(/warning/)).toBeNull();
  },
};
