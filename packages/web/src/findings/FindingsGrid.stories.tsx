import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { CATEGORIES } from '@cwd/shared';
import { findingsEmpty, findingsFull } from '../test/findings.ts';
import { FindingsGrid } from './FindingsGrid.tsx';

const meta = {
  component: FindingsGrid,
  args: { response: findingsFull, measure: 'raised', area: 'implementation', selected: null, onSelect: fn() },
} satisfies Meta<typeof FindingsGrid>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The numbers in a row, by the row's header. */
function rowCells(canvasElement: HTMLElement, name: string): string[] {
  const header = within(canvasElement).getByRole('rowheader', { name });
  return within(header.closest('tr')!)
    .getAllByRole('button')
    .map((button) => button.textContent!);
}

/** Empty: no findings in the period, so every category of the area shows 0 in every week. */
export const Empty: Story = {
  args: { response: findingsEmpty },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Category',
      'Oct 18',
      'Oct 25',
      'Nov 1',
      'Nov 8',
    ]);
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(CATEGORIES.implementation.length);
    await expect(rowCells(canvasElement, 'correctness')).toEqual(['0', '0', '0', '0']);
    await expect(canvas.queryByRole('rowheader', { name: 'unlabelled' })).toBeNull();
  },
};

/**
 * Full: the area's categories by week, each cell's count written in it, each set category in the app's dashed badge,
 * then the unlabelled row. A cell is a button that selects it.
 */
export const Full: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(rowCells(canvasElement, 'tests')).toEqual(['0', '0', '1', '2']);
    await expect(rowCells(canvasElement, 'unlabelled')).toEqual(['0', '0', '1', '0']);
    await expect(canvas.getAllByRole('rowheader').at(-1)).toHaveTextContent('unlabelled');
    // It scrolls sideways over many weeks, so its container is a named tab stop.
    await expect(canvas.getByRole('region', { name: 'Findings by category and week' })).toHaveAttribute('tabindex', '0');
    await expect(within(canvas.getByRole('rowheader', { name: 'tests' })).getByText('tests')).toHaveAttribute(
      'title',
      "The app's label",
    );
    // The darkest step for the grid's largest count, a grey for 0.
    const cell = canvas.getByRole('button', { name: 'tests, week of Nov 8: 2' });
    await expect(cell).toHaveClass('bg-[#184f95]');
    await expect(canvas.getByRole('button', { name: 'tests, week of Oct 18: 0' })).toHaveClass('bg-[#f0efec]');
    await userEvent.click(cell);
    await expect(args.onSelect).toHaveBeenCalledWith({ category: 'tests', week: '2026-11-08' });
  },
};

/** The selected cell is pressed. */
export const Selected: Story = {
  args: { selected: { category: 'tests', week: '2026-11-08' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'tests, week of Nov 8: 2' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'tests, week of Nov 1: 1' })).toHaveAttribute('aria-pressed', 'false');
  },
};

/** A share measure: a whole percent of the findings raised, and a dash where none was. */
export const ShareActedOn: Story = {
  args: { measure: 'actedOn' },
  play: async ({ canvasElement }) => {
    await expect(rowCells(canvasElement, 'tests')).toEqual(['–', '–', '100%', '50%']);
  },
};

/** The area switch's other areas: the plan's own categories, with no unlabelled row when all are labelled. */
export const PlanArea: Story = {
  args: { area: 'plan' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(CATEGORIES.plan.length);
    await expect(rowCells(canvasElement, 'scope (missing or extra work)')).toEqual(['0', '0', '1', '0']);
  },
};
