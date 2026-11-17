import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { RunLink } from './RunLink.tsx';

const meta = { component: RunLink, args: { runKey: 'a1b2', branch: 'feat/search' } } satisfies Meta<typeof RunLink>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A link to the run's page, named by its branch and underlined. */
export const Branch: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'feat/search' });
    await expect(link).toHaveAttribute('href', '/runs/a1b2');
    await expect(link).toHaveClass('underline');
  },
};

/** A run with no branch: the dash, read out as "no branch". */
export const NoBranch: Story = {
  args: { branch: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: /no branch/ })).toHaveAttribute('href', '/runs/a1b2');
  },
};
