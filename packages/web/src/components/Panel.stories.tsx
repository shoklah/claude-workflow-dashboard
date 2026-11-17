import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { Button } from './ui/button.tsx';
import { Details, Line, PageTitle, Pairs, Panel, Section, SectionTitle, State } from './Panel.tsx';

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

/** A section without glass: a region named by its title, its aside beside the title. */
export const SectionWithoutGlass: Story = {
  render: () => (
    <Section title="Runs and sessions" aside={<Button size="sm">Over the cap</Button>}>
      <p>A section's body.</p>
    </Section>
  ),
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: 'Runs and sessions' });
    await expect(region).not.toHaveClass('glass');
    await expect(within(region).getByRole('button', { name: 'Over the cap' })).toBeVisible();
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

/** Facts over their values on the backdrop (a change's header): the terms in primary ink, since they sit on the
 * backdrop. */
export const PairsOverOnBackdrop: Story = {
  render: () => <Pairs inline="over" backdrop pairs={[['Project', 'atlas'], ['Findings', 4]]} />,
  play: async ({ canvas, canvasElement }) => {
    await expect(getComputedStyle(canvas.getByText('Project')).fontSize).toBe('12px');
    for (const dt of canvasElement.querySelectorAll('dt')) await expect(dt).not.toHaveClass('text-muted-foreground');
  },
};

/** Columns on the backdrop (a goal section's totals): each pair as wide as its column from `sm`, its value at the
 * column's end, so rows of different values line up; the terms in primary ink, since they sit on the backdrop. */
export const PairsColumns: Story = {
  parameters: { viewport: { options: { desktop: { name: 'Desktop', styles: { width: '1280px', height: '900px' } } } } },
  globals: { viewport: { value: 'desktop' } },
  render: () => (
    <div className="flex flex-col gap-3">
      <Pairs inline="columns" widths={['sm:w-26', 'sm:w-34']} pairs={[['Runs', 4], ['Est. cost', '$89.35']]} />
      <Pairs inline="columns" widths={['sm:w-26', 'sm:w-34']} pairs={[['Runs', 1250], ['Est. cost', '$4.25']]} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [first, second] = [...canvasElement.querySelectorAll('dl')].map((dl) =>
      [...dl.querySelectorAll('dd')].map((dd) => dd.getBoundingClientRect().right),
    );
    await expect(second).toEqual(first);
    for (const dt of canvasElement.querySelectorAll('dt')) await expect(dt).not.toHaveClass('text-muted-foreground');
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
            ['simplify', 'found something'],
          ]}
        />
      </div>
    ),
  },
  play: async ({ canvas }) => {
    const [long, short] = canvas.getAllByRole('term');
    await expect(long).not.toHaveClass('text-muted-foreground');
    await expect(long.nextElementSibling).toHaveClass('text-muted-foreground');
    await expect(short.nextElementSibling).toHaveTextContent('found something');
    // One line each: the long name sits level with its detail, its height one line's.
    await expect(long.getBoundingClientRect().top).toBe(long.nextElementSibling!.getBoundingClientRect().top);
    await expect(long.getBoundingClientRect().height).toBe(short.getBoundingClientRect().height);
  },
};

/** Prose values: each term in its own column, as wide as the widest term, its value left-aligned beside it. */
export const PairsText: Story = {
  args: {
    title: 'Information',
    children: (
      <div className="w-96">
        <Pairs
          text
          pairs={[
            ['Coverage', 'from Nov 3'],
            ['Note', 'a long line of prose that wraps onto a second line inside its own column, under its first'],
          ]}
        />
      </div>
    ),
  },
  play: async ({ canvas }) => {
    const [coverage, note] = canvas.getAllByRole('term');
    for (const dt of [coverage, note]) await expect(getComputedStyle(dt.nextElementSibling!).textAlign).toBe('left');
    // The values start in one column, right after the widest term, and a long one wraps there.
    const values = [coverage, note].map((dt) => dt.nextElementSibling!.getBoundingClientRect());
    await expect(values[0].left).toBe(values[1].left);
    await expect(values[0].left - coverage.getBoundingClientRect().left).toBeLessThan(150);
    await expect(values[1].height).toBeGreaterThan(values[0].height);
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
