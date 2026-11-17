import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { parseTime } from '@cwd/shared';
import { WARNING_INK, formatDayTime } from '../lib/format.ts';
import { runFull, runLong, runSmall } from '../test/runs.ts';
import { stagesOf, unitsOf } from './flow.ts';
import { RunFlow } from './RunFlow.tsx';

const meta = { component: RunFlow, args: { stages: stagesOf(runFull.timeline), selected: null, onSelect: fn() } } satisfies Meta<
  typeof RunFlow
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The graph in a panel of a set width, as the page's Flow panel gives it. */
const width =
  (px: number): Decorator =>
  (Story) => (
    <div data-testid="frame" style={{ width: px }}>
      <Story />
    </div>
  );

/** Every exit chip shows its whole text where the box leaves it room. */
async function chipsWhole(flow: HTMLElement) {
  for (const chip of flow.querySelectorAll('.border-dashed')) {
    await expect(chip.scrollWidth, chip.textContent!).toBeLessThanOrEqual(chip.clientWidth);
  }
}

/** `a` comes before `b` in the document. */
const before = (a: Node, b: Node) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/** Empty: a run with no step between its start and its end draws its two pills only. */
export const Empty: Story = {
  args: { stages: stagesOf([runFull.timeline[0], runFull.timeline.at(-1)!]) },
  decorators: [width(720)],
  play: async ({ canvas }) => {
    const flow = canvas.getByRole('group', { name: "The run's flow" });
    await expect(within(flow).queryAllByRole('button')).toHaveLength(0);
    await expect(within(flow).getByText('Started')).toBeVisible();
    await expect(within(flow).getByText('Record written')).toBeVisible();
  },
};

/** A Small run: its two pills, each with its time, and its two boxes, which found nothing. */
export const Small: Story = {
  args: { stages: stagesOf(runSmall.timeline) },
  decorators: [width(720)],
  play: async ({ canvas }) => {
    const flow = within(canvas.getByRole('group', { name: "The run's flow" }));
    for (const [name, at] of [
      ['Started', runSmall.timeline[0].at!],
      ['Record written', runSmall.timeline.at(-1)!.at!],
    ]) {
      const pill = flow.getByText(name).parentElement!;
      await expect(within(pill).getByText(formatDayTime(parseTime(at)))).toBeVisible();
    }
    // Found 0: the zero muted.
    const final = flow.getByRole('button', { name: /^Final review/ });
    await expect(within(final).getByText('0')).toHaveClass('text-muted-foreground');
  },
};

/** Full: a box per unit, each naming its reviewer and what it found; pressing one selects it. A stuck loop's label is
 * in the warning ink with its rounds as text; a step's chips, and a wave's conflicts after its tasks. */
export const Full: Story = {
  decorators: [width(1100)],
  play: async ({ canvas, args, userEvent }) => {
    const group = canvas.getByRole('group', { name: "The run's flow" });
    const flow = within(group);
    await expect(flow.getAllByRole('button')).toHaveLength(unitsOf(args.stages).length);

    const task1 = flow.getByRole('button', { name: /^Task 1(?!\d)/ });
    await expect(task1).toHaveTextContent('task-reviewer');
    await expect(task1).toHaveTextContent('Found 2');
    await expect(task1).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(task1);
    await expect(args.onSelect).toHaveBeenCalledWith('t1');

    const check = flow.getByRole('button', { name: /^Wave A check/ });
    const rounds = flow.getByText('3 rounds');
    await expect(rounds).toHaveClass('sr-only');
    const label = rounds.parentElement!;
    await expect(label).toHaveTextContent('fix-checker');
    await expect(label).toHaveClass(WARNING_INK);
    await expect(before(check, label)).toBe(true);
    const ruled = flow.getByText('Ruled 1');
    await expect(ruled).toBeVisible();
    await expect(before(check, ruled)).toBe(true);

    const conflicts = flow.getByText('1 conflict');
    await expect(conflicts).toHaveClass('text-muted-foreground');
    await expect(before(flow.getByRole('button', { name: /^Task 4(?!\d)/ }), conflicts)).toBe(true);
    await chipsWhole(group);
    // A loop that left nothing is not in the warning ink.
    await expect(flow.getByText('1 round').parentElement).not.toHaveClass(WARNING_INK);
  },
};

/** Selected: the box shows as pressed, and pressing it again clears the selection. */
export const Selected: Story = {
  args: { selected: 't1' },
  decorators: [width(1100)],
  play: async ({ canvas, args, userEvent }) => {
    const task1 = canvas.getByRole('button', { name: /^Task 1(?!\d)/ });
    await expect(task1).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(task1);
    await expect(args.onSelect).toHaveBeenCalledWith(null);
  },
};

/** Long: a kit-reviewed task's two boxes, and Task 10's chips, its open one in the warning ink. */
export const Long: Story = {
  args: { stages: stagesOf(runLong.timeline) },
  decorators: [width(1392)],
  play: async ({ canvas }) => {
    const flow = within(canvas.getByRole('group', { name: "The run's flow" }));
    await expect(flow.getByRole('button', { name: /^Task 7\s*task-reviewer/ })).toBeVisible();
    await expect(flow.getByRole('button', { name: /^Task 7 kit review/ })).toBeVisible();
    const task10 = flow.getByRole('button', { name: /^Task 10(?!\d)/ });
    const open = flow.getByText('Open 1');
    const deferred = flow.getAllByText('Deferred 1').find((chip) => before(task10, chip))!;
    await expect(before(task10, open)).toBe(true);
    await expect(deferred).toBeVisible();
    await expect(open).toHaveClass(WARNING_INK);
    await expect(deferred).toHaveClass('text-muted-foreground');
    await chipsWhole(canvas.getByRole('group', { name: "The run's flow" }));
  },
};

/** Long on a phone: standing up, it never scrolls sideways. */
export const LongUpright: Story = {
  args: { stages: stagesOf(runLong.timeline) },
  decorators: [width(343)],
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /^Task 10(?!\d)/ })).toBeVisible();
    const frame = canvas.getByTestId('frame');
    await expect(frame.scrollWidth).toBeLessThanOrEqual(frame.clientWidth);
  },
};
