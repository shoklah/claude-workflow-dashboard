import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { SessionLink } from './SessionLink.tsx';

const meta = { component: SessionLink, args: { sessionKey: 'c0ffee12', title: 'Design offline sync' } } satisfies Meta<typeof SessionLink>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A session's link to it alone in the Sessions view, named by its title and underlined. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'Design offline sync' });
    await expect(link).toHaveAttribute('href', '/work?view=sessions&session=c0ffee12');
    await expect(link).toHaveClass('underline');
  },
};

/** A session with no title: "no title", muted. */
export const NoTitle: Story = {
  args: { title: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'no title' })).toHaveClass('text-muted-foreground');
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
