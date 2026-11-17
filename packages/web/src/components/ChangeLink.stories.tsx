import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ChangeLink } from './ChangeLink.tsx';

const meta = { component: ChangeLink, args: { changeKey: 'c0ffee12', title: 'Plan the offline queue and replay' } } satisfies Meta<typeof ChangeLink>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A change's link to its page, named by its title and underlined. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'Plan the offline queue and replay' });
    await expect(link).toHaveAttribute('href', '/work/changes/c0ffee12');
    await expect(link).toHaveClass('underline');
  },
};

/** A title with markup in it shows as text, never as markup. */
export const MarkupTitle: Story = {
  args: { title: 'Escape the <b>sync</b> log' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('link', { name: 'Escape the <b>sync</b> log' })).toBeVisible();
    await expect(canvasElement.querySelector('b')).toBeNull();
  },
};
