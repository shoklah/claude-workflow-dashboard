import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { WARNING_INK } from '../lib/format.ts';
import { cells } from '../test/table.ts';
import { finding, runFull } from '../test/runs.ts';
import { stagesOf, unitsOf, type Unit } from './flow.ts';
import { StepDetail } from './StepDetail.tsx';

const units = unitsOf(stagesOf(runFull.timeline));
const unit = (id: string) => units.find((u) => u.id === id)!;
/** Task 1: a review and one fix round by `fix-checker` on Opus. */
const task1 = unit('t1');

const meta = { component: StepDetail, args: { unit: unit('wA'), onClose: fn() } } satisfies Meta<typeof StepDetail>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The table's column heads, each its text. */
const heads = (table: HTMLElement) => within(table).getAllByRole('columnheader').map((th) => th.textContent);
/** A finding's row, by its id. */
const rowOf = (table: HTMLElement, id: string) => within(table).getByRole('rowheader', { name: new RegExp(`^${id}(?!\\d)`) }).closest('tr')!;

/** Stuck: Wave A check's finding stayed open three rounds, and was ruled. */
export const Stuck: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const detail = canvas.getByRole('region', { name: 'Wave A check' });
    await expect(within(detail).getByRole('heading', { name: 'Wave A check' })).toBeVisible();
    await userEvent.click(within(detail).getByRole('button', { name: 'Close Wave A check' }));
    await expect(args.onClose).toHaveBeenCalled();

    const table = within(detail).getByRole('table', { name: 'Wave A check' });
    await expect(heads(table)).toEqual([
      'Finding',
      'Task reviewtask-reviewer · Opus 5.5, high',
      'Fix round 1checked by fix-checker',
      'Fix round 2checked by fix-checker',
      'Fix round 3checked by fix-checker',
      'Ended',
    ]);
    const f4 = rowOf(table, 'F4');
    await expect(within(f4).getByRole('rowheader')).toHaveTextContent('F4ImportantBoth tasks write the same index file');
    await expect(cells(f4)).toEqual(['Found', 'Still open', 'Still open', 'Still open', 'RuledOne index per run is intended']);
    for (const open of within(f4).getAllByText('Still open')) await expect(open).toHaveClass(WARNING_INK);
    // Ruled is closed by a decision: muted, not in the warning ink.
    const ruled = within(f4).getByText('Ruled');
    await expect(ruled).toHaveClass('text-muted-foreground');
    await expect(ruled).not.toHaveClass(WARNING_INK);
  },
};

/** In a narrow panel the table keeps its Finding column readable and its agents' names whole, and scrolls sideways in
 * its own region, its edge fading where columns are hidden. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 520 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    const region = canvas.getByRole('region', { name: 'Wave A check table' });
    await expect(region.scrollWidth).toBeGreaterThan(region.clientWidth);
    await expect(getComputedStyle(region).animationName).toBe('scroll-cue');
    const table = within(region).getByRole('table', { name: 'Wave A check' });
    await expect(within(table).getByRole('rowheader').getBoundingClientRect().width).toBeGreaterThanOrEqual(192);
    for (const agent of [...within(table).getAllByText('fix-checker'), within(table).getByText('task-reviewer')]) {
      await expect(agent).toHaveClass('whitespace-nowrap');
    }
  },
};

/** A unit with two fix rounds: F1 fixed in round 1, F2 deferred without a round. */
const twoRounds: Unit = {
  ...task1,
  rounds: [task1.rounds[0], { ...task1.rounds[0], round: 2 }],
  findings: [
    finding({ id: 'F1', step: 'task_review', task: 1, severity: 'important', summary: 'Search drops the last page', outcome: 'fixed', verdicts: ['fixed'] }),
    finding({ id: 'F2', step: 'task_review', task: 1, severity: 'minor', summary: 'Test name says too little', outcome: 'deferred' }),
  ],
};

/** Fixed in round 1 of two: "Fixed" under round 1, only a rule under round 2; a deferred finding skips the rounds. */
export const Fixed: Story = {
  args: { unit: twoRounds },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Task 1' });
    await expect(heads(table)).toEqual([
      'Finding',
      'Task reviewtask-reviewer · Opus 5.5, high',
      'Fix round 1checked by fix-checker · Opus',
      'Fix round 2checked by fix-checker · Opus',
      'Ended',
    ]);
    const row1 = rowOf(table, 'F1');
    const f1 = within(row1).getAllByRole('cell');
    await expect(cells(row1)).toEqual(['Found', 'Fixed', '', 'Fixed']);
    await expect(f1[2].querySelector('[aria-hidden]')).not.toBeNull();
    const fixed = within(f1[1]).getByText('Fixed');
    await expect(fixed).not.toHaveClass(WARNING_INK);
    const row2 = rowOf(table, 'F2');
    const f2 = within(row2).getAllByRole('cell');
    await expect(cells(row2)).toEqual(['Found', '', '', 'Deferred']);
    // The skipped rounds: a dashed rule across each.
    for (const cell of f2.slice(1, 3)) await expect(cell.querySelector('.border-dashed')).not.toBeNull();
  },
};

/** "Fixed, not proportionate" counts as open: in the warning ink, like "Still open". */
export const NotProportionate: Story = {
  args: {
    unit: {
      ...task1,
      findings: [finding({ id: 'F1', step: 'task_review', task: 1, severity: 'important', summary: 'Retries hold the queue', outcome: 'to_owner', verdicts: ['not_proportionate'] })],
    },
  },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Task 1' });
    await expect(within(rowOf(table, 'F1')).getByText('Not proportionate')).toHaveClass(WARNING_INK);
  },
};

/** A review that found nothing says so in one line, with no table. */
export const FoundNothing: Story = {
  args: { unit: unit('t3') },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Task review by task-reviewer · Opus 5.5, high found nothing.')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

/** A finding with more verdicts than the unit has fix-check steps: a column for each verdict. */
export const MoreVerdictsThanRounds: Story = {
  args: {
    unit: {
      ...task1,
      findings: [finding({ id: 'F1', step: 'task_review', task: 1, severity: 'minor', summary: 'Retry count read twice', outcome: 'fixed', verdicts: ['open', 'later', 'fixed'] })],
    },
  },
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Task 1' });
    await expect(heads(table).filter((h) => h!.startsWith('Fix round'))).toHaveLength(3);
    await expect(within(rowOf(table, 'F1')).getByText('Later')).toHaveClass(WARNING_INK);
  },
};

/** On a phone: the same findings as a list, each finding, then its marks in a wrapping row, then its reason. */
export const Phone: Story = {
  parameters: { viewport: { options: { phone: { name: 'Phone', styles: { width: '375px', height: '812px' } } } } },
  globals: { viewport: { value: 'phone' } },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('table')).toBeNull();
    const items = canvas.getAllByRole('listitem');
    await expect(items).toHaveLength(1);
    const f4 = within(items[0]);
    await expect(f4.getByText('Both tasks write the same index file')).toBeVisible();
    for (const text of ['Found', 'Round 1: still open', 'Round 2: still open', 'Round 3: still open', 'Ruled', 'One index per run is intended']) {
      await expect(f4.getByText(text)).toBeVisible();
    }
  },
};
