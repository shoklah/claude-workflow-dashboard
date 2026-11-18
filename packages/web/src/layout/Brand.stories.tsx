import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Brand } from './Brand.tsx';

const meta = {
  component: Brand,
} satisfies Meta<typeof Brand>;
export default meta;
type Story = StoryObj<typeof meta>;

// The brand holds no data; the sign-in page draws it plain, the shell as a link to Home.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toBe('edward');
    await expect(canvasElement.querySelector('svg')!).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('a')).toBeNull();
  },
};

export const Home: Story = {
  args: { home: true },
  parameters: { path: '/spend' },
  play: async ({ canvasElement }) => {
    const link = canvasElement.querySelector('a')!;
    await expect(link).toHaveAttribute('href', '/');
    await expect(link).toHaveAccessibleName('edward, Home');
    // Off Home, the brand isn't the current page: only the menu's entry is.
    await expect(link).not.toHaveAttribute('aria-current');
  },
};
