import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { HTML_TEXT } from '../test/runs.ts';
import { emptyGraph, hiddenGraph, oneGraph, syncGraph } from '../test/work.ts';
import { SessionGraph } from './SessionGraph.tsx';

const meta = { component: SessionGraph, args: { graph: syncGraph, label: 'change' } } satisfies Meta<typeof SessionGraph>;
export default meta;
type Story = StoryObj<typeof meta>;

const LEGEND = ['Started', 'Handed off', 'Belongs to another change'];

/** Full: a box per session in reading order, each title a link to the session in the Sessions view; the sessions of
 * another goal and another change outlined, saying where they belong; solid and dashed edges hidden from assistive
 * tech; the legend; the region focusable and named. */
export const Full: Story = {
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('region', { name: 'How the work spread' });
    const region = within(panel).getByRole('region', { name: 'Sessions of this change, as a graph' });
    await expect(region).toHaveAttribute('tabindex', '0');
    const links = within(region).getAllByRole('link');
    await expect(links.map((link) => link.textContent)).toEqual(syncGraph.nodes.map((n) => n.title));
    await expect(links[0]).toHaveAttribute('href', `/work?view=sessions&session=${syncGraph.nodes[0].key}`);
    await expect(within(region).getByText('Run: Queue edits while offline')).toBeVisible();
    await expect(within(region).getByText('Other goal: Legal pages')).toBeVisible();
    await expect(within(region).getByText('Other change: Conflict banner')).toBeVisible();
    const terms = within(region).getByText('Other goal: Legal pages').parentElement!;
    await expect(terms).toHaveClass('border-dashed');
    await expect(links[0].parentElement).not.toHaveClass('border-dashed');

    const svg = region.querySelector('svg')!;
    await expect(svg).toHaveAttribute('aria-hidden', 'true');
    const edges = [...svg.querySelectorAll(':scope > path')];
    await expect(edges).toHaveLength(syncGraph.edges.length);
    await expect(edges.filter((path) => path.getAttribute('stroke-dasharray'))).toHaveLength(1);

    for (const name of LEGEND) await expect(within(panel).getByText(name)).toBeVisible();
    await expect(within(panel).queryByText(/left out/)).toBeNull();
  },
};

/** On a goal's page: the region and the legend say goal, and a session of a goal Work doesn't list is "Another goal". */
export const OnAGoalPage: Story = {
  args: { graph: hiddenGraph, label: 'goal' },
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: 'Sessions of this goal, as a graph' });
    await expect(within(region).getByText('Another goal')).toBeVisible();
    await expect(canvas.getByText('Belongs to another goal')).toBeVisible();
  },
};

/** Showing mode on: a title with markup shown as text, sessions in no change and in a change Work doesn't list, and a
 * line saying how many sessions it left out. */
export const Hidden: Story = {
  args: { graph: hiddenGraph },
  play: async ({ canvas, canvasElement }) => {
    const region = canvas.getByRole('region', { name: 'Sessions of this change, as a graph' });
    await expect(within(region).getByRole('link', { name: HTML_TEXT })).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expect(within(region).getByText('No change')).toBeVisible();
    await expect(within(region).getByText('Another change')).toBeVisible();
    await expect(canvas.getByText('+ 2 sessions in other projects, counted in totals and charts only')).toBeVisible();
  },
};

/** One session: its box, with no edge and no legend. */
export const One: Story = {
  args: { graph: oneGraph },
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: 'Sessions of this change, as a graph' });
    await expect(within(region).getAllByRole('link')).toHaveLength(1);
    await expect(region.querySelectorAll('svg > path')).toHaveLength(0);
    for (const name of LEGEND) await expect(canvas.queryByText(name)).toBeNull();
  },
};

/** No session: the panel says so. */
export const Empty: Story = {
  args: { graph: emptyGraph },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No session of this change is in the data.')).toBeVisible();
    await expect(canvas.queryByRole('region', { name: 'Sessions of this change, as a graph' })).toBeNull();
  },
};
