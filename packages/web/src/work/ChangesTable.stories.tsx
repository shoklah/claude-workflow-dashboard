import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { parseTime } from '@cwd/shared';
import { formatDayTime } from '../lib/format.ts';
import { HTML_TEXT } from '../test/runs.ts';
import { cells, expectNoJoined } from '../test/table.ts';
import { designChange, markupChange, syncChange } from '../test/work.ts';
import { ChangesTable } from './ChangesTable.tsx';

const meta = { component: ChangesTable, args: { label: 'Offline sync table', rows: [], project: true } } satisfies Meta<
  typeof ChangesTable
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'Offline sync table' })).toBeVisible();
    await expect(canvas.getByText('No changes in this period.')).toBeVisible();
  },
};

/** Full: a row per change, its title linking to its page, one value per cell with the unit in the header; a change
 * with other projects shows "+N", whose tooltip names the shown ones and counts the rest; a markup title is text. */
export const Full: Story = {
  args: { rows: [syncChange, markupChange, designChange] },
  play: async ({ canvas, canvasElement, userEvent }) => {
    const [head, sync, markup, design] = canvas.getAllByRole('row');
    await expect(within(head).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Change',
      'Project',
      'Path',
      'Stage',
      'Last activity',
      'Runs',
      'Sessions',
      'Findings',
      'Est. cost ($)',
    ]);
    await expectNoJoined(canvasElement);
    await expect(cells(sync)).toEqual([
      syncChange.title,
      'lantern-notes+2',
      'Full',
      'Implementation',
      formatDayTime(parseTime(syncChange.lastActivity!)),
      '2',
      '5',
      '23',
      '61.40',
    ]);
    await expect(within(sync).getByRole('link', { name: syncChange.title })).toHaveAttribute(
      'href',
      `/work/changes/${syncChange.key}`,
    );
    // The markup title is text, not an element.
    await expect(within(markup).getByRole('link', { name: HTML_TEXT })).toBeVisible();
    await expect(canvasElement.querySelector('img')).toBeNull();
    await expect(cells(markup)[1]).toBe('lantern-notes');
    // Not known: the dashes, read out; a project no stored run has.
    await expect(cells(design)).toEqual([
      designChange.title,
      'Other project',
      'Full',
      'Design',
      '–not known',
      '0',
      '1',
      '–not known',
      '–not known',
    ]);
    for (const th of within(head).getAllByRole('columnheader').slice(5)) await expect(th).toHaveClass('text-right');
    await userEvent.hover(within(sync).getByText('+2'));
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent('tidepool-api, 1 other project');
  },
};

/** Without the Project column. */
export const NoProject: Story = {
  args: { rows: [syncChange], project: false },
  play: async ({ canvas }) => {
    const [head] = canvas.getAllByRole('row');
    await expect(within(head).queryByRole('columnheader', { name: 'Project' })).toBeNull();
    await expect(within(head).getAllByRole('columnheader')).toHaveLength(8);
  },
};
