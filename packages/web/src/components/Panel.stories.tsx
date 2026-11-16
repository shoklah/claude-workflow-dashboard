import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Button } from './ui/button.tsx';
import { Details, Line, PageTitle, Pairs, Panel, SectionTitle, State } from './Panel.tsx';

const meta = {
  component: Panel,
  args: { title: 'Things', children: <p>A panel's body.</p> },
} satisfies Meta<typeof Panel>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A page's title and a section's, on the backdrop. */
export const Titles: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <PageTitle>Sessions</PageTitle>
      <SectionTitle>Tokens by week</SectionTitle>
    </div>
  ),
  play: async ({ canvas }) => {
    const page = getComputedStyle(canvas.getByRole('heading', { level: 1, name: 'Sessions' }));
    await expect([page.fontSize, page.fontWeight]).toEqual(['28px', '700']);
    const section = getComputedStyle(canvas.getByRole('heading', { level: 2, name: 'Tokens by week' }));
    await expect([section.fontSize, section.fontWeight]).toEqual(['16px', '600']);
  },
};

/** A panel with its title and an aside beside it: a region named by its title. */
export const PanelWithAside: Story = {
  args: { aside: <Button size="sm">Mark seen</Button> },
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: 'Things' });
    await expect(region).toHaveClass('glass');
    await expect(within(region).getByRole('heading', { level: 2, name: 'Things' })).toBeVisible();
    await expect(within(region).getByRole('button', { name: 'Mark seen' })).toBeVisible();
  },
};

/** Labelled pairs on a panel: each term with its value. */
export const PairsList: Story = {
  args: {
    title: 'Run',
    children: (
      <Pairs
        pairs={[
          ['Findings', 4],
          ['Acted on', 3],
          ['Time (min)', 25],
        ]}
      />
    ),
  },
  play: async ({ canvas }) => {
    const terms = canvas.getAllByRole('term');
    await expect(terms.map((dt) => dt.textContent)).toEqual(['Findings', 'Acted on', 'Time (min)']);
    await expect(terms.map((dt) => dt.tagName)).toEqual(['DT', 'DT', 'DT']);
    await expect(terms.map((dt) => dt.nextElementSibling?.tagName)).toEqual(['DD', 'DD', 'DD']);
    await expect(terms.map((dt) => dt.nextElementSibling?.textContent)).toEqual(['4', '3', '25']);
  },
};

/** Inline pairs: one row of facts that wraps, each term beside its value (a line of facts under a flow), or over it
 * (a page's header facts). */
export const PairsInline: Story = {
  args: {
    title: 'Facts',
    children: (
      <div className="flex flex-col gap-4">
        <Pairs inline="beside" pairs={[['Ran', 7], ['Still open', 1]]} />
        <Pairs inline="over" pairs={[['Project', 'atlas'], ['Findings', 4]]} />
      </div>
    ),
  },
  play: async ({ canvas, canvasElement }) => {
    const [beside, over] = [...canvasElement.querySelectorAll('dl')];
    for (const dl of [beside, over]) await expect(getComputedStyle(dl).flexWrap).toBe('wrap');
    const pairs = (dl: Element) => [...dl.children].map((pair) => [pair.children[0].textContent, pair.children[1].textContent]);
    await expect(pairs(beside)).toEqual([['Ran', '7'], ['Still open', '1']]);
    await expect(pairs(over)).toEqual([['Project', 'atlas'], ['Findings', '4']]);
    // Beside: the value on the term's line. Over: the value under its term, in bold, the term small.
    const ran = canvas.getByText('Ran').getBoundingClientRect();
    const seven = canvas.getByText('7').getBoundingClientRect();
    await expect(seven.left).toBeGreaterThan(ran.right);
    await expect(Math.abs(seven.top - ran.top)).toBeLessThan(4);
    const project = canvas.getByText('Project');
    const atlas = canvas.getByText('atlas');
    await expect(atlas.getBoundingClientRect().top).toBeGreaterThanOrEqual(project.getBoundingClientRect().bottom - 1);
    await expect(getComputedStyle(atlas).fontWeight).toBe('600');
    await expect(getComputedStyle(project).fontSize).toBe('12px');
  },
};

/** Names with their detail: each name in primary ink on its own row, its detail muted beside it, so a long name
 * keeps one line when a short one has a long detail. */
export const PairsNames: Story = {
  args: {
    title: 'Skills',
    children: (
      <div className="w-80">
        <Pairs
          names
          pairs={[
            ['subagent-driven-development', 'ran'],
            ['simplify', 'applied 2, skipped 1'],
          ]}
        />
      </div>
    ),
  },
  play: async ({ canvas }) => {
    const [long, short] = canvas.getAllByRole('term');
    await expect(long).not.toHaveClass('text-muted-foreground');
    await expect(long.nextElementSibling).toHaveClass('text-muted-foreground');
    await expect(short.nextElementSibling).toHaveTextContent('applied 2, skipped 1');
    // One line each: the long name sits level with its detail, its height one line's.
    await expect(long.getBoundingClientRect().top).toBe(long.nextElementSibling!.getBoundingClientRect().top);
    await expect(long.getBoundingClientRect().height).toBe(short.getBoundingClientRect().height);
  },
};

/** The disclosure, closed: its body shows once the summary is clicked. */
export const DetailsClosed: Story = {
  render: () => (
    <Details summary="How runs are counted">
      <p>A run counts in the week its record is written.</p>
    </Details>
  ),
  play: async ({ canvas, userEvent }) => {
    const body = canvas.getByText('A run counts in the week its record is written.');
    await expect(body).not.toBeVisible();
    await userEvent.click(canvas.getByText('How runs are counted'));
    await expect(body).toBeVisible();
  },
};

/** A page's line on the backdrop, in primary ink. */
export const LineOnBackdrop: Story = {
  render: () => <Line>2 runs hidden by showing mode.</Line>,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('2 runs hidden by showing mode.')).not.toHaveClass('text-muted-foreground');
  },
};

/** A region loading: its panel with one muted line. */
export const StateLoading: Story = {
  render: () => <State>Loading the sessions…</State>,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Loading the sessions…')).toHaveClass('text-muted-foreground');
  },
};

/** A region that failed: its panel with the warning edge. */
export const StateError: Story = {
  render: () => <State error>Couldn't load the sessions.</State>,
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Couldn't load the sessions.")).toHaveClass('border-warning-edge');
  },
};
