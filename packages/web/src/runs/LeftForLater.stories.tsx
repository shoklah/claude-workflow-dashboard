import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime, type FindingRow } from '@cwd/shared';
import { formatDayTime, LATER_FIXES_TERM, STEP_LABELS } from '../lib/format.ts';
import { cells, expectNoJoined } from '../test/table.ts';
import { leftFindings, runFull } from '../test/runs.ts';
import { LeftForLater } from './LeftForLater.tsx';

/** Findings with the step each came from, as the run page names its unit. */
const held = (findings: FindingRow[]) =>
  findings.map((finding) => ({ finding, from: finding.task ? `Task ${finding.task}` : STEP_LABELS[finding.step] }));

const meta = {
  component: LeftForLater,
  args: { findings: held(leftFindings), laterFixes: runFull.laterFixes, step: null, beforeSteps: false },
} satisfies Meta<typeof LeftForLater>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Full: the deferred, to owner, open and no-outcome findings, each with where it came from and its reason under its
 * summary; ruled, declined, fixed and applied ones are closed and absent. Under them, the later fixes, a term. */
export const Full: Story = {
  play: async ({ canvas, canvasElement, userEvent }) => {
    const panel = canvas.getByRole('region', { name: 'Left for later' });
    const table = within(panel).getByRole('table', { name: 'Left for later' });
    await expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Outcome', 'Finding', 'From']);
    const rows = within(table).getAllByRole('row').slice(1);
    await expect(rows.map((row) => cells(row))).toEqual([
      ['Deferred', "Test name doesn't say what it checks", 'Task 1'],
      ['Open', 'Error text not localized', 'Final review'],
      ['To owner', 'Ranking weights are not in the spec' + 'The owner sets the weights', 'Final review'],
      ['No outcome', 'Index rebuild logs every file', 'Task 2'],
    ]);
    // The reason sits under the summary, muted.
    await expect(within(rows[2]).getByText('The owner sets the weights')).toHaveClass('text-muted-foreground');
    for (const closed of ['Both tasks write the same index file', 'Search box has no placeholder', 'Merge the two query builders']) {
      await expect(canvas.queryByText(closed)).toBeNull();
    }
    await expectNoJoined(canvasElement);

    const term = within(panel).getByText('Later fixes');
    await userEvent.hover(term);
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(LATER_FIXES_TERM);
    const fix = within(panel).getByRole('listitem');
    await expect(within(fix).getByText('fix: search keeps the last page on exact multiples')).toBeVisible();
    await expect(within(fix).getByText(formatDayTime(parseTime('2026-11-10T10:14:00Z')))).toBeVisible();
  },
};

/** With a step selected: its title names it, and the run's later fixes aren't the step's, so they don't show. */
export const Step: Story = {
  args: { findings: held(leftFindings.filter((f) => f.task === 1)), step: 'Task 1' },
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('region', { name: 'Left for later in Task 1' });
    await expect(within(panel).getAllByRole('row')).toHaveLength(2);
    await expect(within(panel).queryByText('Later fixes')).toBeNull();
    await expect(within(panel).queryByRole('listitem')).toBeNull();
  },
};

/** Nothing left in the run: its one line, no table. */
export const Nothing: Story = {
  args: { findings: held(leftFindings.filter((f) => f.outcome === 'fixed')), laterFixes: [] },
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('region', { name: 'Left for later' });
    await expect(within(panel).getByText('Nothing left: every finding was closed in this run.')).toBeVisible();
    await expect(within(panel).queryByRole('table')).toBeNull();
  },
};

/** Nothing left in the selected step. */
export const NothingInStep: Story = {
  args: { findings: [], step: 'Task 3' },
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('region', { name: 'Left for later in Task 3' });
    await expect(within(panel).getByText('Task 3 left nothing for later.')).toBeVisible();
  },
};

/** A run recorded before findings were logged has none to list, rather than every one closed. */
export const BeforeSteps: Story = {
  args: { findings: [], laterFixes: [], beforeSteps: true },
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('region', { name: 'Left for later' });
    await expect(within(panel).getByText('Recorded before findings were logged: this run has none to list.')).toBeVisible();
    await expect(within(panel).queryByText('Nothing left: every finding was closed in this run.')).toBeNull();
  },
};

const LONG = 'packages/server/src/views/a-very-long-folder-name-with-no-break/and-another-one/run-page-view.ts';

/** On a phone, a long unbroken summary scrolls in the table's own region, and a long fix subject wraps: nothing spills
 * past the panel. */
export const Phone: Story = {
  parameters: { viewport: { options: { phone: { name: 'Phone', styles: { width: '375px', height: '812px' } } } } },
  globals: { viewport: { value: 'phone' } },
  args: {
    findings: held([{ ...leftFindings[1], summary: `Rename ${LONG}` }]),
    laterFixes: [{ date: '2026-11-10T10:14:00Z', subject: `fix:${LONG}` }],
  },
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('region', { name: 'Left for later' });
    const region = canvas.getByRole('region', { name: 'Left for later table' });
    await expect(region).toHaveAttribute('tabindex', '0');
    await expect(region).toHaveAttribute('data-scroll-cue');
    await expect(panel.scrollWidth).toBeLessThanOrEqual(panel.clientWidth);
    const subject = canvas.getByText(`fix:${LONG}`);
    await expect(subject.getBoundingClientRect().right).toBeLessThanOrEqual(panel.getBoundingClientRect().right);
  },
};
