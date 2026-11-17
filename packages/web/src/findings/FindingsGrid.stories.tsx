import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { CATEGORY_IDS, findingsEmpty, findingsFull, findingsWorkflow } from '../test/findings.ts';
import { FindingsGrid } from './FindingsGrid.tsx';
import { expectNoJoined } from '../test/table.ts';

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

/** The cells after the weeks in a row (its total, then the extras), by the row's header. */
function rowExtras(canvasElement: HTMLElement, name: string): string[] {
  const header = within(canvasElement).getByRole('rowheader', { name });
  return within(header.closest('tr')!)
    .getAllByRole('cell')
    .filter((cell) => !cell.querySelector('button'))
    .map((cell) => cell.textContent!);
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
      'Total',
    ]);
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(CATEGORY_IDS.implementation.length);
    await expect(rowCells(canvasElement, 'Correctness')).toEqual(['0', '0', '0', '0']);
    await expect(canvas.queryByRole('rowheader', { name: 'unlabelled' })).toBeNull();
  },
};

/**
 * Full: the area's categories by week, each cell's count written in it, each category as plain text, then the
 * unlabelled row. A cell is a button that selects it.
 */
export const Full: Story = {
  play: async ({ args, canvas, canvasElement, userEvent }) => {
    await expect(rowCells(canvasElement, 'Tests')).toEqual(['0', '0', '1', '2']);
    await expect(rowCells(canvasElement, 'unlabelled')).toEqual(['0', '0', '1', '0']);
    // Under a count, each row ends with its total; no "Labelled by the app" column before the workflow labels.
    await expect(canvas.getAllByRole('columnheader').at(-1)).toHaveTextContent('Total');
    await expect(rowExtras(canvasElement, 'Tests')).toEqual(['3']);
    await expect(canvas.queryByRole('columnheader', { name: 'Labelled by the app' })).toBeNull();
    await expectNoJoined(canvasElement);
    await expect(canvas.getAllByRole('rowheader').at(-1)).toHaveTextContent('unlabelled');
    // It scrolls sideways over many weeks, so its container is a named tab stop.
    await expect(canvas.getByRole('region', { name: 'Findings by category and week' })).toHaveAttribute('tabindex', '0');
    // The darkest step for the grid's largest count, a grey for 0.
    const cell = canvas.getByRole('button', { name: 'Tests, week of Nov 8: 2' });
    await expect(cell).toHaveClass('bg-shade-5');
    await expect(canvas.getByRole('button', { name: 'Tests, week of Oct 18: 0' })).toHaveClass('bg-shade-zero');
    await userEvent.click(cell);
    await expect(args.onSelect).toHaveBeenCalledWith({ category: 'tests', week: '2026-11-08' });
  },
};

/** The selected cell is pressed. */
export const Selected: Story = {
  args: { selected: { category: 'tests', week: '2026-11-08' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Tests, week of Nov 8: 2' })).toHaveAttribute('aria-pressed', 'true');
    await expect(canvas.getByRole('button', { name: 'Tests, week of Nov 1: 1' })).toHaveAttribute('aria-pressed', 'false');
  },
};

/** A share measure: a whole percent of the findings raised, and a dash where none was. */
export const ShareActedOn: Story = {
  args: { measure: 'actedOn' },
  play: async ({ canvas, canvasElement }) => {
    await expect(rowCells(canvasElement, 'Tests')).toEqual(['–', '–', '100%', '50%']);
    // A share has no total.
    await expect(canvas.queryByRole('columnheader', { name: 'Total' })).toBeNull();
  },
};

/** The area switch's other areas: the plan's own categories, with no unlabelled row when all are labelled. */
export const PlanArea: Story = {
  args: { area: 'plan' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('rowheader')).toHaveLength(CATEGORY_IDS.plan.length);
    await expect(rowCells(canvasElement, 'Scope')).toEqual(['0', '0', '1', '0']);
    await expect(canvas.getByRole('rowheader', { name: 'Code facts' })).toBeVisible();
  },
};

/**
 * After CR10, each cell holds its count alone, and how many of a row's findings the app labelled is the "Labelled by
 * the app" column after the total; a row's category is plain text.
 */
export const WorkflowLabels: Story = {
  args: { response: findingsWorkflow },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getAllByRole('columnheader').slice(-2).map((th) => th.textContent)).toEqual([
      'Total',
      'Labelled by the app',
    ]);
    await expect(rowCells(canvasElement, 'Tests')).toEqual(['0', '0', '1', '2']);
    await expect(rowExtras(canvasElement, 'Tests')).toEqual(['3', '2']);
    await expect(rowExtras(canvasElement, 'Correctness')).toEqual(['2', '1']);
    for (const cell of canvas.getAllByRole('cell')) await expect(cell.textContent).not.toContain('by the app');
    await expectNoJoined(canvasElement);
  },
};

/** The app differs and strengths measures are counts. */
export const CountMeasures: Story = {
  args: { response: findingsWorkflow, measure: 'appDiffers' },
  play: async ({ canvasElement }) => {
    await expect(rowCells(canvasElement, 'Correctness')).toEqual(['1', '0', '0', '0']);
  },
};
