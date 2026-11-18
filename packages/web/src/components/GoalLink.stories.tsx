import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { GoalLink } from './GoalLink.tsx';

const meta = { component: GoalLink, args: { goalKey: 'g0ffee12', name: 'Offline sync' } } satisfies Meta<typeof GoalLink>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A goal's link to its page, named by its name and underlined. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'Offline sync' });
    await expect(link).toHaveAttribute('href', '/work/goals/g0ffee12');
    await expect(link).toHaveClass('underline');
  },
};

/** A name with markup in it shows as text, never as markup. */
export const MarkupName: Story = {
  args: { name: 'Sync <b>everything</b>' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('link', { name: 'Sync <b>everything</b>' })).toBeVisible();
    await expect(canvasElement.querySelector('b')).toBeNull();
  },
};
