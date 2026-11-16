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
