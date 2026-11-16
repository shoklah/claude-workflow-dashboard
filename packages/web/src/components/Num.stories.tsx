import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Table, TableHeader, TableRow } from './ui/table.tsx';
import { GroupHead, Num, Text } from './Num.tsx';

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
