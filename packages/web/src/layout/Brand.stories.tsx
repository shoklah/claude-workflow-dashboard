import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Brand } from './Brand.tsx';

const meta = {
  component: Brand,
} satisfies Meta<typeof Brand>;
export default meta;
type Story = StoryObj<typeof meta>;

// The brand holds no data, so it has one state.
export const Default: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.textContent).toBe('edward');
    await expect(canvasElement.querySelector('svg')!).toHaveAttribute('aria-hidden', 'true');
    await expect(canvasElement.querySelector('a')).toBeNull();
  },
};
