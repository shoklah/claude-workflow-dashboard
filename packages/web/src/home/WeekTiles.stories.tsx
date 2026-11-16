import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { emptyWeek, fullHome } from '../test/home.ts';
import { WeekTiles } from './WeekTiles.tsx';

const meta = { component: WeekTiles } satisfies Meta<typeof WeekTiles>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Each row of a table as its cells' text, header cells included. */
const rows = (table: HTMLElement) =>
  [...table.querySelectorAll('tr')].map((tr) => [...tr.children].map((cell) => cell.textContent));

/** The four small tables, in order, inside the "This week" panel. */
function tables(canvasElement: HTMLElement) {
  const panel = within(canvasElement).getByRole('region', { name: 'This week' });
  return ['Runs', 'Findings', 'Est. cost ($)', 'Warnings'].map((name) => within(panel).getByRole('table', { name }));
}

/** Empty: no runs this week or last; zeros stay, and an unknown cost is the dash read out as not known. */
export const EmptyWeek: Story = {
  args: { thisWeek: emptyWeek, lastWeek: emptyWeek },
  play: async ({ canvasElement }) => {
    const [runs, findings, cost, warnings] = tables(canvasElement);
    for (const table of [runs, findings, cost, warnings]) {
      await expect(rows(table)[0].slice(1)).toEqual(['This week', 'Last week']);
    }
    await expect(rows(runs).slice(1)).toEqual([
      ['All paths', '0', '0'],
      ['Small', '0', '0'],
      ['Full', '0', '0'],
      ['Plan', '0', '0'],
    ]);
    await expect(rows(findings).slice(1).map((row) => row[0])).toEqual(['Found', 'Acted on', 'Open']);
    await expect(rows(cost).slice(1)).toEqual([
      ['All runs', '–not known', '–not known'],
      ['A run', '–not known', '–not known'],
    ]);
    await expect(rows(warnings).slice(1).map((row) => row[0])).toEqual(['Current', 'New']);
  },
};

/** Full: each measure's parts, this week beside last week, one value per cell. */
export const FullWeek: Story = {
  args: { thisWeek: fullHome.thisWeek, lastWeek: fullHome.lastWeek },
  play: async ({ canvasElement }) => {
    const [runs, findings, cost, warnings] = tables(canvasElement);
    await expect(rows(runs)).toEqual([
      ['Runs', 'This week', 'Last week'],
      ['All paths', '6', '8'],
      ['Small', '3', '4'],
      ['Full', '2', '3'],
      ['Plan', '1', '1'],
    ]);
    await expect(rows(findings).slice(1)).toEqual([
      ['Found', '19', '15'],
      ['Acted on', '13', '12'],
      ['Open', '1', '0'],
    ]);
    await expect(rows(cost).slice(1)).toEqual([
      ['All runs', '21.00', '27.25'],
      ['A run', '3.50', '3.41'],
    ]);
    await expect(rows(warnings).slice(1)).toEqual([
      ['Current', '12', '9'],
      ['New', '3', '0'],
    ]);
    for (const table of [runs, findings, cost, warnings]) {
      for (const row of rows(table)) for (const cell of row) await expect(cell).not.toContain(' · ');
      // The numbers line up: their headers and cells right-aligned in tabular figures.
      for (const cell of table.querySelectorAll('td')) await expect(cell).toHaveClass('text-right', 'tabular-nums');
    }
  },
};

/** A week whose runs have no priced cost: the cost and the cost a run are a dash, not 0.00. */
export const CostUnknown: Story = {
  args: { thisWeek: { ...fullHome.thisWeek, cost: null, costPerRun: null }, lastWeek: fullHome.lastWeek },
  play: async ({ canvasElement }) => {
    const cost = tables(canvasElement)[2];
    await expect(rows(cost).slice(1)).toEqual([
      ['All runs', '–not known', '27.25'],
      ['A run', '–not known', '3.41'],
    ]);
  },
};
