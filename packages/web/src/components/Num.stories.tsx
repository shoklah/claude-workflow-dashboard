import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Table, TableBody, TableCell, TableHeader, TableRow } from './ui/table.tsx';
import { EmptyRow, GroupHead, Lines, Num, Text, Unknown } from './Num.tsx';

const meta = {
  component: Num,
  args: { value: 0 },
} satisfies Meta<typeof Num>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A number (whole, grouped by default), a zero (muted), an unknown (the muted dash, read out as "not known"), a formatted number, and a text
 * value with and without its value. */
export const Values: Story = {
  render: () => (
    <ul>
      <li data-testid="number">
        <Num value={12} />
      </li>
      <li data-testid="thousands">
        <Num value={1234} />
      </li>
      <li data-testid="zero">
        <Num value={0} />
      </li>
      <li data-testid="unknown">
        <Num value={null} />
      </li>
      <li data-testid="formatted">
        <Num value={12.4} format={(n) => n.toFixed(2)} />
      </li>
      <li data-testid="text">
        <Text value="main" />
      </li>
      <li data-testid="no-text">
        <Text value={null} unknown="no branch" />
      </li>
    </ul>
  ),
  play: async ({ canvas }) => {
    const unknown = canvas.getByTestId('unknown');
    await expect(unknown.querySelector('[aria-hidden]')).toHaveTextContent('–');
    await expect(unknown.querySelector('.sr-only')).toHaveTextContent('not known');
    await expect(canvas.getByText('0')).toHaveClass('text-muted-foreground');
    await expect(canvas.getByText('12')).not.toHaveClass('text-muted-foreground');
    await expect(canvas.getByTestId('thousands')).toHaveTextContent('1,234');
    await expect(canvas.getByTestId('formatted')).toHaveTextContent('12.40');
    await expect(canvas.getByTestId('text')).toHaveTextContent('main');
    await expect(canvas.getByTestId('no-text').querySelector('.sr-only')).toHaveTextContent('no branch');
  },
};

/** On the backdrop (a goal section's totals), the dash in primary ink, still read out. */
export const UnknownOnBackdrop: Story = {
  render: () => <Unknown backdrop />,
  play: async ({ canvasElement }) => {
    const dash = canvasElement.querySelector('[aria-hidden]')!.parentElement!;
    await expect(dash).not.toHaveClass('text-muted-foreground');
    await expect(dash.querySelector('.sr-only')).toHaveTextContent('not known');
  },
};

/** A group header spans its sub-columns and is scoped to their group. */
export const Group: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <GroupHead span={3}>Runs</GroupHead>
        </TableRow>
      </TableHeader>
    </Table>
  ),
  play: async ({ canvas }) => {
    const head = canvas.getByRole('columnheader', { name: 'Runs' });
    await expect(head).toHaveAttribute('colspan', '3');
    await expect(head).toHaveAttribute('scope', 'colgroup');
    await expect(head).toHaveClass('text-center');
  },
};

/** A table's empty row spans its columns. */
export const Empty: Story = {
  render: () => (
    <Table>
      <TableBody>
        <EmptyRow columns={4}>No runs.</EmptyRow>
      </TableBody>
    </Table>
  ),
  play: async ({ canvas }) => {
    const cell = canvas.getByText('No runs.');
    await expect(cell).toHaveAttribute('colspan', '4');
    await expect(cell).toHaveClass('text-muted-foreground');
  },
};

/** An item's lines: one row per count, its name and the cells before and after spanning them, a whole cell keeping
 * its own classes; no counts read the `none` word, counts not known the dash; `line(i)` gives a line's own cells. */
export const ItemLines: Story = {
  render: () => (
    <Table>
      <TableBody>
        <Lines
          name="Review"
          before={[3, <TableCell className="align-top">whole</TableCell>]}
          counts={[
            ['Fixed', 2],
            ['Open', 0],
          ]}
          after={[1]}
          none="No counts"
        />
        <Lines name="Empty" counts={[]} none="No counts" />
        <Lines name="Unknown" counts={null} none="No counts" />
        <Lines
          name="Own cells"
          lines={1}
          line={() => (
            <>
              <TableCell>a</TableCell>
              <TableCell>b</TableCell>
            </>
          )}
        />
      </TableBody>
    </Table>
  ),
  play: async ({ canvas, canvasElement }) => {
    const rows = [...canvasElement.querySelectorAll('tr')];
    await expect(rows.map((row) => [...row.children].map((cell) => cell.textContent))).toEqual([
      ['Review', '3', 'whole', 'Fixed', '2', '1'],
      ['Open', '0'],
      ['Empty', 'No counts'],
      ['Unknown', '–not known'],
      ['Own cells', 'a', 'b'],
    ]);
    await expect(canvas.getByRole('rowheader', { name: 'Review' })).toHaveAttribute('rowspan', '2');
    await expect(canvas.getByText('whole')).toHaveAttribute('rowspan', '2');
    await expect(canvas.getByText('whole')).toHaveClass('align-top');
    await expect(rows[0]).toHaveClass('border-b-0');
    await expect(rows[1]).not.toHaveClass('border-b-0');
  },
};
