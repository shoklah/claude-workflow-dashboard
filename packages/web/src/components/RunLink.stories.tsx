import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { RunLink } from './RunLink.tsx';

const meta = { component: RunLink, args: { runKey: 'a1b2', branch: 'feat/search', title: null } } satisfies Meta<typeof RunLink>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A run with a title: the link to its page is named by the title, not the branch. */
export const Title: Story = {
  args: { title: 'Search every note by title and body' },
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'Search every note by title and body' });
    await expect(link).toHaveAttribute('href', '/runs/a1b2');
    await expect(link).toHaveClass('underline');
    await expect(canvas.queryByText('feat/search')).toBeNull();
  },
};

/** A run with no title: a link to the run's page, named by its branch and underlined. */
export const Branch: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'feat/search' });
    await expect(link).toHaveAttribute('href', '/runs/a1b2');
    await expect(link).toHaveClass('underline');
  },
};

/** A run with no title and no branch: the dash, read out as "no branch". */
export const NoBranch: Story = {
  args: { branch: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: /no branch/ })).toHaveAttribute('href', '/runs/a1b2');
  },
};

/** A title with markup in it shows as text, never as markup. */
export const MarkupTitle: Story = {
  args: { title: "Fix the sync log's <b>escaping</b>" },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('link', { name: "Fix the sync log's <b>escaping</b>" })).toBeVisible();
    await expect(canvasElement.querySelector('b')).toBeNull();
  },
};
