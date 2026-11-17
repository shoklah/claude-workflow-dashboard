import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { FilterChip } from './FilterChip.tsx';

const meta = {
  component: FilterChip,
  args: { label: 'Clear the session filter', to: '/work', search: { view: 'sessions' }, children: 'Session: Plan the search index' },
} satisfies Meta<typeof FilterChip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A filter set from a link: a pill naming it, its one control a link that clears it. The chip holds no data, so it
 * has one state. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const text = canvas.getByText('Session: Plan the search index');
    await expect(text).toHaveClass('rounded-control', 'border');
    const clear = canvas.getByRole('link', { name: 'Clear the session filter' });
    await expect(clear).toHaveAttribute('href', '/work?view=sessions');
    await expect(clear.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  },
};
